jest.mock('firebase/firestore', () => require('./fakeFirestore').firestoreModule);

import { fakeDb } from './fakeFirestore';
import {
  addGroupMember,
  castVote,
  deleteEvent,
  deleteGroup,
  deleteUserAccount,
  DELETED_PLAYER_ID,
  getEventVotes,
  getGroupInvites,
  getUserEvents,
  getUsersByIds,
  getVoteCounts,
  listenUserEvents,
  removeGroupMember,
  removeUserVote,
  toDate,
  updateAttendance,
} from '../firebase/services_firestore2';

const future = () => new Date(Date.now() + 7 * 86_400_000);
const seedShards = (eventId: string) => {
  for (let i = 0; i < 10; i++) fakeDb.set(`events/${eventId}/voteShards/${i}`, { going: 0, maybe: 0, not: 0 });
};
const user = (id: string, extra: object = {}) => ({ id, Name: `Name ${id}`, Email: `${id}@example.com`, Phone: '5551234567', Groups: [], Address: '', ...extra });

beforeEach(() => fakeDb.reset());

describe('removeGroupMember', () => {
  beforeEach(() => {
    fakeDb.set('groups/g1', { id: 'g1', OwnerId: 'owner', MemberIds: ['owner', 'admin', 'member'], AdminIds: ['admin'] });
    fakeDb.set('users/admin', user('admin', { Groups: ['g1'] }));
    fakeDb.set('users/member', user('member', { Groups: ['g1'] }));
  });

  it('removes a member from the group and the group from their profile', async () => {
    await removeGroupMember('g1', 'member');
    expect(fakeDb.get('groups/g1')!.MemberIds).toEqual(['owner', 'admin']);
    expect(fakeDb.get('users/member')!.Groups).toEqual([]);
  });

  it('also drops admin rights', async () => {
    await removeGroupMember('g1', 'admin');
    expect(fakeDb.get('groups/g1')).toMatchObject({ MemberIds: ['owner', 'member'], AdminIds: [] });
  });

  it('refuses to remove the owner', async () => {
    await expect(removeGroupMember('g1', 'owner')).rejects.toThrow('owner');
    expect(fakeDb.get('groups/g1')!.MemberIds).toContain('owner');
  });

  it("doesn't recreate a profile that no longer exists", async () => {
    fakeDb.set('groups/g1', { id: 'g1', OwnerId: 'owner', MemberIds: ['owner', 'ghost'] });
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await removeGroupMember('g1', 'ghost');
    expect(fakeDb.has('users/ghost')).toBe(false);
    expect(fakeDb.get('groups/g1')!.MemberIds).toEqual(['owner']);
  });
});

describe('deleteGroup', () => {
  it('deletes the group, its invites, and the group from members’ profiles', async () => {
    fakeDb.set('groups/g1', { id: 'g1', OwnerId: 'owner', MemberIds: ['owner', 'member'] });
    fakeDb.set('users/owner', user('owner', { Groups: ['g1', 'g2'] }));
    fakeDb.set('users/member', user('member', { Groups: ['g1'] }));
    fakeDb.set('groupInvites/AAA', { groupId: 'g1', inviteCode: 'AAA' });
    fakeDb.set('groupInvites/BBB', { groupId: 'g2', inviteCode: 'BBB' });

    await deleteGroup('g1');

    expect(fakeDb.has('groups/g1')).toBe(false);
    expect(fakeDb.ids('groupInvites')).toEqual(['BBB']);
    expect(fakeDb.get('users/owner')!.Groups).toEqual(['g2']);
    expect(fakeDb.get('users/member')!.Groups).toEqual([]);
  });
});

