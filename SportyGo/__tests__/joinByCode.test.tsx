import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithTheme } from './test-utils';
import { mockRouter, mockSearchParams } from './setup';
import DisplayGroups from '../app/(tabs)/groups/displayGroups';
import GroupInviteScreen from '../app/(tabs)/groups/[inviteCode]';
import { getUserGroups, getGroupInvite, getGroupById, addGroupMember, isInviteUsable } from '../firebase/services_firestore2';

jest.mock('../firebase/services_firestore2', () => ({
  getUserGroups: jest.fn(),
  getGroupInvite: jest.fn(),
  getGroupById: jest.fn(),
  addGroupMember: jest.fn(),
  isInviteUsable: jest.fn(),
}));
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return { useFocusEffect: (effect: () => void) => React.useEffect(effect, [effect]) };
});

const invite = { groupId: 'g1', inviteCode: 'aB3_x-', inviteLink: '', validUntil: new Date(), maxUses: 5, expired: false, used: 0 };
const group = { id: 'g1', Name: 'Tuesday Tennis', OwnerId: 'someone', MemberIds: ['someone', 'other'], Description: 'Doubles' };

describe('Groups tab: join with code', () => {
  beforeEach(() => {
    (getUserGroups as jest.Mock).mockResolvedValue([]);
  });

  it('shows an empty state with both ways to get into a group', async () => {
    renderWithTheme(<DisplayGroups />);
    expect(await screen.findByText('No groups yet')).toBeTruthy();
    expect(screen.getByText('Create group')).toBeTruthy();
    expect(screen.getByText('Join with code')).toBeTruthy();
  });

  it('opens the invite for a typed code or a pasted link', async () => {
    renderWithTheme(<DisplayGroups />);
    fireEvent.press(await screen.findByText('Join with code'));
    fireEvent.changeText(screen.getByPlaceholderText('Invite code or link'), 'https://sportygo-sparkpro.web.app/groups/aB3_x-');
    fireEvent.press(screen.getByText('Join'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/groups/[inviteCode]', params: { inviteCode: 'aB3_x-' } });
  });

  it('asks again when the code is unusable', async () => {
    renderWithTheme(<DisplayGroups />);
    fireEvent.press(await screen.findByText('Join with code'));
    fireEvent.changeText(screen.getByPlaceholderText('Invite code or link'), '!!');
    fireEvent.press(screen.getByText('Join'));
    expect(screen.getByText('Enter the invite code or paste the invite link.')).toBeTruthy();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('offers a retry when groups fail to load', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (getUserGroups as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    renderWithTheme(<DisplayGroups />);
    fireEvent.press(await screen.findByText('Try again'));
    expect(await screen.findByText('No groups yet')).toBeTruthy();
  });
});

describe('Invite screen', () => {
  beforeEach(() => {
    mockSearchParams.inviteCode = 'aB3_x-';
    (getGroupInvite as jest.Mock).mockResolvedValue(invite);
    (getGroupById as jest.Mock).mockResolvedValue(group);
    (isInviteUsable as jest.Mock).mockReturnValue(true);
  });

  it('shows which group the invite is for and joins it', async () => {
    (addGroupMember as jest.Mock).mockResolvedValue('joined');
    renderWithTheme(<GroupInviteScreen />);
    expect(await screen.findByText('Tuesday Tennis')).toBeTruthy();
    expect(screen.getByText('2 members')).toBeTruthy();
    fireEvent.press(screen.getByText('Join group'));
    await waitFor(() => expect(addGroupMember).toHaveBeenCalledWith('owner-1', 'g1', 'aB3_x-'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/groups/viewMembers', params: { groupId: 'g1' } }));
  });

  it('explains an unknown code and offers a way back', async () => {
    (getGroupInvite as jest.Mock).mockResolvedValue(undefined);
    renderWithTheme(<GroupInviteScreen />);
    expect(await screen.findByText('Invite not valid')).toBeTruthy();
    fireEvent.press(screen.getByText('← Back'));
    expect(mockRouter.replace).toHaveBeenCalledWith('/groups/displayGroups');
  });

  it('recognises an existing member', async () => {
    (getGroupById as jest.Mock).mockResolvedValue({ ...group, MemberIds: ['owner-1'] });
    renderWithTheme(<GroupInviteScreen />);
    expect(await screen.findByText("You're already in Tuesday Tennis")).toBeTruthy();
  });

  it('offers a retry when the invite cannot be checked', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (getGroupInvite as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    renderWithTheme(<GroupInviteScreen />);
    fireEvent.press(await screen.findByText('Try again'));
    expect(await screen.findByText('Tuesday Tennis')).toBeTruthy();
  });
});
