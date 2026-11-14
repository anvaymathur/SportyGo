import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from './test-utils';
import { MatchEventPicker } from '../components/MatchEventPicker';
import { eventsForMatch } from '../utils/matchEvents';
import { getUserEvents, getUserGroups } from '../firebase/services_firestore2';

jest.mock('../firebase/services_firestore2', () => ({
  getUserGroups: jest.fn(async () => [{ id: 'g1' }]),
  getUserEvents: jest.fn(),
  toDate: (value: Date) => value,
}));

const DAY = 86_400_000;
const now = new Date('2026-11-14T18:00:00');
const event = (id: string, daysFromNow: number, base: Date = now) =>
  ({ id, Title: `Event ${id}`, EventDate: new Date(base.getTime() + daysFromNow * DAY), Location: 'Gym' }) as any;

describe('eventsForMatch', () => {
  it('offers recent events and ones starting within a day, closest first', () => {
    const picked = eventsForMatch([event('old', -45), event('lastWeek', -7), event('today', -0.1), event('tomorrow', 0.9), event('nextWeek', 7)], now);
    expect(picked.map((e) => e.id)).toEqual(['today', 'tomorrow', 'lastWeek']);
  });

  it('skips events with no usable date', () => {
    expect(eventsForMatch([{ id: 'x', Title: 'x', EventDate: new Date('nope') } as any], now)).toEqual([]);
  });
});

describe('MatchEventPicker', () => {
  const props = () => ({ userId: 'owner-1', selectedEventId: null, onSelect: jest.fn(), onCreateEvent: jest.fn() });

  it('lists the player\'s recent events and reports the one chosen', async () => {
    const recent = event('e1', -1, new Date());
    (getUserEvents as jest.Mock).mockResolvedValue([recent, event('far', 30, new Date())]);
    const p = props();
    renderWithTheme(<MatchEventPicker {...p} />);
    fireEvent.press(await screen.findByText('Event e1'));
    expect(p.onSelect).toHaveBeenCalledWith(recent);
    expect(screen.queryByText('Event far')).toBeNull();
    expect(getUserEvents).toHaveBeenCalledWith(['g1'], 'owner-1');
  });

  it('sends a player with no recent events to create one', async () => {
    (getUserEvents as jest.Mock).mockResolvedValue([]);
    const p = props();
    renderWithTheme(<MatchEventPicker {...p} />);
    fireEvent.press(await screen.findByText('Create an event'));
    expect(p.onCreateEvent).toHaveBeenCalled();
  });

  it('offers a retry when events cannot be loaded', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (getUserGroups as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    (getUserEvents as jest.Mock).mockResolvedValue([event('e1', -1, new Date())]);
    renderWithTheme(<MatchEventPicker {...props()} />);
    fireEvent.press(await screen.findByText('Try again'));
    expect(await screen.findByText('Event e1')).toBeTruthy();
  });
});
