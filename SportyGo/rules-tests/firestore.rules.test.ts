/**
 * Runs the app's real Firestore service functions against the Firestore emulator with
 * firestore.rules loaded, as an unauthenticated client (how the app reaches Firestore today).
 * Every app write path must succeed; tampering the rules exist to stop must fail.
 *
 * Run with: npm run test:rules
 */
import fs from 'fs';
import path from 'path';
import { assertFails, assertSucceeds, initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc, increment, collection, addDoc, deleteField } from 'firebase/firestore';

let mockDb: any;
jest.mock('../firebase/index', () => ({
  get db() { return mockDb; },
}));
jest.mock('expo-image-manipulator', () => ({}));

import * as svc from '../firebase/services_firestore2';

let testEnv: RulesTestEnvironment;
const future = () => new Date(Date.now() + 7 * 86_400_000);
const past = () => new Date(Date.now() - 86_400_000);

/** Writes data directly, bypassing the rules (for seeding existing / legacy documents). */
const seed = (docPath: string, data: object) =>
  testEnv.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), docPath), data); });
const read = async (docPath: string) => (await getDoc(doc(mockDb, docPath))).data();

const profile = (id: string, extra: object = {}) => ({
  id, Name: `Name ${id}`, Email: `${id}@example.com`, Groups: [], Phone: '', Address: '', PhotoUrl: '',
  DateOfBirth: new Date('1990-01-01'), ...extra,
});

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-sportygo',
    firestore: { rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8') },
  });
  mockDb = testEnv.unauthenticatedContext().firestore();
});
afterAll(async () => { await testEnv.cleanup(); });
beforeEach(async () => { await testEnv.clearFirestore(); });

describe('profiles', () => {
  it('lets the app create and edit a profile', async () => {
    await assertSucceeds(svc.createUserProfile('u1', profile('u1') as any));
    await assertSucceeds(svc.updateUserProfile('u1', { Name: 'New', Phone: '5551234567', PhotoUrl: 'data:image/jpeg;base64,AAA', DateOfBirth: new Date('1991-02-02') }));
    expect(await read('users/u1')).toMatchObject({ Name: 'New', Email: 'u1@example.com' });
  });

  it("refuses changing a profile's email", async () => {
    await svc.createUserProfile('u1', profile('u1') as any);
    await assertFails(updateDoc(doc(mockDb, 'users/u1'), { Email: 'attacker@example.com' }));
  });

  it('lets an email be filled in once if a profile has none', async () => {
    await seed('users/u1', { Groups: ['g1'] });
    await assertSucceeds(svc.createUserProfile('u1', profile('u1') as any));
  });

  it('refuses unknown fields and wrong types', async () => {
    await assertFails(setDoc(doc(mockDb, 'users/u1'), { ...profile('u1'), isAdmin: true }));
    await assertFails(setDoc(doc(mockDb, 'users/u2'), { ...profile('u2'), Name: 42 }));
  });

  it('supports temporary players: create, add owner, merge, claim', async () => {
    const a = await svc.createTempUser({ Name: 'Casual', Email: 'c@example.com', Phone: '', Groups: [], Address: '', isTemp: true, owners: ['u1'], claimedBy: null, createdAt: new Date() } as any);
    const b = await svc.createTempUser({ Name: 'Casual 2', Email: '', Phone: '5551234567', Groups: [], Address: '', isTemp: true, owners: ['u2'], claimedBy: null, createdAt: new Date() } as any);
    await assertSucceeds(svc.addTempOwner(a, 'u3'));
    await assertSucceeds(svc.mergeTempUsers(a, b));
    await assertSucceeds(svc.markTempClaimed(a, 'u1'));
    expect(await read(`users/${a}`)).toMatchObject({ claimedBy: 'u1', owners: ['u1', 'u3', 'u2'] });
    await assertSucceeds(svc.findUnclaimedTempsByOwner('u2'));
  });
});

