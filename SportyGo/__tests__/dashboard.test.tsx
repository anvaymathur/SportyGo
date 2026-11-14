import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from './test-utils';
import { mockRouter } from './setup';
import Dashboard from '../app/(tabs)/dashboard';
import { getUserMatchHistory, getUserGroups, listenUserEvents, getUserVote } from '../firebase/services_firestore2';
import { matchOutcomeFor, summarizeMatches } from '../utils/matchStats';

jest.mock('../firebase/services_firestore2', () => ({
  getUserMatchHistory: jest.fn(),
  getUserGroups: jest.fn(async () => []),
  getUserVote: jest.fn(),
  listenUserEvents: jest.fn(),
  toDate: (value: Date) => value,
}));
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return { useFocusEffect: (effect: () => void) => React.useEffect(effect, [effect]) };
});

const match = (id: string, team1: [string, string, number], team2: [string, string, number]) =>
  ({ id, team1, team2, date: new Date('2026-11-01') }) as any;
const me = 'owner-1';

describe('match stats', () => {
  const matches = [
    match('a', [me, '', 21], ['x', '', 15]),      // win, on team 1
    match('b', ['x', 'y', 21], [me, 'z', 19]),    // loss, on team 2
    match('c', ['x', '', 11], [me, '', 11]),      // draw
    match('d', ['x', '', 21], ['y', '', 3]),      // not involved
  ];

  it('reports each match from the player\'s side', () => {
    expect(matchOutcomeFor(matches[0], me)).toEqual({ result: 'W', myScore: 21, theirScore: 15 });
    expect(matchOutcomeFor(matches[1], me)).toEqual({ result: 'L', myScore: 19, theirScore: 21 });
    expect(matchOutcomeFor(matches[2], me)).toEqual({ result: 'D', myScore: 11, theirScore: 11 });
    expect(matchOutcomeFor(matches[3], me)).toBeNull();
  });

  it('counts a draw as neither a win nor a loss, and ignores other people\'s matches', () => {
    expect(summarizeMatches(matches, me)).toEqual({ played: 3, wins: 1, losses: 1, draws: 1, winRate: 33.3 });
    expect(summarizeMatches([], me).winRate).toBe(0);
  });

  it('does not treat an empty doubles slot as the player', () => {
    expect(matchOutcomeFor(match('e', ['x', '', 21], ['y', '', 3]), '')).toBeNull();
  });
});

describe('Home screen', () => {
  beforeEach(() => {
    (listenUserEvents as jest.Mock).mockImplementation((_groups, _user, callback) => { callback([]); return () => undefined; });
    (getUserGroups as jest.Mock).mockResolvedValue([]);
  });

  it('invites a new player to record their first match', async () => {
    (getUserMatchHistory as jest.Mock).mockResolvedValue([]);
    renderWithTheme(<Dashboard />);
    fireEvent.press(await screen.findByText('Record a match'));
    expect(mockRouter.push).toHaveBeenCalledWith('/matches/addScore');
    expect(await screen.findByText(/Nothing coming up/)).toBeTruthy();
  });

  it('shows the record and recent results with the player\'s score first', async () => {
    (getUserMatchHistory as jest.Mock).mockResolvedValue([
      match('a', [me, '', 21], ['x', '', 15]),
      match('b', ['x', 'y', 21], [me, 'z', 19]),
    ]);
    renderWithTheme(<Dashboard />);
    expect(await screen.findByText('50%')).toBeTruthy();
    expect(screen.getByText('1W · 1L')).toBeTruthy();
    expect(screen.getByText('21 – 15')).toBeTruthy();
    expect(screen.getByText('19 – 21')).toBeTruthy();
  });

  it('lists the next events the player is going to and opens one', async () => {
    (getUserMatchHistory as jest.Mock).mockResolvedValue([]);
    const soon = { id: 'e1', Title: 'Doubles night', EventDate: new Date(Date.now() + 86_400_000), Location: 'Main gym' };
    const skipped = { id: 'e2', Title: 'Not for me', EventDate: new Date(Date.now() + 2 * 86_400_000), Location: 'Hall' };
    (listenUserEvents as jest.Mock).mockImplementation((_groups, _user, callback) => { callback([soon, skipped]); return () => undefined; });
    (getUserVote as jest.Mock).mockImplementation(async (eventId: string) => (eventId === 'e1' ? 'going' : 'not'));
    renderWithTheme(<Dashboard />);
    fireEvent.press(await screen.findByText('Doubles night'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/events/EventView', params: { eventId: 'e1' } });
    expect(screen.queryByText('Not for me')).toBeNull();
  });
});
