import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithTheme } from './test-utils';
import { mockRouter, mockSearchParams } from './setup';
import EditEvent from '../app/(tabs)/events/EditEvent';
import { getEvent, updateEvent, hasEventStarted } from '../firebase/services_firestore2';
import { validateEventDetails, toEventUpdates, NO_CUTOFF } from '../utils/eventForm';

jest.mock('../firebase/services_firestore2', () => ({
  getEvent: jest.fn(),
  updateEvent: jest.fn(async () => undefined),
  hasEventStarted: jest.fn(() => false),
  toDate: (value: Date) => value,
}));

const day = 86_400_000;
const inDays = (n: number) => new Date(Date.now() + n * day);
const event = () => ({
  id: 'e1', Title: 'Doubles night', EventDate: inDays(5), Location: 'Main gym', TotalCost: 40,
  CutoffDate: inDays(3), CreatorID: 'owner-1', VotingEnabled: true,
});

describe('validateEventDetails', () => {
  const valid = () => ({ title: 'Doubles night', eventDate: inDays(5), location: 'Main gym', totalCost: '40', votingEnabled: true, votingCutoff: inDays(3) });

  it('accepts a valid event', () => {
    expect(validateEventDetails(valid())).toEqual({});
  });

  it('requires a title, a location and a future date', () => {
    const errors = validateEventDetails({ ...valid(), title: ' ', location: 'ab', eventDate: inDays(-1) });
    expect(Object.keys(errors).sort()).toEqual(['eventDate', 'location', 'title']);
  });

  it('rejects a bad cost and a cutoff after the event', () => {
    expect(validateEventDetails({ ...valid(), totalCost: '-5' }).totalCost).toBeTruthy();
    expect(validateEventDetails({ ...valid(), votingCutoff: inDays(9) }).votingCutoff).toBe('RSVP cutoff cannot be after the event');
  });

  it('ignores the cutoff when RSVPs are off, and stores the placeholder', () => {
    const input = { ...valid(), votingEnabled: false, votingCutoff: inDays(-30) };
    expect(validateEventDetails(input)).toEqual({});
    expect(toEventUpdates(input)).toMatchObject({ VotingEnabled: false, CutoffDate: NO_CUTOFF, TotalCost: 40 });
  });
});

describe('EditEvent screen', () => {
  beforeEach(() => {
    mockSearchParams.eventId = 'e1';
    (getEvent as jest.Mock).mockResolvedValue(event());
    (hasEventStarted as jest.Mock).mockReturnValue(false);
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  it('loads the event and saves edited details', async () => {
    renderWithTheme(<EditEvent />);
    fireEvent.changeText(await screen.findByDisplayValue('Doubles night'), 'Singles night');
    fireEvent.changeText(screen.getByDisplayValue('Main gym'), 'Community hall');
    fireEvent.changeText(screen.getByDisplayValue('40'), '55.50');
    fireEvent.press(screen.getByText('Save changes'));
    await waitFor(() => expect(updateEvent).toHaveBeenCalledTimes(1));
    expect((updateEvent as jest.Mock).mock.calls[0]).toEqual(['e1', expect.objectContaining({
      Title: 'Singles night', Location: 'Community hall', TotalCost: 55.5, VotingEnabled: true,
    })]);
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
  });

  it('shows validation errors instead of saving', async () => {
    renderWithTheme(<EditEvent />);
    fireEvent.changeText(await screen.findByDisplayValue('Doubles night'), '');
    fireEvent.press(screen.getByText('Save changes'));
    expect(await screen.findByText('Event title is required')).toBeTruthy();
    expect(updateEvent).not.toHaveBeenCalled();
  });

  it('turns away anyone but the organiser', async () => {
    (getEvent as jest.Mock).mockResolvedValue({ ...event(), CreatorID: 'someone-else' });
    renderWithTheme(<EditEvent />);
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("Can't edit this event", 'Only the organiser can edit an event.'));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('refuses editing an event that has started', async () => {
    (hasEventStarted as jest.Mock).mockReturnValue(true);
    renderWithTheme(<EditEvent />);
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("Can't edit this event", 'This event has already started.'));
  });
});
