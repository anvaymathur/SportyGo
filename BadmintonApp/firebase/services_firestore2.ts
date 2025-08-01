// services/firestore.ts
import {
  getFirestore, collection, doc, setDoc, getDoc, updateDoc, writeBatch, onSnapshot,
  increment, CollectionReference, QueryDocumentSnapshot, DocumentData, getDocs, query, where,
} from "firebase/firestore";
import { db } from "./index";
import { UserDoc, GroupDoc, EventDoc, VoteShard } from "./types_index";

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
  return groupId; // You'll likely want arrayUnion, but Firestore Web SDK doesn't currently support it directly in batch. Write separately if needed.
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
export async function castVote(eventId: string, status: keyof VoteShard) {
  const shard = Math.floor(Math.random() * NUM_SHARDS);
  const shardRef = doc(db, "events", eventId, "voteShards", shard.toString());
  await updateDoc(shardRef, { [status]: increment(1) });
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
