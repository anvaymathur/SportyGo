/**
 * Runs the app's real Firestore service functions against the Firestore emulator with
 * firestore.auth.rules loaded (the per-user rules that replace firestore.rules once the app
 * signs in to Firebase). Each step runs as a specific signed-in user: everything the app does
 * for that user must succeed, and acting as or on behalf of someone else must fail.
 *
 * Run with: npm run test:rules
 */
import fs from 'fs';
import path from 'path';
import { assertFails, assertSucceeds, initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc, deleteDoc, arrayUnion, arrayRemove, collection, addDoc } from 'firebase/firestore';

let mockDb: any;
jest.mock('../firebase/index', () => ({
  get db() { return mockDb; },
}));
jest.mock('expo-image-manipulator', () => ({}));

import * as svc from '../firebase/services_firestore2';

let testEnv: RulesTestEnvironment;
const future = () => new Date(Date.now() + 7 * 86_400_000);

/** Everything after this call reaches Firestore as `uid` (or signed out when null). */
const as = (uid: string | null) => {
  mockDb = uid ? testEnv.authenticatedContext(uid).firestore() : testEnv.unauthenticatedContext().firestore();
};
const seed = (docPath: string, data: object) =>
  testEnv.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), docPath), data); });
const stored = async (docPath: string) => {
  let data: any;
  await testEnv.withSecurityRulesDisabled(async (ctx) => { data = (await getDoc(doc(ctx.firestore(), docPath))).data(); });
  return data;
};

const profile = (id: string, extra: object = {}) => ({
  id, Name: `Name ${id}`, Email: `${id}@example.com`, Groups: [], Phone: '', Address: '', PhotoUrl: '',
  DateOfBirth: new Date('1990-01-01'), ...extra,
});
const temp = (owners: string[], extra: object = {}) => ({
  Name: 'Casual', Email: '', Phone: '', Groups: [], Address: '', isTemp: true, owners, claimedBy: null, createdAt: new Date(), ...extra,
} as any);
const groupData = (owner: string) => ({
  id: '', Name: 'Tuesday Tennis', OwnerId: owner, MemberIds: [owner], Description: 'Doubles',
  SkillLevel: 'competitive', Privacy: 'open', HomeCourt: 'Park', MeetingSchedule: 'weekly', PhotoUrl: 'INITIALS:TT',
} as any);
const invite = (groupId: string, code: string) => ({
  groupId, inviteCode: code, inviteLink: `https://x/${code}`, validUntil: future(), maxUses: 5, expired: false, used: 0,
});
const eventData = (creator: string, extra: object = {}) => ({
  id: '', GroupIDs: ['g1'], IndividualParticipantIDs: [], Title: 'Doubles night', EventDate: future(),
  Location: 'Gym', CutoffDate: future(), CreatorID: creator, VotingEnabled: true, ...extra,
} as any);

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    // Its own project, so these rules don't replace the ones the other rules test file loads
    projectId: 'demo-sportygo-auth',
    firestore: { rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.auth.rules'), 'utf8') },
  });
});
afterAll(async () => { await testEnv.cleanup(); });
beforeEach(async () => {
  await testEnv.clearFirestore();
  for (const id of ['owner', 'admin', 'member', 'outsider']) await seed(`users/${id}`, profile(id));
});

describe('signed out', () => {
  it('can read and write nothing', async () => {
    await seed('groups/g1', { ...groupData('owner'), id: 'g1' });
    await seed('matchHistory/m1', { team1: ['a', '', 21], team2: ['b', '', 5], date: new Date(), id: 'm1' });
    as(null);
    await assertFails(svc.getUserProfile('owner'));
    await assertFails(svc.getGroupById('g1'));
    await assertFails(svc.getUserGroups('owner'));
    await assertFails(svc.getUserMatchHistory('a'));
    await assertFails(svc.createUserProfile('new', profile('new') as any));
    await assertFails(svc.createMatchHistory({ team1: ['a', '', 21], team2: ['b', '', 5], date: new Date(), id: '' } as any));
    await assertFails(deleteDoc(doc(mockDb, 'groups/g1')));
  });
});

