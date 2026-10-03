/**
 * @fileoverview Firebase Firestore Services
 * 
 * Service layer providing all database operations for the Badminton App including
 * user management, group operations, event CRUD, voting system, and attendance tracking.
 */

// services/firestore.ts
import {
  collection, doc, setDoc, getDoc, updateDoc, writeBatch, onSnapshot,
  increment, arrayUnion, arrayRemove, CollectionReference, DocumentData, Query, getDocs, query, where,
  Timestamp, deleteDoc, documentId, or, addDoc, runTransaction
} from "firebase/firestore";
import { db } from "./index";
import { UserDoc, GroupDoc, EventDoc, VoteShard, VoteStatus, newMatchHistory, AttendanceRecord, GroupInviteDoc } from "./types_index";
import * as ImageManipulator from 'expo-image-manipulator'

/**
 * Number of shards used for distributed vote counting to ensure scalability
 */
const NUM_SHARDS = 10;

// --- STORAGE ---
// Alternative: Convert image to Base64 for Firestore storage
export async function imageToBase64(uri: string): Promise<string> {
  try {
    // Target: keep under ~1,048,487 bytes (Firestore field limit in this app context)
    const MAX_BASE64_LENGTH = 1_048_000; // safe margin

    // Start with moderate target size/quality
    let width = 800; // downscale long edge
    let quality = 0.7; // JPEG quality

    for (let attempt = 0; attempt < 5; attempt++) {
      const actions: ImageManipulator.Action[] = [{ resize: { width } }];
      const result = await ImageManipulator.manipulateAsync(uri, actions, {
        compress: quality,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      } as any);

      const dataUrl = `data:image/jpeg;base64,${result.base64 ?? ''}`;
      if (dataUrl.length <= MAX_BASE64_LENGTH) {
        console.log('Image converted to Base64 within limit:', dataUrl.length);
        return dataUrl;
      }

      // tighten constraints and try again
      width = Math.floor(width * 0.8);
      quality = Math.max(0.4, quality - 0.1);
    }

    // Final attempt with aggressive compression
    const finalResult = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 480 } }], {
      compress: 0.4,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    } as any);
    const finalDataUrl = `data:image/jpeg;base64,${finalResult.base64 ?? ''}`;
    console.log('Final compressed size:', finalDataUrl.length);
    return finalDataUrl;
  } catch (error) {
    console.error('Error converting image to Base64:', error);
    throw error;
  }
}

// --- USERS ---

/**
 * Creates a new user profile in Firestore
 * @param {string} uid - Unique user identifier (Auth0 sub)
 * @param {UserDoc} userDoc - Complete user document data
 * @returns {Promise<void>} Promise that resolves when user is created
 */
export async function createUserProfile(uid: string, userDoc: UserDoc): Promise<void> {
  return setDoc(doc(db, "users", uid), userDoc);
}

/**
 * Retrieves a user profile from Firestore
 * @param {string} uid - Unique user identifier (Auth0 sub)
 * @returns {Promise<UserDoc | undefined>} User document or undefined if not found
 */
export async function getUserProfile(uid: string): Promise<UserDoc | undefined> {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } as UserDoc : undefined;
}

// Email comes from the Auth0 account and is never editable from the app
export async function updateUserProfile(uid: string, data: Omit<Partial<UserDoc>, 'Email'>): Promise<void> {
  const { Email: _ignored, ...updates } = data as Partial<UserDoc>;
  return updateDoc(doc(db, "users", uid), updates);
}

// --- GROUPS ---

export async function createGroup(userId: string, group: Omit<GroupDoc, "ownerId" | "memberIds" | "createdAt">): Promise<string> {
  const groupRef = doc(collection(db, "groups"));
  const groupId = groupRef.id
  const now = new Date();
  const batch = writeBatch(db);
  batch.set(groupRef, {
    ...group,
    id: groupId,
    createdAt: now
  });
  const userRef = doc(db, "users", userId);
  batch.set(userRef, { Groups: arrayUnion(groupId) }, { merge: true });
  await batch.commit();
  return groupId;
}

export async function getUserGroups(userId: string): Promise<GroupDoc[]> {
  const groupsCol = collection(db, "groups");
  const q = query(groupsCol, where("MemberIds", "array-contains", userId));
  const snapshot = await getDocs(q);
  const groups: GroupDoc[] = [];
  snapshot.forEach(doc => {
    groups.push({ id: doc.id, ...doc.data() } as GroupDoc);
  });
  return groups;
}

