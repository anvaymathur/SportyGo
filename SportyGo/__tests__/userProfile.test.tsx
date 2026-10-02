import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { mockFirestore } from './setup';
import { renderWithTheme } from './test-utils';
import UserProfileScreen from '../app/(tabs)/userProfile';
import { UserContext } from '../components/userContext';
import { getUserGroups, imageToBase64, updateUserProfile } from '../firebase/services_firestore2';
import * as ImagePicker from 'expo-image-picker';

jest.mock('../firebase/services_firestore2', () => ({
  updateUserProfile: jest.fn(async () => undefined),
  getUserGroups: jest.fn(),
  imageToBase64: jest.fn(),
}));

const profile = {
  Name: 'Olivia Owner',
  Email: 'olivia@example.com',
  Phone: '5551234567',
  PhotoUrl: '',
  DateOfBirth: '1995-06-15T00:00:00',
};

const saveUser = jest.fn(async () => undefined);

async function renderProfile() {
  (mockFirestore.onSnapshot as jest.Mock).mockImplementation((_ref: unknown, onNext: (snap: any) => void) => {
    onNext({ exists: () => true, data: () => profile });
    return () => undefined;
  });
  (getUserGroups as jest.Mock).mockResolvedValue([{ id: 'g1' }, { id: 'g2' }]);
  renderWithTheme(
    <UserContext.Provider value={{ globalUser: null, saveUser } as any}>
      <UserProfileScreen />
    </UserContext.Provider>
  );
  await waitFor(() => expect(screen.getByText('2')).toBeTruthy()); // group count loaded
}

describe('UserProfile', () => {
  let alertSpy: jest.SpyInstance;
  beforeEach(() => {
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  it('shows the profile read-only by default', async () => {
    await renderProfile();
    expect(screen.getByText('Olivia Owner')).toBeTruthy();
    expect(screen.getByText('olivia@example.com')).toBeTruthy();
    expect(screen.getByText('5551234567')).toBeTruthy();
    expect(screen.getByText('1995-06-15')).toBeTruthy();
    expect(screen.queryByDisplayValue('Olivia Owner')).toBeNull();
  });

  it('edit mode makes name and phone editable but never the email', async () => {
    await renderProfile();
    fireEvent.press(screen.getByText('Edit'));
    expect(screen.getByDisplayValue('Olivia Owner')).toBeTruthy();
    expect(screen.getByDisplayValue('5551234567')).toBeTruthy();
    expect(screen.getByText('olivia@example.com')).toBeTruthy();
    expect(screen.queryByDisplayValue('olivia@example.com')).toBeNull();
  });

  it('saves edited fields without touching the email', async () => {
    await renderProfile();
    fireEvent.press(screen.getByText('Edit'));
    fireEvent.changeText(screen.getByDisplayValue('Olivia Owner'), '  Liv Owner ');
    fireEvent.changeText(screen.getByDisplayValue('5551234567'), '(555) 999-8888');
    fireEvent.press(screen.getByText('Save'));

    await waitFor(() => expect(updateUserProfile).toHaveBeenCalled());
    const [uid, updates] = (updateUserProfile as jest.Mock).mock.calls[0];
    expect(uid).toBe('owner-1');
    expect(updates).toEqual(expect.objectContaining({ Name: 'Liv Owner', Phone: '5559998888' }));
    expect(updates).not.toHaveProperty('Email');
    expect(saveUser).toHaveBeenCalledWith({ name: 'Liv Owner', email: 'olivia@example.com' });
    await waitFor(() => expect(screen.getByText('Edit')).toBeTruthy());
  });

  it('rejects an invalid phone number', async () => {
    await renderProfile();
    fireEvent.press(screen.getByText('Edit'));
    fireEvent.changeText(screen.getByDisplayValue('5551234567'), '555');
    fireEvent.press(screen.getByText('Save'));
    expect(alertSpy).toHaveBeenCalledWith('Invalid Phone', 'Phone number must be exactly 10 digits.', expect.any(Array));
    expect(updateUserProfile).not.toHaveBeenCalled();
  });

  it('rejects an empty name', async () => {
    await renderProfile();
    fireEvent.press(screen.getByText('Edit'));
    fireEvent.changeText(screen.getByDisplayValue('Olivia Owner'), '   ');
    fireEvent.press(screen.getByText('Save'));
    expect(alertSpy).toHaveBeenCalledWith('Missing Information', 'Name cannot be empty.', expect.any(Array));
    expect(updateUserProfile).not.toHaveBeenCalled();
  });

  it('cancel discards edits', async () => {
    await renderProfile();
    fireEvent.press(screen.getByText('Edit'));
    fireEvent.changeText(screen.getByDisplayValue('Olivia Owner'), 'Someone Else');
    fireEvent.press(screen.getByText('Cancel'));
    expect(screen.getByText('Olivia Owner')).toBeTruthy();
    expect(updateUserProfile).not.toHaveBeenCalled();
  });
  it('waits for a newly picked photo to finish processing before saving', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///new.jpg' }],
    });
    let finishConversion!: (value: string) => void;
    (imageToBase64 as jest.Mock).mockReturnValueOnce(new Promise((resolve) => { finishConversion = resolve; }));

    await renderProfile();
    fireEvent.press(screen.getByText('Edit'));
    fireEvent.press(screen.getByLabelText('Change photo'));
    await waitFor(() => expect(imageToBase64).toHaveBeenCalledWith('file:///new.jpg'));

    // Still converting: Save does nothing
    fireEvent.press(screen.getByText('Save'));
    expect(updateUserProfile).not.toHaveBeenCalled();

    await act(async () => finishConversion('data:image/jpeg;base64,NEW'));
    fireEvent.press(screen.getByText('Save'));
    await waitFor(() => expect(updateUserProfile).toHaveBeenCalled());
    expect((updateUserProfile as jest.Mock).mock.calls[0][1].PhotoUrl).toBe('data:image/jpeg;base64,NEW');
  });
});
