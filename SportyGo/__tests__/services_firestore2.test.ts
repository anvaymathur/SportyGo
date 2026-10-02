import { mockFirestore } from './setup';
import { updateUserProfile, updateGroup, addGroupAdmin, removeGroupAdmin, addGroupMember, isInviteUsable } from '../firebase/services_firestore2';

describe('updateUserProfile', () => {
  it('writes editable profile fields', async () => {
    await updateUserProfile('user-1', { Name: 'Sam', Phone: '5555555555' });
    expect(mockFirestore.updateDoc).toHaveBeenCalledWith({ path: 'users/user-1' }, { Name: 'Sam', Phone: '5555555555' });
  });

  it('never writes Email, even if a caller passes it', async () => {
    await updateUserProfile('user-1', { Name: 'Sam', Email: 'new@example.com' } as any);
    expect(mockFirestore.updateDoc).toHaveBeenCalledWith({ path: 'users/user-1' }, { Name: 'Sam' });
  });
});

describe('group management', () => {
  it('updateGroup writes the given fields to the group doc', async () => {
    await updateGroup('g1', { Name: 'Tuesday Tennis' });
    expect(mockFirestore.updateDoc).toHaveBeenCalledWith({ path: 'groups/g1' }, { Name: 'Tuesday Tennis' });
  });

  it('addGroupAdmin adds the user with arrayUnion', async () => {
    await addGroupAdmin('g1', 'user-2');
    expect(mockFirestore.updateDoc).toHaveBeenCalledWith({ path: 'groups/g1' }, { AdminIds: { op: 'arrayUnion', v: 'user-2' } });
  });

  it('removeGroupAdmin removes the user with arrayRemove', async () => {
    await removeGroupAdmin('g1', 'user-2');
    expect(mockFirestore.updateDoc).toHaveBeenCalledWith({ path: 'groups/g1' }, { AdminIds: { op: 'arrayRemove', v: 'user-2' } });
  });
});

describe('isInviteUsable', () => {
  const now = new Date('2026-06-01T12:00:00Z');
  const invite = (overrides: object = {}) => ({
    groupId: 'g1', inviteCode: 'ABC123', inviteLink: '', expired: false, used: 0, maxUses: 5,
    validUntil: new Date('2026-07-01T00:00:00Z'), ...overrides,
  }) as any;

  it('accepts a live invite for the right group', () => {
    expect(isInviteUsable(invite(), 'g1', now)).toBe(true);
  });

  it.each([
    ['for another group', invite({ groupId: 'g2' })],
    ['marked expired', invite({ expired: true })],
    ['past validUntil (Date)', invite({ validUntil: new Date('2026-05-01T00:00:00Z') })],
    ['past validUntil (Firestore Timestamp)', invite({ validUntil: { toDate: () => new Date('2026-05-01T00:00:00Z') } })],
    ['out of uses', invite({ used: 5, maxUses: 5 })],
  ])('rejects an invite %s', (_label, inv) => {
    expect(isInviteUsable(inv, 'g1', now)).toBe(false);
  });

  it('treats older NaN "unlimited" invites as having no limit', () => {
    expect(isInviteUsable(invite({ used: 500, maxUses: NaN }), 'g1', now)).toBe(true);
  });
});

describe('addGroupMember', () => {
  // Fake Firestore transaction over an in-memory set of docs
  let docs: Record<string, any>;
  let tx: { get: jest.Mock; set: jest.Mock; update: jest.Mock };
  beforeEach(() => {
    docs = {
      'groups/g1': { MemberIds: ['owner-1'] },
      'groupInvites/ABC123': {
        groupId: 'g1', inviteCode: 'ABC123', expired: false, used: 2, maxUses: 3,
        validUntil: { toDate: () => new Date(Date.now() + 86_400_000) },
      },
    };
    tx = {
      get: jest.fn(async (ref: { path: string }) => ({ exists: () => ref.path in docs, data: () => docs[ref.path] })),
      set: jest.fn(),
      update: jest.fn(),
    };
    mockFirestore.runTransaction.mockImplementation(async (_db: unknown, fn: (t: typeof tx) => unknown) => fn(tx));
  });

  it('joins and consumes an invite use in the same transaction', async () => {
    await expect(addGroupMember('user-2', 'g1', 'ABC123')).resolves.toBe('joined');
    expect(tx.update).toHaveBeenCalledWith({ path: 'groupInvites/ABC123' }, { used: { op: 'increment', n: 1 } });
    expect(tx.set).toHaveBeenCalledWith({ path: 'groups/g1' }, { MemberIds: { op: 'arrayUnion', v: 'user-2' } }, { merge: true });
    expect(tx.set).toHaveBeenCalledWith({ path: 'users/user-2' }, { Groups: { op: 'arrayUnion', v: 'g1' } }, { merge: true });
    // Nothing written outside the transaction
    expect(mockFirestore.updateDoc).not.toHaveBeenCalled();
  });

  it('reads everything before writing (Firestore transaction rule)', async () => {
    await addGroupMember('user-2', 'g1', 'ABC123');
    const lastRead = Math.max(...tx.get.mock.invocationCallOrder);
    const firstWrite = Math.min(...tx.set.mock.invocationCallOrder, ...tx.update.mock.invocationCallOrder);
    expect(lastRead).toBeLessThan(firstWrite);
  });

  it('rejects the join without writing when the invite is used up', async () => {
    docs['groupInvites/ABC123'].used = 3;
    await expect(addGroupMember('user-2', 'g1', 'ABC123')).resolves.toBe('invite_unavailable');
    expect(tx.set).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('rejects a missing invite', async () => {
    await expect(addGroupMember('user-2', 'g1', 'NOPE')).resolves.toBe('invite_unavailable');
    expect(tx.set).not.toHaveBeenCalled();
  });

  it('does not consume a use when the user is already a member', async () => {
    docs['groups/g1'].MemberIds.push('user-2');
    await expect(addGroupMember('user-2', 'g1', 'ABC123')).resolves.toBe('already_member');
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('reports a missing group', async () => {
    await expect(addGroupMember('user-2', 'g404', 'ABC123')).resolves.toBe('group_not_found');
  });

  it('joins without touching invites when no invite code is given', async () => {
    await expect(addGroupMember('user-2', 'g1')).resolves.toBe('joined');
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('fails the join if the transaction fails, rather than half-joining', async () => {
    mockFirestore.runTransaction.mockRejectedValueOnce(new Error('permission-denied'));
    await expect(addGroupMember('user-2', 'g1', 'ABC123')).rejects.toThrow('permission-denied');
  });
});