export async function getGroupById(groupId: string): Promise<GroupDoc | undefined> {
  const snap = await getDoc(doc(db, "groups", groupId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as GroupDoc) : undefined;
}

/** Profiles for the given IDs, in the same order, skipping IDs with no profile. */
export async function getUsersByIds(userIds: string[]): Promise<UserDoc[]> {
  const uniqueIds = Array.from(new Set(userIds));
  const profiles = await getUserProfilesByIds(uniqueIds);
  return uniqueIds
    .map((uid) => profiles[uid])
    .filter((profile): profile is UserDoc => !!profile);
}

// Batched fetch for user profiles using documentId() and chunking (max 10 IDs per query)
export async function getUserProfilesByIds(userIds: string[]): Promise<Record<string, UserDoc | undefined>> {
  if (!userIds || userIds.length === 0) return {};
  const usersCol = collection(db, "users");
  const result: Record<string, UserDoc | undefined> = {};
  const chunkSize = 10; // Firestore limit for 'in' queries
  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize);
    const q = query(usersCol, where(documentId(), 'in', chunk));
    const snap = await getDocs(q);
    snap.forEach(d => {
      result[d.id] = { id: d.id, ...d.data() } as UserDoc;
    });
    // Any IDs not returned will remain undefined
  }
  return result;
}

// --- EVENTS ---
export async function createEvent(event: EventDoc) {
  const eventRef = doc(collection(db, "events"));
  const batch = writeBatch(db);
  
  // Create event document with the generated ID included
  // Destructure to exclude the id field and then add the generated ID
  const { id, ...eventWithoutId } = event;
  const eventWithId = {
    ...eventWithoutId,
    id: eventRef.id
  };
  batch.set(eventRef, eventWithId);

  // Pre-seed vote shards only if voting is enabled
  if (event.VotingEnabled !== false) {
    for (let i = 0; i < NUM_SHARDS; i++) {
      batch.set(doc(collection(eventRef, "voteShards"), i.toString()), {
        going: 0, maybe: 0, not: 0
      });
    }
  }
  await batch.commit();
  return eventRef.id;
}

export async function updateEvent(eventId: string, updates: Partial<EventDoc>) {
  return updateDoc(doc(db, "events", eventId), updates);
}

/** Deletes every document in a collection, in batches of up to 500 writes. */
async function deleteAllDocs(colRef: CollectionReference<DocumentData>) {
  const snap = await getDocs(colRef);
  for (let i = 0; i < snap.docs.length; i += 500) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 500).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

/** Deletes an event along with its vote shards and per-user votes. */
export async function deleteEvent(eventId: string) {
  await deleteAllDocs(collection(db, "events", eventId, "userVotes"));
  await deleteAllDocs(collection(db, "events", eventId, "voteShards"));
  await deleteDoc(doc(db, "events", eventId));
}

export async function getEvent(eventId: string) {
  const snap = await getDoc(doc(db, "events", eventId));
  return snap.exists() ? snap.data() : undefined;
}

// --- SHARDED VOTE SYSTEM ---

/** Each user's vote always lives in the same shard, so changing or removing it touches one doc. */
function getUserShard(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash) % NUM_SHARDS;
}