describe('profiles', () => {
  it('lets a user create, read, edit and delete their own profile', async () => {
    as('new');
    await assertSucceeds(svc.createUserProfile('new', profile('new') as any));
    await assertSucceeds(svc.updateUserProfile('new', { Name: 'Renamed', Phone: '5551234567' }));
    await assertSucceeds(svc.getUserProfilesByIds(['new', 'owner']));
    await assertSucceeds(deleteDoc(doc(mockDb, 'users/new')));
  });

  it("refuses creating, editing or deleting someone else's profile", async () => {
    as('outsider');
    await assertFails(svc.createUserProfile('victim', profile('victim') as any));
    await assertFails(svc.updateUserProfile('owner', { Name: 'Hacked' }));
    await assertFails(updateDoc(doc(mockDb, 'users/owner'), { Groups: ['x'], Phone: '1' }));
    await assertFails(deleteDoc(doc(mockDb, 'users/owner')));
    await assertFails(updateDoc(doc(mockDb, 'users/outsider'), { Email: 'other@example.com' }));
  });

  it('refuses passing a real profile off as a temporary player', async () => {
    as('outsider');
    await assertFails(setDoc(doc(mockDb, 'users/outsider2'), { ...profile('outsider2'), isTemp: true, owners: ['someone-else'] }));
    await assertFails(updateDoc(doc(mockDb, 'users/owner'), { isTemp: true }));
  });

  it('supports temporary players: create, share, merge, claim, delete', async () => {
    as('owner');
    const a = await svc.createTempUser(temp(['owner'], { Email: 'c@example.com' }));
    const b = await svc.createTempUser(temp(['owner'], { Phone: '5551234567' }));
    await assertFails(svc.createTempUser(temp(['someone-else'])));
    await assertSucceeds(svc.findUnclaimedTempsByOwner('owner'));
    await assertSucceeds(svc.mergeTempUsers(a, b));
    as('member');
    await assertSucceeds(svc.addTempOwner(a, 'member'));
    await assertSucceeds(svc.checkForClaimableTemps('c@example.com', ''));
    await assertSucceeds(svc.markTempClaimed(a, 'member'));
    await assertSucceeds(deleteDoc(doc(mockDb, `users/${b}`)));
  });
});

describe('groups', () => {
  const makeGroup = async () => {
    as('owner');
    const gid = await svc.createGroup('owner', groupData('owner'));
    await svc.addGroupAdmin(gid, 'admin').catch(() => undefined); // not a member yet: harmless
    return gid;
  };
  /** A group with an owner, an admin and a plain member. */
  const makeFullGroup = async () => {
    const gid = await makeGroup();
    as('admin'); await svc.addGroupMember('admin', gid);
    as('member'); await svc.addGroupMember('member', gid);
    as('owner'); await svc.addGroupAdmin(gid, 'admin');
    return gid;
  };

  it('lets someone create a group they own, and nobody create one for someone else', async () => {
    as('owner');
    await assertSucceeds(svc.createGroup('owner', groupData('owner')));
    await assertFails(setDoc(doc(mockDb, 'groups/fake'), { ...groupData('member'), id: 'fake' }));
  });

  it('lets the owner and admins manage the group', async () => {
    const gid = await makeFullGroup();
    as('admin');
    await assertSucceeds(svc.updateGroup(gid, { Name: 'Friday Football' }));
    await assertSucceeds(svc.removeGroupMember(gid, 'member'));
    expect((await stored('users/member')).Groups).toEqual([]);
    as('owner');
    await assertSucceeds(svc.removeGroupAdmin(gid, 'admin'));
    await assertSucceeds(svc.deleteGroup(gid));
    expect(await stored(`groups/${gid}`)).toBeUndefined();
  });

  it('lets people join and leave, but only as themselves', async () => {
    const gid = await makeGroup();
    as('member');
    await expect(svc.addGroupMember('member', gid)).resolves.toBe('joined');
    await assertFails(updateDoc(doc(mockDb, `groups/${gid}`), { MemberIds: arrayUnion('outsider') }));
    await assertFails(updateDoc(doc(mockDb, `groups/${gid}`), { MemberIds: arrayRemove('owner') }));
    await assertFails(updateDoc(doc(mockDb, `groups/${gid}`), { AdminIds: arrayUnion('member') }));
    await assertSucceeds(svc.removeGroupMember(gid, 'member'));
    expect((await stored(`groups/${gid}`)).MemberIds).toEqual(['owner']);
  });

  it('refuses edits, deletion and takeovers by members and outsiders', async () => {
    const gid = await makeFullGroup();
    for (const who of ['member', 'outsider']) {
      as(who);
      await assertFails(svc.updateGroup(gid, { Name: 'Hacked' }));
      await assertFails(updateDoc(doc(mockDb, `groups/${gid}`), { OwnerId: who }));
      await assertFails(deleteDoc(doc(mockDb, `groups/${gid}`)));
    }
    as('admin'); // admins manage the group but can't take it over or delete it
    await assertFails(updateDoc(doc(mockDb, `groups/${gid}`), { OwnerId: 'admin' }));
    await assertFails(deleteDoc(doc(mockDb, `groups/${gid}`)));
    as('owner');
    await assertFails(updateDoc(doc(mockDb, `groups/${gid}`), { OwnerId: 'outsider' }));
    await assertSucceeds(updateDoc(doc(mockDb, `groups/${gid}`), { OwnerId: 'admin' }));
  });

  it('lets only the owner and admins create and delete invite links; anyone signed in can use one', async () => {
    const gid = await makeFullGroup();
    as('member');
    await assertFails(svc.createGroupInvite(invite(gid, 'NOPE01')));
    as('admin');
    await assertSucceeds(svc.createGroupInvite(invite(gid, 'ABC123')));
    await assertSucceeds(svc.getGroupInvites(gid));
    as('outsider');
    await assertSucceeds(svc.getGroupInvite('ABC123'));
    await expect(svc.addGroupMember('outsider', gid, 'ABC123')).resolves.toBe('joined');
    expect((await stored('groupInvites/ABC123')).used).toBe(1);
    await assertFails(deleteDoc(doc(mockDb, 'groupInvites/ABC123')));
    await assertFails(updateDoc(doc(mockDb, 'groupInvites/ABC123'), { maxUses: 999 }));
  });
});