describe('groups and invites', () => {
  const makeGroup = async () => svc.createGroup('owner', {
    id: '', Name: 'Tuesday Tennis', OwnerId: 'owner', MemberIds: ['owner'], Description: 'Doubles',
    SkillLevel: 'competitive', Privacy: 'open', HomeCourt: 'Park', MeetingSchedule: 'weekly', PhotoUrl: 'INITIALS:TT',
  } as any);

  beforeEach(async () => {
    await seed('users/owner', profile('owner'));
    await seed('users/joiner', profile('joiner'));
    await seed('users/late', profile('late'));
  });

  it('lets the app create, edit and manage a group', async () => {
    const gid = await makeGroup();
    await assertSucceeds(svc.updateGroup(gid, { Name: 'Friday Football', Description: 'New', PhotoUrl: 'INITIALS:FF' }));
    await assertSucceeds(svc.addGroupMember('joiner', gid));
    await assertSucceeds(svc.addGroupAdmin(gid, 'joiner'));
    await assertSucceeds(svc.removeGroupAdmin(gid, 'joiner'));
    await assertSucceeds(svc.removeGroupMember(gid, 'joiner'));
    await assertSucceeds(svc.deleteGroup(gid));
  });

  it('refuses a group whose owner is not a member, and handing ownership to an outsider', async () => {
    await assertFails(setDoc(doc(mockDb, 'groups/bad'), { id: 'bad', Name: 'X', OwnerId: 'a', MemberIds: ['b'] }));
    const gid = await makeGroup();
    await assertFails(updateDoc(doc(mockDb, `groups/${gid}`), { OwnerId: 'outsider' }));
    await assertFails(updateDoc(doc(mockDb, `groups/${gid}`), { createdAt: new Date() }));
  });

  it('joins through an invite link and counts the use', async () => {
    const gid = await makeGroup();
    await assertSucceeds(svc.createGroupInvite({ groupId: gid, inviteCode: 'ABC123', inviteLink: 'https://x/ABC123', validUntil: future(), maxUses: 1, expired: false, used: 0 }));
    await expect(svc.addGroupMember('joiner', gid, 'ABC123')).resolves.toBe('joined');
    expect((await read('groupInvites/ABC123'))!.used).toBe(1);
  });

  it('enforces invite limits on the server, not just in the app', async () => {
    const gid = await makeGroup();
    await seed('groupInvites/FULL', { groupId: gid, inviteCode: 'FULL', inviteLink: '', validUntil: future(), maxUses: 1, expired: false, used: 1 });
    await seed('groupInvites/OLD', { groupId: gid, inviteCode: 'OLD', inviteLink: '', validUntil: past(), maxUses: 10, expired: false, used: 0 });
    await seed('groupInvites/DEAD', { groupId: gid, inviteCode: 'DEAD', inviteLink: '', validUntil: future(), maxUses: 10, expired: true, used: 0 });
    await seed('groupInvites/OPEN', { groupId: gid, inviteCode: 'OPEN', inviteLink: '', validUntil: future(), maxUses: 10, expired: false, used: 0 });
    await assertFails(updateDoc(doc(mockDb, 'groupInvites/FULL'), { used: increment(1) }));
    await assertFails(updateDoc(doc(mockDb, 'groupInvites/OLD'), { used: increment(1) }));
    await assertFails(updateDoc(doc(mockDb, 'groupInvites/DEAD'), { used: increment(1) }));
    await assertFails(updateDoc(doc(mockDb, 'groupInvites/OPEN'), { used: 0 })); // resetting the count
    await assertFails(updateDoc(doc(mockDb, 'groupInvites/OPEN'), { used: increment(2) }));
    await assertFails(updateDoc(doc(mockDb, 'groupInvites/OPEN'), { maxUses: 999 }));
    await assertSucceeds(updateDoc(doc(mockDb, 'groupInvites/OPEN'), { used: increment(1) }));
  });

  it('still honours older "unlimited" invites saved with maxUses NaN', async () => {
    const gid = await makeGroup();
    await seed('groupInvites/LEGACY', { groupId: gid, inviteCode: 'LEGACY', inviteLink: '', validUntil: future(), maxUses: NaN, expired: false, used: 40 });
    await expect(svc.addGroupMember('joiner', gid, 'LEGACY')).resolves.toBe('joined');
  });

  it('refuses invites created already used or without a limit', async () => {
    await assertFails(setDoc(doc(mockDb, 'groupInvites/X1'), { groupId: 'g', inviteCode: 'X1', inviteLink: '', validUntil: future(), maxUses: 5, expired: false, used: 3 }));
    await assertFails(setDoc(doc(mockDb, 'groupInvites/X2'), { groupId: 'g', inviteCode: 'NOT-X2', inviteLink: '', validUntil: future(), maxUses: 5, expired: false, used: 0 }));
  });
});