export async function castVote(eventId: string, status: keyof VoteShard, userId: string = 'default-user') {
  // First check if voting is enabled for this event
  const eventRef = doc(db, "events", eventId);
  const eventSnap = await getDoc(eventRef);
  
  if (!eventSnap.exists()) {
    throw new Error('Event not found');
  }
  
  const eventData = eventSnap.data();
  if (eventData.VotingEnabled === false) {
    throw new Error('Voting is not enabled for this event');
  }

  // Check if event has started (naturally or early)
  const eventStarted = hasEventStarted(eventData.EventDate);
  const startedEarly = eventData.StartedEarly === true;
  
  if (eventStarted || startedEarly) {
    throw new Error('Voting is closed because the event has started');
  }

  // Check if voting cutoff has passed
  if (eventData.CutoffDate) {
    const cutoffDate = new Date(eventData.CutoffDate.toDate ? eventData.CutoffDate.toDate() : eventData.CutoffDate);
    const now = new Date();
    if (now > cutoffDate) {
      throw new Error('Voting cutoff time has passed');
    }
  }

  // COMMENTED OUT FOR PERFORMANCE - Re-enable if needed
  // Check for time conflicts if user is voting 'going'
  // if (status === 'going') {
  //   const conflictCheck = await checkTimeConflict(eventId, userId);
  //   if (conflictCheck.hasConflict) {
  //     const conflictingEvent = conflictCheck.conflictingEvent;
  //     const conflictingDate = new Date(conflictingEvent.EventDate).toLocaleDateString();
  //     const conflictingTime = new Date(conflictingEvent.EventDate).toLocaleTimeString([], { 
  //       hour: '2-digit', 
  //       minute: '2-digit' 
  //     });
  //     throw new Error(`You cannot attend this event because it conflicts with "${conflictingEvent.Title}" on ${conflictingDate} at ${conflictingTime}. You can only attend one event at a time.`);
  //   }
  // }

  // Check if user has already voted
  const userVoteRef = doc(db, "events", eventId, "userVotes", userId);
  const userVoteSnap = await getDoc(userVoteRef);
  
  const batch = writeBatch(db);
  // Index the voter on the event so account deletion can always find this vote
  batch.update(eventRef, { VoterIds: arrayUnion(userId) });

  if (userVoteSnap.exists()) {
    // User has voted before - update their vote
    const previousVote = userVoteSnap.data()?.status;
    
    if (previousVote === status) {
      // Same vote - no change needed
      return;
    }
    
    // Use consistent shard for this user
    const userShard = getUserShard(userId);
    const shardRef = doc(db, "events", eventId, "voteShards", userShard.toString());
    
    // Update vote counts in single shard operation
    batch.update(shardRef, { 
      [previousVote]: increment(-1),
      [status]: increment(1)
    });
    
    // Update user's vote record
    batch.set(userVoteRef, {
      status,
      votedAt: new Date(),
      userId
    });
  } else {
    // First time voting - just add the vote
    const userShard = getUserShard(userId);
    const shardRef = doc(db, "events", eventId, "voteShards", userShard.toString());
    batch.update(shardRef, { [status]: increment(1) });
    
    // Record user's vote
    batch.set(userVoteRef, {
      status,
      votedAt: new Date(),
      userId
    });
  }
  
  await batch.commit();
}

export async function getUserVote(eventId: string, userId: string = 'default-user'): Promise<VoteStatus | null> {
  const userVoteRef = doc(db, "events", eventId, "userVotes", userId);
  const userVoteSnap = await getDoc(userVoteRef);
  
  if (userVoteSnap.exists()) {
    return userVoteSnap.data()?.status || null;
  }
  return null;
}

/** Every vote on an event, keyed by user ID (one read instead of one per user). */
export async function getEventVotes(eventId: string): Promise<Record<string, VoteStatus>> {
  const snap = await getDocs(collection(db, "events", eventId, "userVotes"));
  const votes: Record<string, VoteStatus> = {};
  snap.forEach((d) => {
    const data = d.data();
    if (data?.status) votes[data.userId ?? d.id] = data.status as VoteStatus;
  });
  return votes;
}

/** Removes a user's vote and takes it back out of the shard totals. */
export async function removeUserVote(eventId: string, userId: string): Promise<void> {
  const voteRef = doc(db, "events", eventId, "userVotes", userId);
  const voteSnap = await getDoc(voteRef);
  if (!voteSnap.exists()) return;
  const status = voteSnap.data()?.status;
  const batch = writeBatch(db);
  if (status) {
    batch.update(doc(db, "events", eventId, "voteShards", getUserShard(userId).toString()), { [status]: increment(-1) });
  }
  batch.delete(voteRef);
  batch.update(doc(db, "events", eventId), { VoterIds: arrayRemove(userId) });
  await batch.commit();
}

export function listenVoteCounts(
  eventId: string,
  callback: (totals: VoteShard) => void
) {
  return onSnapshot(collection(db, "events", eventId, "voteShards"), snap => {
    const totals = { going: 0, maybe: 0, not: 0 };
    snap.forEach(doc => {
      const v = doc.data() as VoteShard;
      totals.going += v.going || 0;
      totals.maybe += v.maybe || 0;
      totals.not += v.not || 0;
    });
    callback(totals);
  }, (error) => {
    // If vote shards don't exist (e.g., voting disabled), return zeros
    callback({ going: 0, maybe: 0, not: 0 });
  });
}

export async function getVoteCounts(eventId: string): Promise<VoteShard> {
  try {
    const snapshot = await getDocs(collection(db, "events", eventId, "voteShards"));
    const totals = { going: 0, maybe: 0, not: 0 };
    snapshot.forEach(doc => {
      const v = doc.data() as VoteShard;
      totals.going += v.going || 0;
      totals.maybe += v.maybe || 0;
      totals.not += v.not || 0;
    });
    return totals;
  } catch (error) {
    // If vote shards don't exist (e.g., voting disabled), return zeros
    return { going: 0, maybe: 0, not: 0 };
  }
}


