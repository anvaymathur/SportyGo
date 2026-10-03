import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { mockRouter, mockSearchParams } from './setup';
import { renderWithTheme } from './test-utils';
import ViewIndividualScore from '../app/(tabs)/matches/viewIndividualScore';
import { deleteMatchHistory, getMatchHistoryById } from '../firebase/services_firestore2';

jest.mock('../firebase/services_firestore2', () => ({
  getMatchHistoryById: jest.fn(),
  getUserProfile: jest.fn(async (id: string) => ({ id, Name: id === 'owner-1' ? 'Olivia' : 'Sam' })),
  deleteMatchHistory: jest.fn(async () => undefined),
}));

async function renderMatch() {
  mockSearchParams.matchId = 'm1';
  (getMatchHistoryById as jest.Mock).mockResolvedValue({ id: 'm1', team1: ['owner-1', '', 21], team2: ['p2', '', 15], date: new Date('2026-05-01') });
  renderWithTheme(<ViewIndividualScore />);
  await waitFor(() => expect(screen.getByText('Delete match')).toBeTruthy());
}

describe('ViewIndividualScore', () => {
  let alertSpy: jest.SpyInstance;
  beforeEach(() => {
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  it('deletes a match after confirmation and returns to the history', async () => {
    await renderMatch();
    fireEvent.press(screen.getByText('Delete match'));
    expect(deleteMatchHistory).not.toHaveBeenCalled();
    const buttons = alertSpy.mock.calls.at(-1)[2];
    await act(async () => { await buttons.find((b: any) => b.text === 'Delete').onPress(); });
    expect(deleteMatchHistory).toHaveBeenCalledWith('m1');
    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/matches/viewScore');
  });

  it('explains when the delete fails', async () => {
    (deleteMatchHistory as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await renderMatch();
    fireEvent.press(screen.getByText('Delete match'));
    const buttons = alertSpy.mock.calls.at(-1)[2];
    await act(async () => { await buttons.find((b: any) => b.text === 'Delete').onPress(); });
    expect(alertSpy).toHaveBeenLastCalledWith('Error', "We couldn't delete the match. Please try again.");
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('back goes back instead of stacking another history screen', async () => {
    await renderMatch();
    fireEvent.press(screen.getByLabelText('Back'));
    expect(mockRouter.back).toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});