describe('events and votes', () => {
  const makeEvent = () => svc.createEvent({
    id: '', GroupIDs: ['g1'], IndividualParticipantIDs: ['host'], Title: 'Doubles night', EventDate: future(),
    Location: 'Gym', TotalCost: 40, CutoffDate: future(), CreatorID: 'host', VotingEnabled: true,
  } as any);

  it('lets the app create an event, vote, change votes, check people in, start early and delete', async () => {
    const eid = await makeEvent();
    await assertSucceeds(svc.castVote(eid, 'going', 'a'));
    await assertSucceeds(svc.castVote(eid, 'not', 'a'));
    await assertSucceeds(svc.castVote(eid, 'maybe', 'b'));
    await expect(svc.getVoteCounts(eid)).resolves.toEqual({ going: 0, maybe: 1, not: 1 });
    await assertSucceeds(svc.updateAttendance(eid, [{ userId: 'a', votedStatus: 'going', hasArrived: true, arrivalTime: new Date() }]));
    await assertSucceeds(updateDoc(doc(mockDb, 'events', eid), { StartedEarly: true, StartedEarlyAt: new Date() }));
    await assertSucceeds(svc.removeUserVote(eid, 'b'));
    await assertSucceeds(svc.getUserEvents(['g1'], 'a', { includeHistory: true }));
    await assertSucceeds(svc.deleteEvent(eid));
  });

  it('refuses stuffing the vote tallies or voting as someone else', async () => {
    const eid = await makeEvent();
    await assertFails(updateDoc(doc(mockDb, 'events', eid, 'voteShards', '0'), { going: 50 }));
    await assertFails(setDoc(doc(mockDb, 'events', eid, 'userVotes', 'victim'), { status: 'not', votedAt: new Date(), userId: 'attacker' }));
    await assertFails(setDoc(doc(mockDb, 'events', eid, 'userVotes', 'a'), { status: 'definitely', votedAt: new Date(), userId: 'a' }));
  });

  it("refuses changing an event's creator", async () => {
    const eid = await makeEvent();
    await assertFails(updateDoc(doc(mockDb, 'events', eid), { CreatorID: 'attacker' }));
  });

  it('still allows voting on older events that have extra or missing fields', async () => {
    await seed('events/legacy', { Title: 'Old', EventDate: future(), CutoffDate: future(), CreatorID: 'host', Description: 'legacy field' });
    for (let i = 0; i < 10; i++) await seed(`events/legacy/voteShards/${i}`, { going: 0, maybe: 0, not: 0 });
    await assertSucceeds(svc.castVote('legacy', 'going', 'a'));
  });
});