describe('user events', () => {
  beforeEach(() => {
    fakeDb.set('events/groupEvent', { Title: 'Group', GroupIDs: ['g1'], IndividualParticipantIDs: [], CreatorID: 'other', StartedEarly: true });
    fakeDb.set('events/invited', { Title: 'Invited', GroupIDs: [], IndividualParticipantIDs: ['me', 'other'], CreatorID: 'other' });
    fakeDb.set('events/mine', { Title: 'Mine', GroupIDs: [], IndividualParticipantIDs: ['other'], CreatorID: 'me' });
    fakeDb.set('events/both', { Title: 'Both', GroupIDs: ['g2'], IndividualParticipantIDs: ['me'], CreatorID: 'me' });
    fakeDb.set('events/unrelated', { Title: 'Unrelated', GroupIDs: ['g9'], IndividualParticipantIDs: ['x'], CreatorID: 'x' });
  });

  it('returns group, invited and created events once each, and nothing else', async () => {
    const events = await getUserEvents(['g1', 'g2'], 'me');
    expect(events.map((e) => e.id).sort()).toEqual(['both', 'groupEvent', 'invited', 'mine']);
  });

  it('keeps every field (e.g. StartedEarly, which the old listeners dropped)', async () => {
    const events = await getUserEvents(['g1'], 'me');
    expect(events.find((e) => e.id === 'groupEvent')).toMatchObject({ Title: 'Group', StartedEarly: true });
  });

  it('handles users in more groups than one array-contains-any query allows', async () => {
    const manyGroups = Array.from({ length: 45 }, (_, i) => `x${i}`).concat('g1');
    const events = await getUserEvents(manyGroups, 'nobody');
    expect(events.map((e) => e.id)).toEqual(['groupEvent']);
  });

  it('listens live, merging all queries, and stops after unsubscribing', async () => {
    const updates: string[][] = [];
    const unsubscribe = listenUserEvents(['g1'], 'me', (events) => updates.push(events.map((e) => e.id).sort()));
    expect(updates.at(-1)).toEqual(['both', 'groupEvent', 'invited', 'mine']);

    fakeDb.set('events/later', { Title: 'Later', GroupIDs: ['g1'], CreatorID: 'other' });
    await deleteEvent('invited'); // any write notifies listeners
    expect(updates.at(-1)).toEqual(['both', 'groupEvent', 'later', 'mine']);

    unsubscribe();
    expect(fakeDb.listenerCount()).toBe(0);
  });
});

describe('votes', () => {
  beforeEach(() => {
    fakeDb.set('events/e1', { CreatorID: 'host', VotingEnabled: true, EventDate: future(), CutoffDate: future() });
    seedShards('e1');
  });

  it('getEventVotes returns every vote in one read', async () => {
    await castVote('e1', 'going', 'a');
    await castVote('e1', 'maybe', 'b');
    await expect(getEventVotes('e1')).resolves.toEqual({ a: 'going', b: 'maybe' });
  });

  it('removeUserVote deletes the vote and takes it out of the totals', async () => {
    await castVote('e1', 'going', 'a');
    await castVote('e1', 'going', 'b');
    await removeUserVote('e1', 'a');
    await expect(getEventVotes('e1')).resolves.toEqual({ b: 'going' });
    await expect(getVoteCounts('e1')).resolves.toEqual({ going: 1, maybe: 0, not: 0 });
  });

  it('indexes voters on the event and removes them when their vote is removed', async () => {
    await castVote('e1', 'going', 'a');
    await castVote('e1', 'not', 'a'); // changing a vote keeps a single entry
    expect(fakeDb.get('events/e1')!.VoterIds).toEqual(['a']);
    await removeUserVote('e1', 'a');
    expect(fakeDb.get('events/e1')!.VoterIds).toEqual([]);
  });

  it('removeUserVote does nothing for someone who never voted', async () => {
    await removeUserVote('e1', 'nobody');
    await expect(getVoteCounts('e1')).resolves.toEqual({ going: 0, maybe: 0, not: 0 });
  });

  it('deleteEvent removes the event with its votes and shards', async () => {
    await castVote('e1', 'going', 'a');
    await deleteEvent('e1');
    expect(fakeDb.has('events/e1')).toBe(false);
    expect(fakeDb.ids('events/e1/userVotes')).toEqual([]);
    expect(fakeDb.ids('events/e1/voteShards')).toEqual([]);
  });
});

describe('updateAttendance', () => {
  it('stores IDs and check-in state only (no names or emails), plus a queryable AttendeeIds list', async () => {
    fakeDb.set('events/e1', { CreatorID: 'host' });
    const arrived = new Date('2026-05-01T18:00:00Z');
    await updateAttendance('e1', [
      { userId: 'a', userName: 'Ann', userEmail: 'ann@example.com', votedStatus: 'going', hasArrived: true, arrivalTime: arrived },
      { userId: 'b', userName: 'Bo', userEmail: '', votedStatus: null, hasArrived: true },
    ]);
    const event = fakeDb.get('events/e1')!;
    expect(event.AttendeeIds).toEqual(['a', 'b']);
    expect(event.AttendanceRecords).toEqual([
      { userId: 'a', votedStatus: 'going', hasArrived: true, arrivalTime: arrived },
      { userId: 'b', votedStatus: null, hasArrived: true, arrivalTime: null },
    ]);
    expect(JSON.stringify(event)).not.toContain('ann@example.com');
  });
});