// --- USER EVENTS ---

// Firestore allows at most 30 values in an array-contains-any filter
const ARRAY_CONTAINS_ANY_LIMIT = 30;

/**
 * Queries for the events a user can see: events for any of their groups, events they
 * were individually invited to, and events they created. Each uses a single-field index,
 * so only the user's own events are downloaded (not the whole collection).
 */
function userEventQueries(groupIds: string[], userId: string, includeHistory = false): Query<DocumentData>[] {
  const eventsCol = collection(db, "events");
  const queries: Query<DocumentData>[] = [
    query(eventsCol, where("IndividualParticipantIDs", "array-contains", userId)),
    query(eventsCol, where("CreatorID", "==", userId)),
  ];
  if (includeHistory) {
    // Events they voted on or attended, even in groups they've since left
    queries.push(query(eventsCol, where("VoterIds", "array-contains", userId)));
    queries.push(query(eventsCol, where("AttendeeIds", "array-contains", userId)));
  }
  const uniqueGroupIds = Array.from(new Set(groupIds.filter(Boolean)));
  for (let i = 0; i < uniqueGroupIds.length; i += ARRAY_CONTAINS_ANY_LIMIT) {
    queries.push(query(eventsCol, where("GroupIDs", "array-contains-any", uniqueGroupIds.slice(i, i + ARRAY_CONTAINS_ANY_LIMIT))));
  }
  return queries;
}

const toEventDoc = (id: string, data: DocumentData): EventDoc => ({ ...data, id } as EventDoc);

/**
 * One-off fetch of the events a user can see (see userEventQueries). With includeHistory, also
 * events they voted on or attended that they can no longer see (used by account deletion).
 */
export async function getUserEvents(groupIds: string[], userId: string, options: { includeHistory?: boolean } = {}): Promise<EventDoc[]> {
  const snaps = await Promise.all(userEventQueries(groupIds, userId, options.includeHistory).map((q) => getDocs(q)));
  const events = new Map<string, EventDoc>();
  snaps.forEach((snap) => snap.forEach((d) => { events.set(d.id, toEventDoc(d.id, d.data())); }));
  return Array.from(events.values());
}

/**
 * Live version of getUserEvents. Calls back with the merged, de-duplicated list once every
 * query has reported, then again on each change. Returns an unsubscribe function.
 */
export function listenUserEvents(groupIds: string[], userId: string, callback: (events: EventDoc[]) => void) {
  const queries = userEventQueries(groupIds, userId);
  const results: (Map<string, EventDoc> | undefined)[] = queries.map(() => undefined);

  const emit = () => {
    if (results.some((r) => r === undefined)) return;
    const merged = new Map<string, EventDoc>();
    results.forEach((r) => r!.forEach((evt, id) => merged.set(id, evt)));
    callback(Array.from(merged.values()));
  };

  const unsubscribes = queries.map((q, i) =>
    onSnapshot(q, (snap) => {
      const map = new Map<string, EventDoc>();
      snap.forEach((d) => { map.set(d.id, toEventDoc(d.id, d.data())); });
      results[i] = map;
      emit();
    }, (error) => {
      console.error('Event listener failed:', error);
      results[i] = new Map();
      emit();
    })
  );
  return () => unsubscribes.forEach((unsub) => unsub());
}

// --- MATCH HISTORY ---
export async function createMatchHistory(matchData: newMatchHistory) {
  const matchHistoryRef = doc(collection(db, "matchHistory"));
  const { id, ...matchDataWithoutId } = matchData;
  const matchDataWithId = {
    ...matchDataWithoutId,
    id: matchHistoryRef.id
  };
  return setDoc(matchHistoryRef, matchDataWithId);
}

export async function updateMatchHistory(
  matchId: string,
  updates: Partial<newMatchHistory>
) {
  const { id: _ignored, ...rest } = updates as Record<string, unknown>;
  return updateDoc(doc(db, "matchHistory", matchId), rest);
}

