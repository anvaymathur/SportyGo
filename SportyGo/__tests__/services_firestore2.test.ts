import { mockFirestore } from './setup';
import { updateUserProfile, updateGroup, addGroupAdmin, removeGroupAdmin } from '../firebase/services_firestore2';

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
