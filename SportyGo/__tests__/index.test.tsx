import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { mockRouter } from './setup';
import { renderWithTheme } from './test-utils';
import Index from '../app/index';
import { UserContext } from '../components/userContext';
import { checkForClaimableTemps, getUserProfile } from '../firebase/services_firestore2';

jest.mock('../firebase/services_firestore2', () => ({
  getUserProfile: jest.fn(),
  checkForClaimableTemps: jest.fn(),
}));

const saveUser = jest.fn(async () => undefined);
const renderIndex = () =>
  renderWithTheme(
    <UserContext.Provider value={{ globalUser: null, saveUser } as any}>
      <Index />
    </UserContext.Provider>
  );

describe('Launch screen', () => {
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => undefined));

  it('routes a signed-in user with a profile to the dashboard', async () => {
    (getUserProfile as jest.Mock).mockResolvedValue({ Name: 'Olivia', Email: 'o@example.com', Phone: '5551234567' });
    (checkForClaimableTemps as jest.Mock).mockResolvedValue([]);
    renderIndex();
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard'));
  });

  it('still reaches the dashboard if the temp-user check fails', async () => {
    (getUserProfile as jest.Mock).mockResolvedValue({ Name: 'Olivia', Email: 'o@example.com', Phone: '5551234567' });
    (checkForClaimableTemps as jest.Mock).mockRejectedValue(new Error('offline'));
    renderIndex();
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard'));
  });

  it('shows a retry instead of spinning forever when the profile fails to load', async () => {
    (getUserProfile as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    renderIndex();
    await waitFor(() => expect(screen.getByText("Couldn't load your profile")).toBeTruthy());
    expect(mockRouter.replace).not.toHaveBeenCalled();

    (getUserProfile as jest.Mock).mockResolvedValue({ Name: 'Olivia', Email: 'o@example.com', Phone: '5551234567' });
    (checkForClaimableTemps as jest.Mock).mockResolvedValue([]);
    fireEvent.press(screen.getByText('Try again'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard'));
  });
});
