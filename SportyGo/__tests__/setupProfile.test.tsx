import React from 'react';
import { Alert, Linking } from 'react-native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { mockAuthUser, mockRouter } from './setup';
import { renderWithTheme } from './test-utils';
import SetupProfile from '../app/(userSetup)/setupProfile';
import { UserContext } from '../components/userContext';
import { checkForClaimableTemps, createUserProfile } from '../firebase/services_firestore2';

jest.mock('../firebase/services_firestore2', () => ({
  createUserProfile: jest.fn(async () => undefined),
  checkForClaimableTemps: jest.fn(async () => []),
  imageToBase64: jest.fn(),
}));

// A stand-in date picker: pressing it picks the date stored in mockPickedDate
let mockPickedDate = new Date(1990, 4, 1);
jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return (props: any) =>
    React.createElement(Pressable, { onPress: () => props.onChange({}, mockPickedDate), accessibilityLabel: 'pick date' },
      React.createElement(Text, null, 'picker'));
});

const saveUser = jest.fn(async () => undefined);
const renderSetup = () =>
  renderWithTheme(
    <UserContext.Provider value={{ globalUser: null, saveUser, clearUser: jest.fn() } as any}>
      <SetupProfile />
    </UserContext.Provider>
  );

const pickDob = (date: Date) => {
  mockPickedDate = date;
  fireEvent.press(screen.getByText('Date of Birth (YYYY-MM-DD)'));
  fireEvent.press(screen.getByLabelText('pick date'));
};

describe('SetupProfile', () => {
  let alertSpy: jest.SpyInstance;
  beforeEach(() => {
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockAuthUser.email = 'Olivia@Example.com';
    mockAuthUser.name = 'Olivia@Example.com'; // Auth0 often sets name = email
  });

  it('prefills the email from the login, lowercased, and locks it', () => {
    renderSetup();
    const email = screen.getByDisplayValue('olivia@example.com');
    expect(email.props.editable).toBe(false);
    // The name isn't prefilled with the email address
    expect(screen.getByPlaceholderText('Name').props.value).toBe('');
  });

  it('lets people without a login email type one', () => {
    delete mockAuthUser.email;
    renderSetup();
    expect(screen.getByPlaceholderText('Email').props.editable).toBe(true);
  });

  it('creates a profile without a phone number (it is optional)', async () => {
    renderSetup();
    fireEvent.changeText(screen.getByPlaceholderText('Name'), '  Olivia Owner ');
    pickDob(new Date(1990, 4, 1));
    await act(async () => { fireEvent.press(screen.getAllByText('Create Profile').at(-1)!); });

    await waitFor(() => expect(createUserProfile).toHaveBeenCalled());
    expect((createUserProfile as jest.Mock).mock.calls[0][1]).toMatchObject({
      id: 'owner-1',
      Name: 'Olivia Owner',
      Email: 'olivia@example.com',
      Phone: '',
    });
    expect(checkForClaimableTemps).toHaveBeenCalledWith('olivia@example.com', '');
    expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard');
  });

  it('rejects a partial phone number', async () => {
    renderSetup();
    fireEvent.changeText(screen.getByPlaceholderText('Name'), 'Olivia');
    fireEvent.changeText(screen.getByPlaceholderText('Phone (optional)'), '555');
    pickDob(new Date(1990, 4, 1));
    fireEvent.press(screen.getAllByText('Create Profile').at(-1)!);
    expect(alertSpy).toHaveBeenCalledWith('Invalid Phone', expect.stringContaining('10 digits'), expect.any(Array));
    expect(createUserProfile).not.toHaveBeenCalled();
  });

  it('turns away users under 13', () => {
    renderSetup();
    fireEvent.changeText(screen.getByPlaceholderText('Name'), 'Kid');
    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
    pickDob(tenYearsAgo);
    fireEvent.press(screen.getAllByText('Create Profile').at(-1)!);
    expect(alertSpy).toHaveBeenCalledWith('Age Restriction', expect.any(String), expect.any(Array));
    expect(createUserProfile).not.toHaveBeenCalled();
  });

  it('says what is missing', () => {
    renderSetup();
    fireEvent.press(screen.getAllByText('Create Profile').at(-1)!);
    expect(alertSpy).toHaveBeenCalledWith('Missing Information', 'Please enter your name, email and date of birth.', expect.any(Array));
  });

  it('links to the privacy policy', () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    renderSetup();
    fireEvent.press(screen.getByText('Privacy Policy'));
    expect(openURL).toHaveBeenCalledWith('https://sportygo-sparkpro.web.app/privacy');
  });
});
