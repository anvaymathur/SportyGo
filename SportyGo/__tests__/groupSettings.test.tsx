import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { mockAuthUser, mockRouter, mockSearchParams } from './setup';
import { renderWithTheme } from './test-utils';
import GroupSettings from '../app/(tabs)/groups/groupSettings';
import { getGroupById, updateGroup } from '../firebase/services_firestore2';
import { GroupDoc } from '../firebase/types_index';

jest.mock('../firebase/services_firestore2', () => ({
  getGroupById: jest.fn(),
  updateGroup: jest.fn(async () => undefined),
  imageToBase64: jest.fn(async () => 'data:image/jpeg;base64,NEW'),
}));

const baseGroup: GroupDoc = {
  id: 'g1',
  Name: 'Tuesday Tennis',
  OwnerId: 'owner-1',
  AdminIds: ['admin-1'],
  MemberIds: ['owner-1', 'admin-1', 'member-1'],
  Description: 'Weekly doubles',
  SkillLevel: 'competitive',
  Privacy: 'open',
  HomeCourt: 'Central Park',
  MeetingSchedule: 'weekly',
  PhotoUrl: 'INITIALS:TT',
} as GroupDoc;

const loadGroup = (overrides: Partial<GroupDoc> = {}) =>
  (getGroupById as jest.Mock).mockResolvedValue({ ...baseGroup, ...overrides });

async function renderScreen() {
  mockSearchParams.groupId = 'g1';
  renderWithTheme(<GroupSettings />);
  await waitFor(() => expect(screen.queryByText('Loading group settings...')).toBeNull());
}

describe('GroupSettings', () => {
  let alertSpy: jest.SpyInstance;
  beforeEach(() => {
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  it('blocks regular members from editing', async () => {
    mockAuthUser.sub = 'member-1';
    loadGroup();
    await renderScreen();
    expect(screen.getByText("You don't have permission to edit group settings.")).toBeTruthy();
    expect(screen.queryByText('Save Changes')).toBeNull();
  });

  it.each([['owner', 'owner-1'], ['admin', 'admin-1']])('lets the %s edit, prefilled with current values', async (_role, sub) => {
    mockAuthUser.sub = sub;
    loadGroup();
    await renderScreen();
    expect(screen.getByDisplayValue('Tuesday Tennis')).toBeTruthy();
    expect(screen.getByDisplayValue('Weekly doubles')).toBeTruthy();
    expect(screen.getByDisplayValue('Central Park')).toBeTruthy();
    expect(screen.getByText('Save Changes')).toBeTruthy();
  });

  it('shows "Group not found" for a missing group', async () => {
    (getGroupById as jest.Mock).mockResolvedValue(undefined);
    await renderScreen();
    expect(screen.getByText('Group not found.')).toBeTruthy();
  });

  it('saves trimmed values and refreshes the initials placeholder after a rename', async () => {
    loadGroup();
    await renderScreen();
    fireEvent.changeText(screen.getByDisplayValue('Tuesday Tennis'), '  Friday Football  ');
    fireEvent.press(screen.getByText('Save Changes'));

    await waitFor(() => expect(updateGroup).toHaveBeenCalled());
    expect(updateGroup).toHaveBeenCalledWith('g1', expect.objectContaining({
      Name: 'Friday Football',
      PhotoUrl: 'INITIALS:FF',
      Description: 'Weekly doubles',
      HomeCourt: 'Central Park',
    }));
    expect(alertSpy).toHaveBeenCalledWith('Success', 'Group settings updated.', expect.any(Array));
  });

  it('keeps an uploaded photo when the group is renamed', async () => {
    loadGroup({ PhotoUrl: 'data:image/jpeg;base64,OLD' });
    await renderScreen();
    fireEvent.changeText(screen.getByDisplayValue('Tuesday Tennis'), 'Friday Football');
    fireEvent.press(screen.getByText('Save Changes'));
    await waitFor(() => expect(updateGroup).toHaveBeenCalled());
    expect((updateGroup as jest.Mock).mock.calls[0][1].PhotoUrl).toBe('data:image/jpeg;base64,OLD');
  });

  it('rejects an empty name', async () => {
    loadGroup();
    await renderScreen();
    fireEvent.changeText(screen.getByDisplayValue('Tuesday Tennis'), '   ');
    fireEvent.press(screen.getByText('Save Changes'));
    expect(alertSpy).toHaveBeenCalledWith('Missing Information', 'Please enter a group name.');
    expect(updateGroup).not.toHaveBeenCalled();
  });

  it('only shows the remove-photo button when there is a photo, and clearing falls back to initials', async () => {
    loadGroup();
    await renderScreen();
    expect(screen.queryByLabelText('Remove group photo')).toBeNull();

    (getGroupById as jest.Mock).mockResolvedValue({ ...baseGroup, PhotoUrl: 'data:image/jpeg;base64,OLD' });
    screen.unmount();
    await renderScreen();
    fireEvent.press(screen.getByLabelText('Remove group photo'));
    expect(screen.queryByLabelText('Remove group photo')).toBeNull();

    fireEvent.press(screen.getByText('Save Changes'));
    await waitFor(() => expect(updateGroup).toHaveBeenCalled());
    expect((updateGroup as jest.Mock).mock.calls[0][1].PhotoUrl).toBe('INITIALS:TT');
  });

  it('does not count whitespace toward the 150 character description limit', async () => {
    loadGroup({ Description: '' });
    await renderScreen();
    const description = screen.getByPlaceholderText("What's this group about?");
    // A native maxLength would count spaces and cut typing off early (changeText doesn't enforce it)
    expect(description.props.maxLength).toBeUndefined();

    // 150 letters plus 30 spaces/newlines is allowed
    const atLimit = ('abcde \n'.repeat(30)).trimEnd();
    expect(atLimit.replace(/\s/g, '').length).toBe(150);
    fireEvent.changeText(description, atLimit);
    expect(screen.getByDisplayValue(atLimit)).toBeTruthy();
    expect(screen.getByText('150/150')).toBeTruthy();

    // A 151st letter is rejected
    fireEvent.changeText(description, atLimit + 'x');
    expect(screen.getByDisplayValue(atLimit)).toBeTruthy();
    expect(screen.getByText('150/150')).toBeTruthy();
  });

  it('goes back after a successful save', async () => {
    loadGroup();
    await renderScreen();
    fireEvent.press(screen.getByText('Save Changes'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    const buttons = alertSpy.mock.calls[0][2];
    buttons[0].onPress();
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
