// services/firestore.ts
import {
  getFirestore, collection, doc, setDoc, getDoc, updateDoc, writeBatch, onSnapshot,
  increment, CollectionReference, QueryDocumentSnapshot, DocumentData, getDocs, query, where,
  Timestamp,
} from "firebase/firestore";
import { db } from "./index";
import { UserDoc, GroupDoc, EventDoc, VoteShard, VoteStatus, newMatchHistory, AttendanceRecord } from "./types_index";

const NUM_SHARDS = 10;

// --- USERS ---
export async function createUserProfile(uid: string, userDoc: UserDoc) {
  return setDoc(doc(db, "users", uid), userDoc);
}

export async function getUserProfile(uid: string): Promise<UserDoc | undefined> {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data() as UserDoc) : undefined;
}

export async function updateUserProfile(uid: string, data: Partial<UserDoc>) {
  return updateDoc(doc(db, "users", uid), data);
}

export async function getAllUserProfiles(): Promise<UserDoc[]> {
  const usersCol = collection(db, "users");
  const snapshot = await getDocs(usersCol);
  const users: UserDoc[] = [];
  snapshot.forEach(doc => {
    users.push({ id: doc.id, ...doc.data() } as UserDoc);
  });
  return users;
}

export async function getEventUserProfiles(eventId: string): Promise<UserDoc[]> {
  // First get the event to find users who voted
  const eventSnap = await getDoc(doc(db, "events", eventId));
  if (!eventSnap.exists()) {
    return [];
  }

  // Get all user votes for this event
  const userVotesCol = collection(db, "events", eventId, "userVotes");
  const userVotesSnapshot = await getDocs(userVotesCol);
  
  // Extract user IDs from votes where status is "going" (yes)
  const userIds = new Set<string>();
  userVotesSnapshot.forEach(doc => {
    const voteData = doc.data();
    if (voteData.userId && voteData.status === "going") {
      userIds.add(voteData.userId);
    }
  });

  // Get user profiles for all users who voted "going"
  const users: UserDoc[] = [];
  for (const userId of userIds) {
    const userProfile = await getUserProfile(userId);
    if (userProfile) {
      users.push(userProfile);
    }
  }

  return users;
}

// --- GROUPS ---
import { v4 as uuidv4 } from 'uuid';

export async function createGroup(userId: string, group: Omit<GroupDoc, "ownerId" | "memberIds" | "createdAt">) {
  const groupRef = doc(collection(db, "groups"));
  const groupId = groupRef.id
  const now = new Date();
  const batch = writeBatch(db);
  batch.set(groupRef, {
    ...group,
    ownerId: userId,
    memberIds: [userId],
    createdAt: now
  });
  batch.update(doc(db, "users", userId), {
    groups: incrementOrPushToArray(groupId)
  });
  await batch.commit();
  return groupId;
}

export async function getGroups(): Promise<GroupDoc[]> {
  const groupsCol = collection(db, "groups");
  const snapshot = await getDocs(groupsCol);
  const groups: GroupDoc[] = [];
  snapshot.forEach(doc => {
    groups.push({ id: doc.id, ...doc.data() } as GroupDoc);
  });
  return groups;
}

export async function getUserGroups(userId: string): Promise<GroupDoc[]> {
  const groupsCol = collection(db, "groups");
  const q = query(groupsCol, where("memberIds", "array-contains", userId));
  const snapshot = await getDocs(q);
  const groups: GroupDoc[] = [];
  snapshot.forEach(doc => {
    groups.push({ id: doc.id, ...doc.data() } as GroupDoc);
  });
  return groups;
}