describe('matches', () => {
  const match = { team1: ['a', '', 21], team2: ['b', '', 15], date: new Date(), id: '' } as any;

  it('lets the app record, edit, migrate and delete matches', async () => {
    await assertSucceeds(svc.createMatchHistory(match));
    const [saved] = await svc.getUserMatchHistory('a');
    await assertSucceeds(svc.updateMatchHistory(saved.id, { team1: ['a', '', 11], team2: ['b', '', 9], date: new Date() }));
    await assertSucceeds(svc.migrateMatchRefs('a', 'a-real'));
    await assertSucceeds(svc.deleteMatchHistory(saved.id));
  });

  it('refuses malformed scores', async () => {
    await assertFails(addDoc(collection(mockDb, 'matchHistory'), { ...match, team1: ['a', '', 5000] }));
    await assertFails(addDoc(collection(mockDb, 'matchHistory'), { ...match, team1: ['a', 21] }));
  });
});

describe('account deletion', () => {
  it('runs end to end under the rules', async () => {
    await seed('users/me', profile('me', { Groups: ['solo', 'shared'] }));
    await seed('users/u2', profile('u2', { Groups: ['shared'] }));
    await seed('groups/solo', { id: 'solo', Name: 'Solo', OwnerId: 'me', MemberIds: ['me'], AdminIds: [] });
    await seed('groups/shared', { id: 'shared', Name: 'Shared', OwnerId: 'me', MemberIds: ['me', 'u2'], AdminIds: ['me'] });
    await seed('groupInvites/SOLO', { groupId: 'solo', inviteCode: 'SOLO', inviteLink: '', validUntil: future(), maxUses: 5, expired: false, used: 0 });
    const created = await svc.createEvent({ id: '', GroupIDs: ['shared'], IndividualParticipantIDs: [], Title: 'Mine', EventDate: future(), Location: 'Gym', CutoffDate: future(), CreatorID: 'me', VotingEnabled: true } as any);
    const other = await svc.createEvent({ id: '', GroupIDs: ['old'], IndividualParticipantIDs: ['u2', 'me'], Title: 'Theirs', EventDate: future(), Location: 'Gym', CutoffDate: future(), CreatorID: 'u2', VotingEnabled: true } as any);
    await svc.castVote(other, 'going', 'me');
    await svc.updateAttendance(other, [{ userId: 'me', votedStatus: 'going', hasArrived: true }]);
    await svc.createMatchHistory({ team1: ['me', '', 21], team2: ['u2', '', 10], date: new Date(), id: '' } as any);
    await svc.createTempUser({ Name: 'T', Email: '', Phone: '', Groups: [], Address: '', isTemp: true, owners: ['me'], claimedBy: null, createdAt: new Date() } as any);

    await assertSucceeds(svc.deleteUserAccount('me'));

    expect(await read('users/me')).toBeUndefined();
    expect(await read('groups/solo')).toBeUndefined();
    expect(await read('groups/shared')).toMatchObject({ OwnerId: 'u2', MemberIds: ['u2'] });
    expect(await read(`events/${created}`)).toBeUndefined();
    expect(await read(`events/${other}`)).toMatchObject({ IndividualParticipantIDs: ['u2'], AttendeeIds: [], VoterIds: [] });
    const [m] = await svc.getUserMatchHistory('u2');
    expect(m.team1[0]).toBe(svc.DELETED_PLAYER_ID);
  });
});

describe('everything else', () => {
  it('denies collections the app does not use', async () => {
    await assertFails(setDoc(doc(mockDb, 'secrets/x'), { a: 1 }));
    await assertFails(getDoc(doc(mockDb, 'secrets/x')));
  });

  it('allows the reads the app makes', async () => {
    await seed('users/u1', profile('u1'));
    await assertSucceeds(svc.getUserProfile('u1'));
    await assertSucceeds(svc.getUserProfilesByIds(['u1', 'u2']));
    await assertSucceeds(svc.getUserGroups('u1'));
    await assertSucceeds(svc.checkForClaimableTemps('u1@example.com', '5551234567'));
    await assertSucceeds(svc.getGroupInvites('g1'));
  });

  it('allows removing fields the app clears', async () => {
    await seed('users/u1', profile('u1'));
    await assertSucceeds(updateDoc(doc(mockDb, 'users/u1'), { PhotoUrl: deleteField() }));
  });
});
