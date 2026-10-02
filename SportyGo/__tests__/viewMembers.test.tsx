import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { mockAuthUser, mockRouter, mockSearchParams } from './setup';
import { renderWithTheme } from './test-utils';
import ViewMembers from '../app/(tabs)/groups/viewMembers';
import { addGroupAdmin, getGroupById, getUsersByIds, removeGroupAdmin } from '../firebase/services_firestore2';

jest.mock('../firebase/services_firestore2', () => ({
  getGroupById: jest.fn(),
  getUsersByIds: jest.fn(),
  addGroupAdmin: jest.fn(async () => undefined),
  removeGroupAdmin: jest.fn(async () => undefined),
}));

const group = {
  id: 'g1',
  Name: 'Tuesday Tennis',
  OwnerId: 'owner-1',
  AdminIds: ['admin-1'],
  MemberIds: ['owner-1', 'admin-1', 'member-1'],
};
const users = [
  { id: 'owner-1', Name: 'Olivia Owner', Email: 'olivia@example.com' },
  { id: 'admin-1', Name: 'Adam Admin', Email: 'adam@example.com' },
  { id: 'member-1', Name: 'Mia Member', Email: 'mia@example.com' },
];

async function renderAs(sub: string) {
  mockAuthUser.sub = sub;
  mockSearchParams.groupId = 'g1';
  (getGroupById as jest.Mock).mockResolvedValue({ ...group, AdminIds: [...group.AdminIds] });
  (getUsersByIds as jest.Mock).mockResolvedValue(users);
  renderWithTheme(<ViewMembers />);
  await waitFor(() => expect(screen.getByText('3 members')).toBeTruthy());
}

// Run the destructive/confirm button of the most recent Alert
async function confirmAlert(alertSpy: jest.SpyInstance, buttonText: string) {
  const buttons = alertSpy.mock.calls.at(-1)[2];
  await act(async () => {
    await buttons.find((b: any) => b.text === buttonText).onPress();
  });
}

describe('ViewMembers', () => {
  let alertSpy: jest.SpyInstance;
  beforeEach(() => {
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  it('shows Owner and Admin badges', async () => {
    await renderAs('member-1');
    expect(screen.getByText('Owner')).toBeTruthy();
    expect(screen.getByText('Admin')).toBeTruthy();
  });

  it.each([['owner', 'owner-1'], ['admin', 'admin-1']])('shows the Settings button to the %s and opens group settings', async (_role, sub) => {
    await renderAs(sub);
    fireEvent.press(screen.getByText('Settings'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/groups/groupSettings', params: { groupId: 'g1' } });
  });

  it('hides the Settings button from regular members', async () => {
    await renderAs('member-1');
    expect(screen.queryByText('Settings')).toBeNull();
  });

  it('only the owner can toggle admins, and never on their own card', async () => {
    await renderAs('admin-1');
    expect(screen.queryByLabelText(/admin$/)).toBeNull();
    screen.unmount();

    await renderAs('owner-1');
    expect(screen.getByLabelText('Make Mia Member an admin')).toBeTruthy();
    expect(screen.getByLabelText('Remove Adam Admin as admin')).toBeTruthy();
    expect(screen.queryByLabelText(/Olivia Owner/)).toBeNull();
  });

  it('owner can promote a member after confirming', async () => {
    await renderAs('owner-1');
    fireEvent.press(screen.getByLabelText('Make Mia Member an admin'));
    expect(alertSpy).toHaveBeenCalledWith('Make Admin', expect.stringContaining('Mia Member'), expect.any(Array));
    expect(addGroupAdmin).not.toHaveBeenCalled();

    await confirmAlert(alertSpy, 'Make Admin');
    expect(addGroupAdmin).toHaveBeenCalledWith('g1', 'member-1');
    expect(screen.getAllByText('Admin')).toHaveLength(2);
    expect(screen.getByLabelText('Remove Mia Member as admin')).toBeTruthy();
  });

  it('owner can demote an admin after confirming', async () => {
    await renderAs('owner-1');
    fireEvent.press(screen.getByLabelText('Remove Adam Admin as admin'));
    await confirmAlert(alertSpy, 'Remove');
    expect(removeGroupAdmin).toHaveBeenCalledWith('g1', 'admin-1');
    expect(screen.queryByText('Admin')).toBeNull();
    expect(screen.getByLabelText('Make Adam Admin an admin')).toBeTruthy();
  });

  it('leaves roles unchanged and shows an error when the update fails', async () => {
    (addGroupAdmin as jest.Mock).mockRejectedValueOnce(new Error('permission-denied'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await renderAs('owner-1');
    fireEvent.press(screen.getByLabelText('Make Mia Member an admin'));
    await confirmAlert(alertSpy, 'Make Admin');
    expect(alertSpy).toHaveBeenLastCalledWith('Error', 'Failed to make admin.');
    expect(screen.getAllByText('Admin')).toHaveLength(1);
  });
});
