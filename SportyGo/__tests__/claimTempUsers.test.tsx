import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { mockRouter, mockSearchParams } from './setup';
import { renderWithTheme } from './test-utils';
import ClaimTempUsers from '../app/(userSetup)/claimTempUsers';
import { getUserProfile, markTempClaimed, migrateMatchRefs } from '../firebase/services_firestore2';
import { getSkippedTempIds } from '../utils/claimPrompts';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../firebase/services_firestore2', () => ({
  getUserProfile: jest.fn(),
  getUserMatchHistory: jest.fn(async () => [{ id: 'm1' }]),
  migrateMatchRefs: jest.fn(async () => 1),
  markTempClaimed: jest.fn(async () => undefined),
  checkForClaimableTemps: jest.fn(async () => []),
}));

const temp = (id: string, Name: string) => ({ id, Name, Email: 'me@example.com', Phone: '', Groups: [], Address: '', isTemp: true });

async function renderWith(ids: string[]) {
  mockSearchParams.ids = JSON.stringify(ids);
  renderWithTheme(<ClaimTempUsers />);
  await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
}

describe('ClaimTempUsers', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    (getUserProfile as jest.Mock).mockImplementation(async (id: string) =>
      ({ t1: temp('t1', 'Casual Olivia'), t2: temp('t2', 'Other Olivia') } as any)[id]);
  });

  it('claims the selected player and remembers the rest as skipped', async () => {
    await renderWith(['t1', 't2']);
    const claimButtons = screen.getAllByText('Claim');
    fireEvent.press(claimButtons[0]);
    await act(async () => { fireEvent.press(screen.getByText('Claim Selected')); });

    expect(migrateMatchRefs).toHaveBeenCalledWith('t1', 'owner-1');
    expect(markTempClaimed).toHaveBeenCalledWith('t1', 'owner-1');
    expect(markTempClaimed).not.toHaveBeenCalledWith('t2', expect.anything());
    expect(Array.from(await getSkippedTempIds('owner-1'))).toEqual(['t2']);
    expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard');
  });

  it("'Skip for now' stops the prompt coming back on every launch", async () => {
    await renderWith(['t1', 't2']);
    await act(async () => { fireEvent.press(screen.getByText('Skip for now')); });
    expect(Array.from(await getSkippedTempIds('owner-1')).sort()).toEqual(['t1', 't2']);
    expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard');
  });

  it('goes straight to the dashboard when there is nothing to claim', async () => {
    await renderWith(['gone']);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard'));
  });
});