function incrementOrPushToArray(groupId: string) {
  // This is a placeholder. In a real implementation, you'd use arrayUnion
  // For now, we'll handle group membership separately if needed
  return groupId;
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

export async function deleteEvent(eventId: string) {
  return setDoc(doc(db, "events", eventId), {}); // or use deleteDoc
}

export async function getEvent(eventId: string) {
  const snap = await getDoc(doc(db, "events", eventId));
  return snap.exists() ? snap.data() : undefined;
}

// --- HELPER FUNCTIONS ---

// Check if two events overlap in time
function eventsOverlap(event1: any, event2: any): boolean {
  const start1 = new Date(event1.EventDate);
  const start2 = new Date(event2.EventDate);
  
  // Assume events last 2 hours by default (can be made configurable)
  const duration = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
  const end1 = new Date(start1.getTime() + duration);
  const end2 = new Date(start2.getTime() + duration);
  
  // Check if events overlap
  return start1 < end2 && start2 < end1;
}

// Get all events where user has voted 'going'
async function getUserGoingEvents(userId: string): Promise<any[]> {
  const eventsCol = collection(db, "events");
  const snapshot = await getDocs(eventsCol);
  const userEvents: any[] = [];
  
  for (const eventDoc of snapshot.docs) {
    const eventData = eventDoc.data();
    const userVote = await getUserVote(eventDoc.id, userId);
    
    if (userVote === 'going') {
      userEvents.push({
        id: eventDoc.id,
        ...eventData
      });
    }
  }
  
  return userEvents;
}

// Check if voting for this event would conflict with user's existing 'going' votes
async function checkTimeConflict(eventId: string, userId: string): Promise<{ hasConflict: boolean; conflictingEvent?: any }> {
  const currentEventRef = doc(db, "events", eventId);
  const currentEventSnap = await getDoc(currentEventRef);
  
  if (!currentEventSnap.exists()) {
    throw new Error('Event not found');
  }
  
  const currentEvent = currentEventSnap.data();
  const userGoingEvents = await getUserGoingEvents(userId);
  
  // Check for conflicts with existing 'going' votes
  for (const userEvent of userGoingEvents) {
    if (userEvent.id !== eventId && eventsOverlap(currentEvent, userEvent)) {
      return {
        hasConflict: true,
        conflictingEvent: userEvent
      };
    }
  }
  
  return { hasConflict: false };
}

// --- SHARDED VOTE SYSTEM ---
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

  // Check for time conflicts if user is voting 'going'
  if (status === 'going') {
    const conflictCheck = await checkTimeConflict(eventId, userId);
    if (conflictCheck.hasConflict) {
      const conflictingEvent = conflictCheck.conflictingEvent;
      const conflictingDate = new Date(conflictingEvent.EventDate).toLocaleDateString();
      const conflictingTime = new Date(conflictingEvent.EventDate).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      throw new Error(`You cannot attend this event because it conflicts with "${conflictingEvent.Title}" on ${conflictingDate} at ${conflictingTime}. You can only attend one event at a time.`);
    }
  }

  // Check if user has already voted
  const userVoteRef = doc(db, "events", eventId, "userVotes", userId);
  const userVoteSnap = await getDoc(userVoteRef);
  
  const batch = writeBatch(db);
  
  if (userVoteSnap.exists()) {
    // User has voted before - update their vote
    const previousVote = userVoteSnap.data()?.status;
    
    if (previousVote === status) {
      // Same vote - no change needed
      return;
    }
    
    // Remove previous vote from shards
    const prevShard = Math.floor(Math.random() * NUM_SHARDS);
    const prevShardRef = doc(db, "events", eventId, "voteShards", prevShard.toString());
    batch.update(prevShardRef, { [previousVote]: increment(-1) });
    
    // Add new vote to shards
    const newShard = Math.floor(Math.random() * NUM_SHARDS);
    const newShardRef = doc(db, "events", eventId, "voteShards", newShard.toString());
    batch.update(newShardRef, { [status]: increment(1) });
    
    // Update user's vote record
    batch.set(userVoteRef, {
      status,
      votedAt: new Date(),
      userId
    });
  } else {
    // First time voting - just add the vote
    const shard = Math.floor(Math.random() * NUM_SHARDS);
    const shardRef = doc(db, "events", eventId, "voteShards", shard.toString());
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
    console.log('No vote shards found for event:', eventId);
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
    console.log('No vote shards found for event:', eventId);
    return { going: 0, maybe: 0, not: 0 };
  }
}


