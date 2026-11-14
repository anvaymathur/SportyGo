/** The editable details of an event, as held by the edit form. */
export interface EventDetailsInput {
  title: string;
  /** Date and time the event starts */
  eventDate: Date;
  location: string;
  /** Free text from the cost field; blank means no cost */
  totalCost: string;
  votingEnabled: boolean;
  /** Last day people can RSVP (only used when voting is on) */
  votingCutoff: Date;
}

export type EventDetailsErrors = Partial<Record<'title' | 'eventDate' | 'location' | 'totalCost' | 'votingCutoff', string>>;

/** Stored as the cutoff when voting is off, matching what event creation writes. */
export const NO_CUTOFF = new Date('1970-01-01');

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Same rules as creating an event. Returns an empty object when everything is valid. */
export function validateEventDetails(input: EventDetailsInput, now: Date = new Date()): EventDetailsErrors {
  const errors: EventDetailsErrors = {};
  const title = input.title.trim();
  const location = input.location.trim();

  if (!title) errors.title = 'Event title is required';
  else if (title.length < 3) errors.title = 'Event title must be at least 3 characters';
  else if (title.length > 100) errors.title = 'Event title must be 100 characters or fewer';

  if (isNaN(input.eventDate.getTime())) errors.eventDate = 'Choose a date and time';
  else if (input.eventDate <= now) errors.eventDate = 'The event must be in the future';

  if (!location) errors.location = 'Location is required';
  else if (location.length < 3) errors.location = 'Location must be at least 3 characters';

  if (input.totalCost.trim() && (isNaN(Number(input.totalCost)) || Number(input.totalCost) < 0)) {
    errors.totalCost = 'Total cost must be a valid positive number';
  }

  if (input.votingEnabled) {
    if (isNaN(input.votingCutoff.getTime())) errors.votingCutoff = 'Choose an RSVP cutoff date';
    else if (startOfDay(input.votingCutoff) < startOfDay(now)) errors.votingCutoff = 'RSVP cutoff cannot be in the past';
    else if (!errors.eventDate && startOfDay(input.votingCutoff) > startOfDay(input.eventDate)) {
      errors.votingCutoff = 'RSVP cutoff cannot be after the event';
    }
  }
  return errors;
}

/** The Firestore fields to write for a valid form. */
export function toEventUpdates(input: EventDetailsInput) {
  const cutoff = new Date(input.votingCutoff);
  cutoff.setHours(23, 59, 59, 999);
  return {
    Title: input.title.trim(),
    EventDate: input.eventDate,
    Location: input.location.trim(),
    TotalCost: input.totalCost.trim() ? Number(input.totalCost) : 0,
    VotingEnabled: input.votingEnabled,
    CutoffDate: input.votingEnabled ? cutoff : NO_CUTOFF,
  };
}