describe('helpers', () => {
  it('getUsersByIds keeps the requested order and skips missing or repeated IDs', async () => {
    fakeDb.set('users/a', user('a'));
    fakeDb.set('users/b', user('b'));
    const users = await getUsersByIds(['b', 'missing', 'a', 'b']);
    expect(users.map((u) => u.id)).toEqual(['b', 'a']);
  });

  it('toDate understands Dates, Timestamps, serialized Timestamps and strings', () => {
    const d = new Date('2026-05-01T10:00:00Z');
    expect(toDate(d)).toEqual(d);
    expect(toDate({ toDate: () => d })).toEqual(d);
    expect(toDate({ seconds: d.getTime() / 1000, nanoseconds: 0 })).toEqual(d);
    expect(toDate('2026-05-01T10:00:00Z')).toEqual(d);
  });

  it('getGroupInvites returns real Dates (Timestamps used to become Invalid Date) newest first', async () => {
    fakeDb.set('groupInvites/OLD', { groupId: 'g1', validUntil: { seconds: Date.UTC(2026, 0, 1) / 1000, nanoseconds: 0 } });
    fakeDb.set('groupInvites/NEW', { groupId: 'g1', validUntil: { seconds: Date.UTC(2026, 5, 1) / 1000, nanoseconds: 0 } });
    const invites = await getGroupInvites('g1');
    expect(invites.map((i) => i.inviteCode ?? i.id)).toEqual(['NEW', 'OLD']);
    expect(invites[0].validUntil).toBeInstanceOf(Date);
    expect(Number.isNaN(invites[0].validUntil.getTime())).toBe(false);
  });

  it('addGroupMember works end to end through a real transaction', async () => {
    fakeDb.set('groups/g1', { MemberIds: ['owner'] });
    fakeDb.set('users/new', user('new'));
    fakeDb.set('groupInvites/ABC', { groupId: 'g1', inviteCode: 'ABC', used: 0, maxUses: 1, expired: false, validUntil: future() });
    await expect(addGroupMember('new', 'g1', 'ABC')).resolves.toBe('joined');
    expect(fakeDb.get('groups/g1')!.MemberIds).toEqual(['owner', 'new']);
    expect(fakeDb.get('groupInvites/ABC')!.used).toBe(1);
    // The single use is now spent
    fakeDb.set('users/late', user('late'));
    await expect(addGroupMember('late', 'g1', 'ABC')).resolves.toBe('invite_unavailable');
  });
});

