// services/firestore.ts
import {
  getFirestore, collection, doc, setDoc, getDoc, updateDoc, writeBatch, onSnapshot,
  increment, CollectionReference, QueryDocumentSnapshot, DocumentData, getDocs, query, where,
} from "firebase/firestore";
import { db } from "./index";
import { UserDoc, GroupDoc, EventDoc, VoteShard, VoteStatus } from "./types_index";

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

// --- GROUPS ---
import { v4 as uuidv4 } from 'uuid';

export async function createGroup(userId: string, group: Omit<GroupDoc, "ownerId" | "memberIds" | "createdAt">) {
  const groupId = uuidv4();
  const groupRef = doc(db, "groups", groupId);
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
  batch.set(eventRef, event);

  // Pre-seed vote shards
  for (let i = 0; i < NUM_SHARDS; i++) {
    batch.set(doc(collection(eventRef, "voteShards"), i.toString()), {
      going: 0, maybe: 0, not: 0
    });
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

// --- SHARDED VOTE SYSTEM ---
export async function castVote(eventId: string, status: keyof VoteShard, userId: string = 'default-user') {
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
  });
}

export async function getVoteCounts(eventId: string): Promise<VoteShard> {
  const snapshot = await getDocs(collection(db, "events", eventId, "voteShards"));
  const totals = { going: 0, maybe: 0, not: 0 };
  snapshot.forEach(doc => {
    const v = doc.data() as VoteShard;
    totals.going += v.going || 0;
    totals.maybe += v.maybe || 0;
    totals.not += v.not || 0;
  });
  return totals;
}

// --- REAL-TIME EVENT LISTENER ---
export function listenGroupEvents(groupId: string, callback: (events: EventDoc[]) => void) {
  const eventsCol = collection(db, "events");
  return onSnapshot(eventsCol, snap => {
    const result: EventDoc[] = [];
    snap.forEach(doc => {
      const evt = doc.data();
      if (evt.GroupID === groupId) {
        result.push({ 
          id: doc.id, 
          GroupID: evt.GroupID,
          Title: evt.Title,
          EventDate: evt.EventDate,
          Location: evt.Location,
          CutoffDate: evt.CutoffDate,
          CreatorID: evt.CreatorID
        } as EventDoc);
      }
    });
    callback(result);
  });
}
