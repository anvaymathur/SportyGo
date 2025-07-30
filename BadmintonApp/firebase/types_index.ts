// types/index.ts
export interface UserDoc {
  id: string; // Auth0 sub
  Name: string;
  Groups: string[]; // Array of group IDs
  Phone: string;
}

export interface GroupDoc {
  id: string;
  Name: string;
  OwnerID: string; // Auth0 sub
  MemberIDs: string[]; // Array of Auth0 subs
}

export interface EventDoc {
  id: string;
  GroupID: string;
  Title: string;
  EventDate: Date;
  Location: string;
  CutoffDate: Date; // Voting cutoff date
  CreatorID: string; // Auth0 sub
}

export interface VoteDoc {
  userId: string; // Auth0 sub (also used as document ID)
  Status: VoteStatus;
  VotedAt: Date;
}

export interface VoteCountsDoc {
  going: number;
  maybe: number;
  not: number;
  total: number;
  lastUpdated: Date;
}

export interface VoteShard {
  going: number;
  maybe: number;
  not: number;
}

export type VoteStatus = 'going' | 'maybe' | 'not';

export interface CreateGroupData {
  name: string;
  description?: string;
}

export interface CreateEventData {
  groupId: string;
  title: string;
  description?: string;
  date: Date;
  location: string;
  cutoff: Date;
}

export interface UpdateEventData {
  title?: string;
  description?: string;
  date?: Date;
  location?: string;
  cutoff?: Date;
}

export interface FirebaseError {
  code: string;
  message: string;
}