describe('deleteUserAccount', () => {
  beforeEach(async () => {
    fakeDb.set('users/me', user('me', { Groups: ['solo', 'shared', 'theirs'], DateOfBirth: '1990-01-01' }));
    fakeDb.set('users/u2', user('u2', { Groups: ['shared', 'theirs'] }));
    fakeDb.set('users/u3', user('u3', { Groups: ['shared'] }));

    // Groups: one I own alone, one I own with others (u3 is an admin), one someone else owns
    fakeDb.set('groups/solo', { id: 'solo', OwnerId: 'me', MemberIds: ['me'], AdminIds: [] });
    fakeDb.set('groups/shared', { id: 'shared', OwnerId: 'me', MemberIds: ['me', 'u2', 'u3'], AdminIds: ['me', 'u3'] });
    fakeDb.set('groups/theirs', { id: 'theirs', OwnerId: 'u2', MemberIds: ['u2', 'me'], AdminIds: ['me'] });
    fakeDb.set('groupInvites/SOLO1', { groupId: 'solo', inviteCode: 'SOLO1' });
    fakeDb.set('groupInvites/THEIRS1', { groupId: 'theirs', inviteCode: 'THEIRS1' });

    // Events: one I created, one in a group I'm in where I RSVP'd, one I was invited to and attended
    fakeDb.set('events/created', { CreatorID: 'me', GroupIDs: ['theirs'], VotingEnabled: true, EventDate: future(), CutoffDate: future() });
    seedShards('created');
    fakeDb.set('events/groupEvent', { CreatorID: 'u2', GroupIDs: ['theirs'], VotingEnabled: true, EventDate: future(), CutoffDate: future() });
    seedShards('groupEvent');
    await castVote('groupEvent', 'going', 'me');
    await castVote('groupEvent', 'going', 'u2');
    fakeDb.set('events/invited', {
      CreatorID: 'u2', GroupIDs: [], IndividualParticipantIDs: ['u2', 'me'],
      AttendanceRecords: [{ userId: 'me', userName: 'Name me', userEmail: 'me@example.com', hasArrived: true }, { userId: 'u2', userName: 'Name u2', userEmail: '', hasArrived: true }],
    });
    fakeDb.set('events/unrelated', { CreatorID: 'u3', GroupIDs: [], IndividualParticipantIDs: ['u3'] });
    // An event in a group I've since left: I voted and was checked in, but can no longer see it
    fakeDb.set('events/formerGroup', { CreatorID: 'u3', GroupIDs: ['oldGroup'], VotingEnabled: true, EventDate: future(), CutoffDate: future() });
    seedShards('formerGroup');
    await castVote('formerGroup', 'going', 'me');
    await updateAttendance('formerGroup', [
      { userId: 'me', userName: 'Name me', userEmail: 'me@example.com', votedStatus: 'going', hasArrived: true },
      { userId: 'u3', userName: 'Name u3', userEmail: '', votedStatus: null, hasArrived: true },
    ]);

    // Matches, and temporary players: one only I manage, one shared, and my own claimed record
    fakeDb.set('users/tempMine', { Name: 'Casual', Email: 'casual@example.com', Phone: '', isTemp: true, owners: ['me'], claimedBy: null });
    fakeDb.set('users/tempShared', { Name: 'Shared', Email: '', Phone: '', isTemp: true, owners: ['me', 'u2'], claimedBy: null });
    fakeDb.set('users/tempClaimed', { Name: 'Me before signup', Email: 'me@example.com', Phone: '5551234567', isTemp: true, owners: ['u2'], claimedBy: 'me' });
    fakeDb.set('matchHistory/m1', { id: 'm1', team1: ['me', '', 21], team2: ['u2', '', 15] });
    fakeDb.set('matchHistory/m2', { id: 'm2', team1: ['u2', 'tempShared', 21], team2: ['tempMine', 'u3', 19] });

    await deleteUserAccount('me');
  });

  it('deletes the profile', () => {
    expect(fakeDb.has('users/me')).toBe(false);
  });

  it('deletes a group only I was in, with its invites', () => {
    expect(fakeDb.has('groups/solo')).toBe(false);
    expect(fakeDb.ids('groupInvites')).toEqual(['THEIRS1']);
  });

  it('hands a shared group I owned to an admin', () => {
    expect(fakeDb.get('groups/shared')).toMatchObject({ OwnerId: 'u3', MemberIds: ['u2', 'u3'], AdminIds: [] });
  });

  it('leaves groups owned by others', () => {
    expect(fakeDb.get('groups/theirs')).toMatchObject({ OwnerId: 'u2', MemberIds: ['u2'], AdminIds: [] });
  });

  it('deletes events I created, including their votes', () => {
    expect(fakeDb.has('events/created')).toBe(false);
    expect(fakeDb.ids('events/created/voteShards')).toEqual([]);
  });

  it('removes my RSVP from other events and fixes the counts', async () => {
    await expect(getEventVotes('groupEvent')).resolves.toEqual({ u2: 'going' });
    await expect(getVoteCounts('groupEvent')).resolves.toEqual({ going: 1, maybe: 0, not: 0 });
  });

  it('removes my invitation and attendance record from other events', () => {
    const invited = fakeDb.get('events/invited')!;
    expect(invited.IndividualParticipantIDs).toEqual(['u2']);
    expect(invited.AttendanceRecords.map((r: any) => r.userId)).toEqual(['u2']);
  });

  it('cleans up events from groups I left before deleting (found via VoterIds / AttendeeIds)', async () => {
    const event = fakeDb.get('events/formerGroup')!;
    expect(event.AttendanceRecords.map((r: any) => r.userId)).toEqual(['u3']);
    expect(event.AttendeeIds).toEqual(['u3']);
    expect(event.VoterIds).toEqual([]);
    await expect(getEventVotes('formerGroup')).resolves.toEqual({});
    await expect(getVoteCounts('formerGroup')).resolves.toEqual({ going: 0, maybe: 0, not: 0 });
  });

  it('leaves unrelated events alone', () => {
    expect(fakeDb.get('events/unrelated')).toEqual({ CreatorID: 'u3', GroupIDs: [], IndividualParticipantIDs: ['u3'] });
  });

  it('keeps matches for other players but anonymises me', () => {
    expect(fakeDb.get('matchHistory/m1')).toMatchObject({ team1: [DELETED_PLAYER_ID, '', 21], team2: ['u2', '', 15] });
  });

  it('deletes temporary players only I managed (and anonymises them in matches)', () => {
    expect(fakeDb.has('users/tempMine')).toBe(false);
    expect(fakeDb.get('matchHistory/m2')!.team2).toEqual([DELETED_PLAYER_ID, 'u3', 19]);
  });

  it('keeps shared temporary players for their other managers', () => {
    expect(fakeDb.get('users/tempShared')!.owners).toEqual(['u2']);
    expect(fakeDb.get('matchHistory/m2')!.team1).toEqual(['u2', 'tempShared', 21]);
  });

  it('deletes the claimed temp record holding my own email and phone', () => {
    expect(fakeDb.has('users/tempClaimed')).toBe(false);
  });

  it("doesn't touch other people's profiles beyond removing deleted groups", () => {
    expect(fakeDb.get('users/u2')).toMatchObject({ Name: 'Name u2', Groups: ['shared', 'theirs'] });
    expect(fakeDb.get('users/u3')).toMatchObject({ Name: 'Name u3', Groups: ['shared'] });
  });

  it('can be run again safely if it was interrupted', async () => {
    await expect(deleteUserAccount('me')).resolves.toBeUndefined();
    expect(fakeDb.has('users/me')).toBe(false);
  });
});