// --- REAL-TIME EVENT LISTENER ---
export function listenGroupEvents(groupId: string, callback: (events: EventDoc[]) => void) {
  const eventsCol = collection(db, "events");
  return onSnapshot(eventsCol, snap => {
    const result: EventDoc[] = [];
    snap.forEach(doc => {
      const evt = doc.data();
      // Check if the event has the group in its GroupIDs array
      if (evt.GroupIDs && evt.GroupIDs.includes(groupId)) {
        result.push({ 
          id: doc.id, 
          GroupIDs: evt.GroupIDs,
          IndividualParticipantIDs: evt.IndividualParticipantIDs,
          Title: evt.Title,
          EventDate: evt.EventDate,
          Location: evt.Location,
          CutoffDate: evt.CutoffDate,
          CreatorID: evt.CreatorID,
          VotingEnabled: evt.VotingEnabled
        } as EventDoc);
      }
    });
    callback(result);
  });
}

export function listenUserGroupEvents(userGroupIds: string[], callback: (events: EventDoc[]) => void) {
  const eventsCol = collection(db, "events");
  return onSnapshot(eventsCol, snap => {
    const result: EventDoc[] = [];
    snap.forEach(doc => {
      const evt = doc.data();
      // Check if user is in any of the groups OR is an individual participant
      const isInGroup = evt.GroupIDs && evt.GroupIDs.some((groupId: string) => userGroupIds.includes(groupId));
      const isIndividualParticipant = evt.IndividualParticipantIDs && evt.IndividualParticipantIDs.some((userId: string) => userGroupIds.includes(userId));
      
      if (isInGroup || isIndividualParticipant) {
        result.push({ 
          id: doc.id, 
          GroupIDs: evt.GroupIDs,
          IndividualParticipantIDs: evt.IndividualParticipantIDs,
          Title: evt.Title,
          EventDate: evt.EventDate,
          Location: evt.Location,
          CutoffDate: evt.CutoffDate,
          CreatorID: evt.CreatorID,
          VotingEnabled: evt.VotingEnabled
        } as EventDoc);
      }
    });
    callback(result);
  });
}

// --- MATCH HISTORY ---
export async function createMatchHistory(matchData: newMatchHistory) {
  const matchHistoryRef = doc(collection(db, "matchHistory"));
  return setDoc(matchHistoryRef, matchData);
}

export async function getUserMatchHistory(userId: string): Promise<newMatchHistory[]> {
  const matchHistoryCol = collection(db, "matchHistory");
  const snapshot = await getDocs(matchHistoryCol);
  const userMatches: newMatchHistory[] = [];
  snapshot.forEach(doc => {
    const matchData = doc.data() as newMatchHistory;
    // Check if user participated in either team
    const isInTeam1 = matchData.team1[0] === userId || matchData.team1[1] === userId;
    const isInTeam2 = matchData.team2[0] === userId || matchData.team2[1] === userId;
    if (isInTeam1 || isInTeam2) {
      userMatches.push(matchData);
    }
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
  
  // Convert dates to Firestore timestamps
  const recordsWithTimestamps = attendanceRecords.map(record => ({
    ...record,
    arrivalTime: record.arrivalTime ? Timestamp.fromDate(record.arrivalTime) : undefined
  }));

  await updateDoc(eventRef, {
    AttendanceRecords: recordsWithTimestamps
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
export function hasEventStarted(eventDate: Date): boolean {
  const now = new Date();
  const eventDateTime = new Date(eventDate);
  return now >= eventDateTime;
}


