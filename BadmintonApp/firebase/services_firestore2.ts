/**
 * @fileoverview Firebase Firestore Services
 * 
 * Service layer providing all database operations for the Badminton App including
 * user management, group operations, event CRUD, voting system, and attendance tracking.
 */

// services/firestore.ts
import {
  getFirestore, collection, doc, setDoc, getDoc, updateDoc, writeBatch, onSnapshot,
  increment, CollectionReference, QueryDocumentSnapshot, DocumentData, getDocs, query, where,
  Timestamp, deleteDoc,
} from "firebase/firestore";
import { db, storage} from "./index";
import { UserDoc, GroupDoc, EventDoc, VoteShard, VoteStatus, newMatchHistory, AttendanceRecord, GroupInviteDoc } from "./types_index";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

/**
 * Number of shards used for distributed vote counting to ensure scalability
 */
const NUM_SHARDS = 10;

// --- STORAGE ---
// Alternative: Convert image to Base64 for Firestore storage
export async function imageToBase64(uri: string): Promise<string> {
  try {
    console.log('Converting image to Base64...');
    const response = await fetch(uri);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        console.log('Image converted to Base64, size:', base64.length);
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting image to Base64:', error);
    throw error;
  }
}

// Test function to verify Firebase Storage connectivity
export async function testStorageConnection(): Promise<boolean> {
  try {
    console.log('Testing Firebase Storage connection...');
    console.log('Storage bucket:', storage.app.options.storageBucket);
    
    // Try to create a simple test file
    const testRef = ref(storage, 'test-connection.txt');
    const testBlob = new Blob(['test'], { type: 'text/plain' });
    
    await uploadBytes(testRef, testBlob);
    console.log('Storage connection test successful');
    
    // Clean up test file
    try {
      await deleteObject(testRef);
      console.log('Test file cleaned up');
    } catch (cleanupError) {
      console.log('Cleanup failed (not critical):', cleanupError);
    }
    
    return true;
  } catch (error) {
    console.error('Storage connection test failed:', error);
    return false;
  }
}
export async function uploadImage(uri: string, path: string): Promise<string> {
  try {
    console.log('Starting image upload for URI:', uri);
    console.log('Upload path:', path);
    
    // For React Native, we need to handle file URIs differently
    // Convert URI to blob with proper error handling
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    
    const blob = await response.blob();
    console.log('Blob created, size:', blob.size);
    
    // Create storage reference
    const storageRef = ref(storage, path);
    
    // Upload blob with metadata
    const metadata = {
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=31536000', // Cache for 1 year
    };
    
    console.log('Uploading to Firebase Storage...');
    console.log('Storage bucket:', storage.app.options.storageBucket);
    
    // Try upload with retry logic
    let uploadResult;
    try {
      uploadResult = await uploadBytes(storageRef, blob, metadata);
      console.log('Upload completed successfully');
    } catch (uploadError) {
      console.error('Upload failed, trying alternative approach:', uploadError);
      
      // Alternative: Try without metadata
      uploadResult = await uploadBytes(storageRef, blob);
      console.log('Upload completed with alternative approach');
    }
    
    // Get download URL
    const downloadURL = await getDownloadURL(storageRef);
    console.log('Download URL obtained:', downloadURL);
    return downloadURL;
  } catch (error) {
    console.error('Error uploading image:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      code: (error as any)?.code,
      serverResponse: (error as any)?.serverResponse
    });
    
    // Provide more specific error information
    if (error instanceof Error) {
      if (error.message.includes('storage/unauthorized')) {
        throw new Error('Storage access denied. Please check your authentication and storage rules.');
      } else if (error.message.includes('storage/quota-exceeded')) {
        throw new Error('Storage quota exceeded. Please try a smaller image.');
      } else if (error.message.includes('storage/unauthenticated')) {
        throw new Error('User not authenticated. Please log in again.');
      }
    }
    
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
  return snap.exists() ? (snap.data() as UserDoc) : undefined;
}

