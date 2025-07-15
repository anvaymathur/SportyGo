// services/firestore.ts

import { v4 as uuidv4 } from 'uuid';
import {
  UserDoc,
  GroupDoc,
  EventDoc,
  VoteDoc,
  VoteStatus,
  VoteShard,
  CreateGroupData,
  CreateEventData,
  UpdateEventData,
} from "./types_index"
import { db } from '.';
import { collection, addDoc } from "firebase/firestore"; 

// Constants
const NUM_SHARDS = 10;

// Helper: Get Firestore references
const usersRef = db.collection('users');
const groupsRef = db.collection('groups');
const eventsRef = db.collection('events');

// USERS
export const createUserProfile = async (user: Partial<User>): Promise<void> => {
  await usersRef.doc(user.id).set({
    ...user,
    createdAt: firestore.FieldValue.serverTimestamp(),
  });
};

export const getUserProfile = async (userId: string): Promise<User | null> => {
  const doc = await usersRef.doc(userId).get();
  return doc.exists ? (doc.data() as User) : null;
};

export const updateUserProfile = async (userId: string, data: Partial<User>): Promise<void> => {
  await usersRef.doc(userId).update(data);
};

// GROUPS
export const createGroup = async (ownerId: string, data: CreateGroupData): Promise<string> => {
  const id = uuidv4();
  await groupsRef.doc(id).set({
    id,
    ownerId,
    memberIds: [ownerId],
    createdAt: firestore.FieldValue.serverTimestamp(),
    updatedAt: firestore.FieldValue.serverTimestamp(),
    ...data,
  });
  // Update user's group list
  await usersRef.doc(ownerId).update({
    groups: firestore.FieldValue.arrayUnion(id),
  });
  return id;
};

