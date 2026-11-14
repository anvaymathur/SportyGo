import { EventDoc } from '@/firebase/types_index';
import { toDate } from '@/firebase/services_firestore2';

const DAY = 86_400_000;
/** How far back an event can be and still be offered when recording a match. */
export const MATCH_EVENT_LOOKBACK_DAYS = 30;
/** Events starting within this many days are offered too (scores are sometimes entered early). */
export const MATCH_EVENT_LOOKAHEAD_DAYS = 1;

/**
 * The events a match can be recorded against: ones from the last 30 days up to tomorrow,
 * closest to now first (the event someone just played is nearly always the first).
 */
export function eventsForMatch(events: EventDoc[], now: Date = new Date()): EventDoc[] {
  const earliest = now.getTime() - MATCH_EVENT_LOOKBACK_DAYS * DAY;
  const latest = now.getTime() + MATCH_EVENT_LOOKAHEAD_DAYS * DAY;
  return events
    .map((event) => ({ event, time: toDate(event.EventDate).getTime() }))
    .filter(({ time }) => !isNaN(time) && time >= earliest && time <= latest)
    .sort((a, b) => Math.abs(a.time - now.getTime()) - Math.abs(b.time - now.getTime()))
    .map(({ event }) => event);
}