describe('events and votes', () => {
  it('lets the organiser create, edit and delete an event, and participants vote and check in', async () => {
    as('owner');
    const eid = await svc.createEvent(eventData('owner'));
    await assertSucceeds(svc.updateEvent(eid, { Title: 'Moved', Location: 'Hall' }));
    as('member');
    await assertSucceeds(svc.castVote(eid, 'going', 'member'));
    await assertSucceeds(svc.castVote(eid, 'maybe', 'member'));
    await assertSucceeds(svc.getUserVote(eid, 'member'));
    await assertSucceeds(svc.getEventVotes(eid));
    await assertSucceeds(svc.updateAttendance(eid, [{ userId: 'member', votedStatus: 'maybe', hasArrived: true, arrivalTime: new Date() }]));
    as('admin');
    await assertSucceeds(svc.castVote(eid, 'not', 'admin'));
    await assertSucceeds(svc.removeUserVote(eid, 'admin'));
    as('owner');
    await assertSucceeds(svc.deleteEvent(eid));
    expect(await stored(`events/${eid}`)).toBeUndefined();
    expect(await stored(`events/${eid}/userVotes/member`)).toBeUndefined();
  });

  it('refuses creating an event as someone else, voting as someone else, and deleting other people\'s events', async () => {
    as('owner');
    const eid = await svc.createEvent(eventData('owner'));
    await svc.castVote(eid, 'going', 'owner');
    as('outsider');
    await assertFails(svc.createEvent(eventData('owner')));
    await assertFails(svc.castVote(eid, 'not', 'owner'));
    await assertFails(deleteDoc(doc(mockDb, 'events', eid, 'userVotes', 'owner')));
    await assertFails(svc.deleteEvent(eid));
    await assertFails(updateDoc(doc(mockDb, 'events', eid), { CreatorID: 'outsider' }));
    expect(await stored(`events/${eid}`)).toMatchObject({ CreatorID: 'owner' });
  });
});

describe('matches', () => {
  it('lets signed-in users record, edit and delete matches', async () => {
    as('member');
    await assertSucceeds(svc.createMatchHistory({ team1: ['member', '', 21], team2: ['owner', '', 15], date: new Date(), id: '' } as any));
    const [saved] = await svc.getUserMatchHistory('member');
    await assertSucceeds(svc.updateMatchHistory(saved.id, { team1: ['member', '', 11], team2: ['owner', '', 9], date: new Date() }));
    await assertFails(addDoc(collection(mockDb, 'matchHistory'), { team1: ['member', '', 5000], team2: ['owner', '', 1], date: new Date(), id: '' }));
    await assertSucceeds(svc.deleteMatchHistory(saved.id));
  });
});

describe('account deletion', () => {
  it('runs end to end as the user being deleted', async () => {
    as('owner');
    const solo = await svc.createGroup('owner', groupData('owner'));
    const shared = await svc.createGroup('owner', groupData('owner'));
    await svc.createGroupInvite(invite(solo, 'SOLO01'));
    const mine = await svc.createEvent(eventData('owner', { GroupIDs: [shared] }));
    await svc.createTempUser(temp(['owner']));
    await svc.createMatchHistory({ team1: ['owner', '', 21], team2: ['member', '', 10], date: new Date(), id: '' } as any);
    as('member');
    await svc.addGroupMember('member', shared);
    await svc.castVote(mine, 'going', 'member');
    const theirs = await svc.createEvent(eventData('member', { GroupIDs: [shared], IndividualParticipantIDs: ['owner'] }));
    as('owner');
    await svc.castVote(theirs, 'going', 'owner');
    await svc.updateAttendance(theirs, [{ userId: 'owner', votedStatus: 'going', hasArrived: true }]);

    await assertSucceeds(svc.deleteUserAccount('owner'));

    expect(await stored('users/owner')).toBeUndefined();
    expect(await stored(`groups/${solo}`)).toBeUndefined();
    expect(await stored('groupInvites/SOLO01')).toBeUndefined();
    expect(await stored(`groups/${shared}`)).toMatchObject({ OwnerId: 'member', MemberIds: ['member'] });
    expect(await stored(`events/${mine}`)).toBeUndefined();
    expect(await stored(`events/${theirs}`)).toMatchObject({ IndividualParticipantIDs: [], AttendeeIds: [], VoterIds: [] });
    as('member');
    const [m] = await svc.getUserMatchHistory('member');
    expect(m.team1[0]).toBe(svc.DELETED_PLAYER_ID);
  });
});

describe('everything else', () => {
  it('denies collections the app does not use, even when signed in', async () => {
    as('owner');
    await assertFails(setDoc(doc(mockDb, 'secrets/x'), { a: 1 }));
    await assertFails(getDoc(doc(mockDb, 'secrets/x')));
  });
});