export async function getUserMatchHistory(userId: string): Promise<newMatchHistory[]> {
  const matchHistoryCol = collection(db, "matchHistory");
  // Query only documents where userId is in either team1 or team2
  const q = query(
    matchHistoryCol,
    or(
      where('team1', 'array-contains', userId),
      where('team2', 'array-contains', userId)
    )
  );
  const snapshot = await getDocs(q);
  const userMatches: newMatchHistory[] = snapshot.docs.map(d => {
    const data = d.data() as newMatchHistory;
    return { ...data, id: (data as any).id ?? d.id } as newMatchHistory;
  });
  
  // Sort by date (most recent first) with proper Firestore timestamp handling
  return userMatches.sort((a, b) => {
    let dateA: Date, dateB: Date;
    
    // Handle Firestore timestamps
    if (a.date && typeof a.date === 'object' && 'toDate' in a.date) {
      dateA = (a.date as any).toDate();
    } else {
      dateA = new Date(a.date);
    }
    
    if (b.date && typeof b.date === 'object' && 'toDate' in b.date) {
      dateB = (b.date as any).toDate();
    } else {
      dateB = new Date(b.date);
    }
    
    return dateB.getTime() - dateA.getTime(); // Most recent first
  });
}

// --- ATTENDANCE FUNCTIONS ---

// Update attendance records for an event
export async function updateAttendance(eventId: string, attendanceRecords: AttendanceRecord[]) {
  const eventRef = doc(db, "events", eventId);
  
  // Store only IDs and check-in state: names/emails are shown from profiles, and keeping copies
  // here would leave personal data behind after someone deletes their account
  const recordsWithTimestamps = attendanceRecords.map(record => ({
    userId: record.userId,
    votedStatus: record.votedStatus ?? null,
    hasArrived: record.hasArrived,
    arrivalTime: record.arrivalTime ? Timestamp.fromDate(record.arrivalTime) : null,
  }));

  await updateDoc(eventRef, {
    AttendanceRecords: recordsWithTimestamps,
    AttendeeIds: recordsWithTimestamps.map(record => record.userId),
  });
}

// Get attendance records for an event
export async function getAttendanceRecords(eventId: string): Promise<AttendanceRecord[]> {
  const eventRef = doc(db, "events", eventId);
  const eventSnap = await getDoc(eventRef);
  
  if (!eventSnap.exists()) {
    throw new Error('Event not found');
  }
  
  const eventData = eventSnap.data();
  const records = eventData.AttendanceRecords || [];
  
  // Convert Firestore timestamps back to Date objects
  return records.map((record: any) => ({
    ...record,
    arrivalTime: record.arrivalTime ? record.arrivalTime.toDate() : undefined
  }));
}

// Check if event has started (for showing attendance button)
export function hasEventStarted(eventDate: any): boolean {
  const now = new Date();
  let eventDateTime: Date;
  
  // Handle Firestore timestamps
  if (eventDate && typeof eventDate === 'object' && 'toDate' in eventDate) {
    eventDateTime = eventDate.toDate();
  } else {
    eventDateTime = new Date(eventDate);
  }
  
  return now >= eventDateTime;
}


// Add: fetch a single match by ID
export async function getMatchHistoryById(matchId: string): Promise<newMatchHistory | undefined> {
  const snap = await getDoc(doc(db, "matchHistory", matchId));
  return snap.exists() ? (snap.data() as newMatchHistory) : undefined;
}

export async function deleteMatchHistory(matchId: string) {
  return deleteDoc(doc(db, "matchHistory", matchId));
}

export async function createGroupInvite(groupInvite: GroupInviteDoc) {
  // Use the inviteCode as the document ID for easy retrieval
  const inviteRef = doc(db, "groupInvites", groupInvite.inviteCode);
  return setDoc(inviteRef, groupInvite);
}

export async function getGroupInvite(inviteCode: string): Promise<GroupInviteDoc | undefined> {
  // Direct document read using inviteCode as document ID
  const snap = await getDoc(doc(db, "groupInvites", inviteCode));
  return snap.exists() ? (snap.data() as GroupInviteDoc) : undefined;
}

export async function getGroupInvites(groupId: string): Promise<GroupInviteDoc[]> {
  const invitesCol = collection(db, "groupInvites");
  const q = query(invitesCol, where("groupId", "==", groupId));
  const snapshot = await getDocs(q);
  const invites: GroupInviteDoc[] = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    invites.push({
      ...data,
      // Firestore returns a Timestamp; new Date(Timestamp) is an Invalid Date
      validUntil: toDate(data.validUntil),
      id: doc.id
    } as GroupInviteDoc);
  });

  // Sort by validUntil date (most recent first)
  return invites.sort((a, b) => b.validUntil.getTime() - a.validUntil.getTime());
}