export async function updateUserProfile(uid: string, data: Partial<UserDoc>): Promise<void> {
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

export async function getUsersByIds(userIds: string[]): Promise<UserDoc[]> {
  const users: UserDoc[] = [];
  for (const uid of userIds) {
    const profile = await getUserProfile(uid);
    if (profile) users.push(profile);
  }
  return users;
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

// DEPRECATED: This function is too slow - queries all events and all votes
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

// OPTIMIZED: Future implementation could use indexed queries
// async function getUserGoingEventsOptimized(userId: string): Promise<any[]> {
//   // This would require a composite index on (userId, status) in userVotes subcollection
//   // and would be much faster than the current implementation
//   return [];
// }

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
  
  // Use consistent shard selection based on userId for better performance
  const getUserShard = (userId: string) => {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % NUM_SHARDS;
  };
  
  const batch = writeBatch(db);
  
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
          TotalCost: evt.TotalCost,
          CutoffDate: evt.CutoffDate,
          CreatorID: evt.CreatorID,
          VotingEnabled: evt.VotingEnabled
        } as EventDoc);
      }
    });
    callback(result);
  });
}

export function listenUserGroupEvents(userGroupIds: string[], userId: string, callback: (events: EventDoc[]) => void) {
  const eventsCol = collection(db, "events");
  return onSnapshot(eventsCol, snap => {
    const result: EventDoc[] = [];
    snap.forEach(doc => {
      const evt = doc.data();
      // Check if user is in any of the groups OR is an individual participant
      const isInGroup = evt.GroupIDs && evt.GroupIDs.some((groupId: string) => userGroupIds.includes(groupId));
      const isIndividualParticipant = evt.IndividualParticipantIDs && evt.IndividualParticipantIDs.includes(userId);
      
      if (isInGroup || isIndividualParticipant) {
        result.push({ 
          id: doc.id, 
          GroupIDs: evt.GroupIDs,
          IndividualParticipantIDs: evt.IndividualParticipantIDs,
          Title: evt.Title,
          EventDate: evt.EventDate,
          Location: evt.Location,
          TotalCost: evt.TotalCost,
          CutoffDate: evt.CutoffDate,
          CreatorID: evt.CreatorID,
          VotingEnabled: evt.VotingEnabled
        } as EventDoc);
      }
    });
    callback(result);
  });
}

export function listenAllEvents(userId: string, callback: (events: EventDoc[]) => void) {
  const eventsCol = collection(db, "events");
  return onSnapshot(eventsCol, snap => {
    const result: EventDoc[] = [];
    snap.forEach(doc => {
      const evt = doc.data();
      // Check if user is an individual participant or the creator
      const isIndividualParticipant = evt.IndividualParticipantIDs && evt.IndividualParticipantIDs.includes(userId);
      const isCreator = evt.CreatorID === userId;
      
      if (isIndividualParticipant || isCreator) {
        result.push({ 
          id: doc.id, 
          GroupIDs: evt.GroupIDs,
          IndividualParticipantIDs: evt.IndividualParticipantIDs,
          Title: evt.Title,
          EventDate: evt.EventDate,
          Location: evt.Location,
          TotalCost: evt.TotalCost,
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
  const { id, ...matchDataWithoutId } = matchData;
  const matchDataWithId = {
    ...matchDataWithoutId,
    id: matchHistoryRef.id
  };
  return setDoc(matchHistoryRef, matchDataWithId);
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
  const inviteRef = doc(collection(db, "groupInvites"));
  return setDoc(inviteRef, groupInvite);
}

export async function getGroupInvite(inviteCode: string): Promise<GroupInviteDoc | undefined> {
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
      id: doc.id
    } as GroupInviteDoc);
  });
  
  // Sort by validUntil date (most recent first)
  return invites.sort((a, b) => {
    const dateA = new Date(a.validUntil);
    const dateB = new Date(b.validUntil);
    return dateB.getTime() - dateA.getTime();
  });
}


export async function addGroupMember(userId: string, groupId: string){
  const groupRef = doc(db, "groups", groupId);
  const groupSnap = await getDoc(groupRef);
  if (!groupSnap.exists()) {
    return;
  }
  const groupData = groupSnap.data() as GroupDoc;
  
  // Check if user is already a member
  if (groupData.MemberIds && groupData.MemberIds.includes(userId)) {
    return false; // User is already a member
  }
  
  const batch = writeBatch(db);
  
  // Add userId to group's MemberIds array
  batch.update(groupRef, {
    MemberIds: [...(groupData.MemberIds || []), userId]
  });
  
  // Add groupId to user's Groups array
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const userData = userSnap.data() as UserDoc;
    batch.update(userRef, {
      Groups: [...(userData.Groups || []), groupId]
    });
  }
  
  await batch.commit();
}