export const addUserToGroup = async (groupId: string, userId: string): Promise<void> => {
  const groupDoc = groupsRef.doc(groupId);
  await firestore().runTransaction(async (transaction) => {
    const groupSnap = await transaction.get(groupDoc);
    if (!groupSnap.exists) throw new Error('Group not found');
    const memberIds = groupSnap.data()?.memberIds || [];
    if (!memberIds.includes(userId)) {
      transaction.update(groupDoc, {
        memberIds: firestore.FieldValue.arrayUnion(userId),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    }
    // Update user document
    const userDoc = usersRef.doc(userId);
    transaction.update(userDoc, {
      groups: firestore.FieldValue.arrayUnion(groupId),
    });
  });
};

export const removeUserFromGroup = async (groupId: string, userId: string): Promise<void> => {
  const groupDoc = groupsRef.doc(groupId);
  await firestore().runTransaction(async (transaction) => {
    const groupSnap = await transaction.get(groupDoc);
    if (!groupSnap.exists) throw new Error('Group not found');
    transaction.update(groupDoc, {
      memberIds: firestore.FieldValue.arrayRemove(userId),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
    const userDoc = usersRef.doc(userId);
    transaction.update(userDoc, {
      groups: firestore.FieldValue.arrayRemove(groupId),
    });
  });
};

export const getGroup = async (groupId: string): Promise<Group | null> => {
  const doc = await groupsRef.doc(groupId).get();
  return doc.exists ? (doc.data() as Group) : null;
};

export const listenToGroup = (groupId: string, callback: (group: Group | null) => void) => {
  return groupsRef.doc(groupId).onSnapshot((doc) => {
    callback(doc.exists ? (doc.data() as Group) : null);
  });
};

// EVENTS
export const createEvent = async (creatorId: string, data: CreateEventData): Promise<string> => {
  const id = uuidv4();
  await eventsRef.doc(id).set({
    id,
    creatorId,
    createdAt: firestore.FieldValue.serverTimestamp(),
    updatedAt: firestore.FieldValue.serverTimestamp(),
    ...data,
  });
  // Create sharded counter for votes
  const shardsRef = eventsRef.doc(id).collection('voteShards');
  const batch = firestore().batch();
  for (let i = 0; i < NUM_SHARDS; i++) {
    batch.set(shardsRef.doc(i.toString()), { going: 0, maybe: 0, not: 0 });
  }
  await batch.commit();
  return id;
};

export const updateEvent = async (eventId: string, data: UpdateEventData): Promise<void> => {
  await eventsRef.doc(eventId).update({
    ...data,
    updatedAt: firestore.FieldValue.serverTimestamp(),
  });
};

export const deleteEvent = async (eventId: string): Promise<void> => {
  await eventsRef.doc(eventId).delete();
};

export const getEvent = async (eventId: string): Promise<Event | null> => {
  const doc = await eventsRef.doc(eventId).get();
  return doc.exists ? (doc.data() as Event) : null;
};

export const listenToEvent = (eventId: string, callback: (event: Event | null) => void) => {
  return eventsRef.doc(eventId).onSnapshot((doc) => {
    callback(doc.exists ? (doc.data() as Event) : null);
  });
};

// VOTES
export const castVote = async (
  eventId: string,
  userId: string,
  status: VoteStatus,
): Promise<void> => {
  const voteRef = eventsRef.doc(eventId).collection('votes').doc(userId);

  // Update shard counter
  const shardId = Math.floor(Math.random() * NUM_SHARDS).toString();
  const shardRef = eventsRef
    .doc(eventId)
    .collection('voteShards')
    .doc(shardId);

  await firestore().runTransaction(async (transaction) => {
    // Update individual vote doc
    transaction.set(voteRef, {
      status,
      votedAt: firestore.FieldValue.serverTimestamp(),
    });

    // Increment appropriate count in shard
    const incField: Record<string, number> = {
      going: 0,
      maybe: 0,
      not: 0,
    };
    incField[status] = 1;

    transaction.update(shardRef, {
      [status]: firestore.FieldValue.increment(1),
    });
  });
};

export const removeVote = async (eventId: string, userId: string): Promise<void> => {
  const voteRef = eventsRef.doc(eventId).collection('votes').doc(userId);
  const voteDoc = await voteRef.get();
  if (!voteDoc.exists) return;
  const { status } = voteDoc.data() as Vote;

  // Update shard counter
  const shardId = Math.floor(Math.random() * NUM_SHARDS).toString();
  const shardRef = eventsRef
    .doc(eventId)
    .collection('voteShards')
    .doc(shardId);

  await firestore().runTransaction(async (transaction) => {
    transaction.delete(voteRef);
    transaction.update(shardRef, {
      [status]: firestore.FieldValue.increment(-1),
    });
  });
};

export const listenToVotes = (
  eventId: string,
  callback: (votes: { [userId: string]: Vote }) => void,
) => {
  return eventsRef
    .doc(eventId)
    .collection('votes')
    .onSnapshot((snapshot) => {
      const votes: { [userId: string]: Vote } = {};
      snapshot.forEach((doc) => {
        votes[doc.id] = doc.data() as Vote;
      });
      callback(votes);
    });
};

export const listenToVoteCounts = (
  eventId: string,
  callback: (counts: { going: number; maybe: number; not: number }) => void,
) => {
  return eventsRef
    .doc(eventId)
    .collection('voteShards')
    .onSnapshot((snapshot) => {
      let going = 0,
        maybe = 0,
        not = 0;
      snapshot.forEach((doc) => {
        const data = doc.data() as VoteShard;
        going += data.going || 0;
        maybe += data.maybe || 0;
        not += data.not || 0;
      });
      callback({ going, maybe, not });
    });
};

// GROUP EVENTS QUERIES
export const listenToGroupEvents = (
  groupId: string,
  callback: (events: Event[]) => void,
) => {
  return eventsRef
    .where('groupId', '==', groupId)
    .orderBy('date')
    .onSnapshot((snapshot) => {
      const evts: Event[] = [];
      snapshot.forEach((doc) => evts.push(doc.data() as Event));
      callback(evts);
    });
};

// SEARCH / FILTER HELPERS
export const fetchUpcomingEventsForUser = async (
  userId: string,
): Promise<Event[]> => {
  const userDoc = await usersRef.doc(userId).get();
  if (!userDoc.exists) return [];
  const { groups } = userDoc.data() as User;
  if (!groups || groups.length === 0) return [];

  const snapshot = await eventsRef
    .where('groupId', 'in', groups.slice(0, 10)) // Firestore 'in' max 10
    .where('date', '>=', firestore.Timestamp.now())
    .orderBy('date', 'asc')
    .get();

  return snapshot.docs.map((doc) => doc.data() as Event);
};