/** Converts a Firestore Timestamp, Date, string or millis value to a Date. */
export function toDate(value: unknown): Date {
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  if (value && typeof value === 'object' && typeof (value as { seconds?: unknown }).seconds === 'number') {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  return new Date(value as string | number | Date);
}


/**
 * Whether an invite can still be used to join `groupId`: not marked expired, not past
 * validUntil, and not out of uses. A non-numeric maxUses (older "unlimited" invites were
 * saved as NaN) means no limit.
 */
export function isInviteUsable(invite: GroupInviteDoc, groupId: string, now: Date = new Date()): boolean {
  if (invite.groupId !== groupId || invite.expired) return false;
  if (invite.validUntil && toDate(invite.validUntil) < now) return false;
  if (Number.isFinite(invite.maxUses) && invite.maxUses > 0 && (invite.used ?? 0) >= invite.maxUses) {
    return false;
  }
  return true;
}

export type JoinGroupResult = 'joined' | 'already_member' | 'group_not_found' | 'invite_unavailable';

/**
 * Adds a user to a group. When joining through an invite link, pass its code: the invite is
 * re-validated and its `used` count incremented in the same transaction as the membership
 * writes, so concurrent joins can't exceed maxUses.
 */
export async function addGroupMember(userId: string, groupId: string, inviteCode?: string): Promise<JoinGroupResult> {
  const groupRef = doc(db, "groups", groupId);
  const userRef = doc(db, "users", userId);
  const inviteRef = inviteCode ? doc(db, "groupInvites", inviteCode) : null;

  return runTransaction(db, async (transaction) => {
    // All reads must happen before any writes in a transaction
    const groupSnap = await transaction.get(groupRef);
    const inviteSnap = inviteRef ? await transaction.get(inviteRef) : null;

    if (!groupSnap.exists()) return 'group_not_found';
    const groupData = groupSnap.data() as GroupDoc;
    if (groupData.MemberIds?.includes(userId)) return 'already_member';

    if (inviteRef) {
      if (!inviteSnap?.exists() || !isInviteUsable(inviteSnap.data() as GroupInviteDoc, groupId)) {
        return 'invite_unavailable';
      }
      transaction.update(inviteRef, { used: increment(1) });
    }

    // Add userId to group's MemberIds array and groupId to user's Groups array (deduped)
    transaction.set(groupRef, { MemberIds: arrayUnion(userId) }, { merge: true });
    transaction.set(userRef, { Groups: arrayUnion(groupId) }, { merge: true });
    return 'joined';
  });
}

// --- GROUP MANAGEMENT ---

export async function updateGroup(groupId: string, updates: Partial<GroupDoc>): Promise<void> {
  return updateDoc(doc(db, "groups", groupId), updates);
}

export async function addGroupAdmin(groupId: string, userId: string): Promise<void> {
  return updateDoc(doc(db, "groups", groupId), { AdminIds: arrayUnion(userId) });
}

export async function removeGroupAdmin(groupId: string, userId: string): Promise<void> {
  return updateDoc(doc(db, "groups", groupId), { AdminIds: arrayRemove(userId) });
}

/** Drops a group from a user's Groups list. Uses update so a deleted user's doc isn't recreated. */
async function removeGroupFromUser(userId: string, groupId: string): Promise<void> {
  try {
    await updateDoc(doc(db, "users", userId), { Groups: arrayRemove(groupId) });
  } catch (error) {
    // The user doc may already be gone (e.g. deleted account); membership is tracked on the group
    console.warn('Could not update user groups:', error);
  }
}

/**
 * Removes a member (or admin) from a group, e.g. when they leave or are removed by the
 * owner/an admin. The owner can't be removed: they must delete the group instead.
 */
export async function removeGroupMember(groupId: string, userId: string): Promise<void> {
  const group = await getGroupById(groupId);
  if (!group) return;
  if (group.OwnerId === userId) {
    throw new Error('The group owner cannot be removed. Delete the group instead.');
  }
  await updateDoc(doc(db, "groups", groupId), { MemberIds: arrayRemove(userId), AdminIds: arrayRemove(userId) });
  await removeGroupFromUser(userId, groupId);
}

/** Deletes a group, its invite links, and the group from every member's Groups list. */
export async function deleteGroup(groupId: string): Promise<void> {
  const group = await getGroupById(groupId);
  if (!group) return;
  const invites = await getDocs(query(collection(db, "groupInvites"), where("groupId", "==", groupId)));
  for (let i = 0; i < invites.docs.length; i += 500) {
    const batch = writeBatch(db);
    invites.docs.slice(i, i + 500).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await deleteDoc(doc(db, "groups", groupId));
  await Promise.all((group.MemberIds ?? []).map((memberId) => removeGroupFromUser(memberId, groupId)));
}

// --- TEMPORARY USER OPERATIONS ---

/**
 * Writes a temporary user document into the users collection.
 * Caller is responsible for generating the uid (nanoid) and populating the doc
 * with isTemp, owners, and claimedBy fields.
 */
export async function createTempUser(userDoc: Omit<UserDoc, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, "users"), userDoc);
  return ref.id;
}

