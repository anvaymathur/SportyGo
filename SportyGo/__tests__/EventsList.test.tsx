import React from 'react';
import { screen, waitFor } from '@testing-library/react-native';
import { renderWithTheme } from './test-utils';
import EventsList from '../app/(tabs)/events/EventsList';
import { getUserGroups, getVoteCounts, listenUserEvents } from '../firebase/services_firestore2';

const mockUnsubscribe = jest.fn();
jest.mock('../firebase/services_firestore2', () => ({
  getUserGroups: jest.fn(async () => [{ id: 'g1' }, { id: 'g2' }]),
  listenUserEvents: jest.fn(),
  getVoteCounts: jest.fn(async () => ({ going: 3, maybe: 2, not: 4 })),
  getUserVote: jest.fn(async () => 'going'),
  hasEventStarted: (date: Date) => new Date() >= new Date(date),
}));

const inAWeek = new Date(Date.now() + 7 * 86_400_000);

describe('EventsList', () => {
  beforeEach(() => {
    (listenUserEvents as jest.Mock).mockImplementation((_groups: string[], _user: string, cb: (events: any[]) => void) => {
      cb([
        { id: 'e1', Title: 'Tuesday doubles', EventDate: inAWeek, CutoffDate: inAWeek, Location: 'Central Park', VotingEnabled: true, CreatorID: 'someone', GroupIDs: ['g1'] },
        { id: 'e2', Title: 'No RSVP game', EventDate: inAWeek, Location: 'Gym', VotingEnabled: false, CreatorID: 'owner-1', GroupIDs: [] },
      ]);
      return mockUnsubscribe;
    });
  });

  it("listens to the user's own events (groups, invitations, created)", async () => {
    renderWithTheme(<EventsList />);
    await waitFor(() => expect(listenUserEvents).toHaveBeenCalledWith(['g1', 'g2'], 'owner-1', expect.any(Function)));
    expect(getUserGroups).toHaveBeenCalledWith('owner-1');
    await waitFor(() => expect(screen.getByText('3 attending')).toBeTruthy()); // let vote data settle
  });

  it('counts only "going" responses as attending', async () => {
    renderWithTheme(<EventsList />);
    // 3 going, 2 maybe, 4 not going: previously shown as "9 attending"
    await waitFor(() => expect(screen.getByText('3 attending')).toBeTruthy());
    expect(screen.queryByText('9 attending')).toBeNull();
    expect(screen.getByText('No attendance tracking')).toBeTruthy();
  });

  it('still lists an event when its vote counts fail to load', async () => {
    (getVoteCounts as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    renderWithTheme(<EventsList />);
    await waitFor(() => expect(screen.getByText('Tuesday doubles')).toBeTruthy());
    expect(screen.getByText('0 attending')).toBeTruthy();
  });

  it('unsubscribes when the screen closes', async () => {
    const { unmount } = renderWithTheme(<EventsList />);
    await waitFor(() => expect(screen.getByText('3 attending')).toBeTruthy());
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});