/**
 * Finds an unclaimed temp user by normalised email.
 * Returns undefined if no match or if email is empty.
 */
export async function findUnclaimedTempByEmail(email: string): Promise<UserDoc[]> {
  if (!email || !email.trim()) return [];
  const usersCol = collection(db, "users");
  const q = query(usersCol,
    where("isTemp", "==", true),
    where("claimedBy", "==", null),
    where("Email", "==", email.toLowerCase().trim())
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as UserDoc));
}

/**
 * Finds an unclaimed temp user by normalised phone (digits only).
 * Returns undefined if no match or if phone is empty.
 */
export async function findUnclaimedTempByPhone(phone: string): Promise<UserDoc[]> {
  const normalized = phone ? phone.replace(/\D/g, '') : '';
  if (!normalized) return [];
  const usersCol = collection(db, "users");
  const q = query(usersCol,
    where("isTemp", "==", true),
    where("claimedBy", "==", null),
    where("Phone", "==", normalized)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as UserDoc));
}

/**
 * Returns all unclaimed temp users owned by the given user.
 * Used to populate the player picker with temps the current user can reuse.
 */
export async function findUnclaimedTempsByOwner(ownerSub: string): Promise<UserDoc[]> {
  const usersCol = collection(db, "users");
  const q = query(usersCol,
    where("isTemp", "==", true),
    where("claimedBy", "==", null),
    where("owners", "array-contains", ownerSub)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as UserDoc));
}

/**
 * Appends an owner to a temp user's owners array (idempotent via arrayUnion).
 */
export async function addTempOwner(tempId: string, ownerSub: string): Promise<void> {
  return updateDoc(doc(db, "users", tempId), { owners: arrayUnion(ownerSub) });
}

/**
 * Marks a temp user as claimed by setting claimedBy to the real user's Auth0 sub.
 * The document is never deleted — it persists as an audit trail.
 */
export async function markTempClaimed(tempId: string, realSub: string): Promise<void> {
  return updateDoc(doc(db, "users", tempId), { claimedBy: realSub });
}

/**
 * Migrates all matchHistory references from oldId to newId.
 * Replaces oldId with newId in positions 0 and 1 of both team arrays (the player ID slots).
 * Idempotent: documents where oldId is already gone are skipped.
 * Returns the number of documents actually updated.
 */
export async function migrateMatchRefs(oldId: string, newId: string): Promise<number> {
  const matchCol = collection(db, "matchHistory");
  const q = query(matchCol, or(
    where('team1', 'array-contains', oldId),
    where('team2', 'array-contains', oldId)
  ));
  const snap = await getDocs(q);
  let updated = 0;
  for (const matchDoc of snap.docs) {
    const data = matchDoc.data();
    const team1 = [...(data.team1 || [])];
    const team2 = [...(data.team2 || [])];
    let changed = false;
    if (team1[0] === oldId) { team1[0] = newId; changed = true; }
    if (team1[1] === oldId) { team1[1] = newId; changed = true; }
    if (team2[0] === oldId) { team2[0] = newId; changed = true; }
    if (team2[1] === oldId) { team2[1] = newId; changed = true; }
    if (changed) {
      await updateDoc(doc(db, "matchHistory", matchDoc.id), { team1, team2 });
      updated++;
    }
  }
  return updated;
}

/**
 * Merges the absorbed temp user into the survivor:
 *   1. Rewrites all match references from absorbed → survivor
 *   2. Unions the absorbed temp's owners onto the survivor
 *   3. Marks the absorbed temp as claimed with a synthetic merge marker
 */
export async function mergeTempUsers(survivorId: string, absorbedId: string): Promise<void> {
  await migrateMatchRefs(absorbedId, survivorId);

  const absorbedSnap = await getDoc(doc(db, "users", absorbedId));
  if (absorbedSnap.exists()) {
    const absorbedOwners: string[] = absorbedSnap.data()?.owners || [];
    if (absorbedOwners.length > 0) {
      await updateDoc(doc(db, "users", survivorId), { owners: arrayUnion(...absorbedOwners) });
    }
  }

  await updateDoc(doc(db, "users", absorbedId), { claimedBy: `__merged:${survivorId}` });
}

// --- ACCOUNT DELETION ---

/**
 * Stands in for a deleted user in other people's match history. Screens fall back to showing
 * the player ID when there is no profile, so this reads naturally everywhere.
 */
export const DELETED_PLAYER_ID = 'Deleted player';

/**
 * Permanently deletes a user's account data (App Store 5.1.1(v) / Google Play account deletion):
 *   1. Groups: leaves every group. Owned groups pass to an admin (or the next member), or are
 *      deleted when nobody else is in them.
 *   2. Events: deletes events they created; elsewhere removes their RSVP, individual
 *      invitation and attendance record, including events in groups they left earlier (found
 *      through the VoterIds / AttendeeIds indexes).
 *   3. Matches: replaces their ID with DELETED_PLAYER_ID so other players keep their history.
 *   4. Temporary players: deletes ones only they managed (anonymising their matches too),
 *      leaves shared ones, and deletes claimed-temp records that hold their own email/phone.
 *   5. Deletes the profile last, so a failed run can simply be retried.
 *
 * Signing out of / deleting the Auth0 login is up to the caller.
 */
export async function deleteUserAccount(userId: string): Promise<void> {
  // 1. Groups
  const groups = await getUserGroups(userId);
  for (const group of groups) {
    const otherMembers = (group.MemberIds ?? []).filter((id) => id !== userId);
    if (group.OwnerId === userId) {
      if (otherMembers.length === 0) {
        await deleteGroup(group.id);
        continue;
      }
      const newOwner = (group.AdminIds ?? []).find((id) => otherMembers.includes(id)) ?? otherMembers[0];
      await updateDoc(doc(db, "groups", group.id), {
        OwnerId: newOwner,
        MemberIds: arrayRemove(userId),
        // The new owner doesn't also need to be listed as an admin
        AdminIds: arrayRemove(userId, newOwner),
      });
    } else {
      await updateDoc(doc(db, "groups", group.id), { MemberIds: arrayRemove(userId), AdminIds: arrayRemove(userId) });
    }
  }

  // 2. Events: ones they can see, plus any they voted on or attended in groups they left earlier
  const events = await getUserEvents(groups.map((g) => g.id), userId, { includeHistory: true });
  for (const event of events) {
    if (event.CreatorID === userId) {
      await deleteEvent(event.id);
      continue;
    }
    await removeUserVote(event.id, userId);
    const updates: DocumentData = {};
    if (event.IndividualParticipantIDs?.includes(userId)) {
      updates.IndividualParticipantIDs = arrayRemove(userId);
    }
    if (event.AttendanceRecords?.some((r) => r.userId === userId)) {
      updates.AttendanceRecords = event.AttendanceRecords.filter((r) => r.userId !== userId);
    }
    if (event.AttendeeIds?.includes(userId)) {
      updates.AttendeeIds = arrayRemove(userId);
    }
    if (Object.keys(updates).length > 0) {
      await updateDoc(doc(db, "events", event.id), updates);
    }
  }

  // 3. Matches
  await migrateMatchRefs(userId, DELETED_PLAYER_ID);

  // 4. Temporary players
  const ownedTemps = await getDocs(query(collection(db, "users"), where("owners", "array-contains", userId)));
  for (const tempDoc of ownedTemps.docs) {
    const temp = tempDoc.data() as UserDoc;
    const otherOwners = (temp.owners ?? []).filter((id) => id !== userId);
    if (otherOwners.length === 0 && !temp.claimedBy) {
      await migrateMatchRefs(tempDoc.id, DELETED_PLAYER_ID);
      await deleteDoc(tempDoc.ref);
    } else {
      await updateDoc(tempDoc.ref, { owners: arrayRemove(userId) });
    }
  }
  const claimedTemps = await getDocs(query(collection(db, "users"), where("claimedBy", "==", userId)));
  for (const tempDoc of claimedTemps.docs) {
    await deleteDoc(tempDoc.ref);
  }

  // 5. Profile
  await deleteDoc(doc(db, "users", userId));
}

/**
 * Shared detection helper: finds all unclaimed temp users whose Email or Phone
 * matches the given values. Deduplicates by ID (both queries may return the same doc).
 * Used by the login / signup flow to decide whether to show the claiming screen.
 */
export async function checkForClaimableTemps(email: string, phone: string): Promise<UserDoc[]> {
  const [byEmail, byPhone] = await Promise.all([
    findUnclaimedTempByEmail(email),
    findUnclaimedTempByPhone(phone),
  ]);
  const seen = new Set<string>();
  const results: UserDoc[] = [];
  for (const tempDoc of [...byEmail, ...byPhone]) {
    if (!seen.has(tempDoc.id)) {
      seen.add(tempDoc.id);
      results.push(tempDoc);
    }
  }
  return results;
}
