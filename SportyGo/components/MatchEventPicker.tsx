import React, { useCallback, useEffect, useState } from 'react';
import { YStack, XStack, Text, Button, Spinner, useTheme } from 'tamagui';
import { Ionicons } from '@expo/vector-icons';
import { EventDoc } from '@/firebase/types_index';
import { getUserEvents, getUserGroups, toDate } from '@/firebase/services_firestore2';
import { eventsForMatch, MATCH_EVENT_LOOKBACK_DAYS } from '@/utils/matchEvents';

interface MatchEventPickerProps {
  userId: string;
  selectedEventId: string | null;
  onSelect: (event: EventDoc) => void;
  /** Called when the user chooses to go and create an event because none fit */
  onCreateEvent: () => void;
}

/** Lets the user pick which of their recent events a match was played at. */
export function MatchEventPicker({ userId, selectedEventId, onSelect, onCreateEvent }: MatchEventPickerProps) {
  const theme = useTheme();
  const [events, setEvents] = useState<EventDoc[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');

  const load = useCallback(async () => {
    if (!userId) return;
    setState('loading');
    try {
      const groups = await getUserGroups(userId);
      const all = await getUserEvents(groups.map((g) => g.id), userId);
      setEvents(eventsForMatch(all));
      setState('ready');
    } catch (error) {
      console.error('Error loading events for match:', error);
      setState('failed');
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  if (state === 'loading') {
    return (
      <XStack items="center" gap="$2" py="$2">
        <Spinner size="small" color="$color9" />
        <Text color="$color10">Loading your events…</Text>
      </XStack>
    );
  }

  if (state === 'failed') {
    return (
      <YStack gap="$2">
        <Text color="$color10">Couldn&apos;t load your events. Check your connection.</Text>
        <Button self="flex-start" bg="$color2" borderColor="$color6" borderWidth={1} onPress={load}>
          <Text color="$color">Try again</Text>
        </Button>
      </YStack>
    );
  }

  if (events.length === 0) {
    return (
      <YStack gap="$2">
        <Text color="$color10">
          You have no events in the last {MATCH_EVENT_LOOKBACK_DAYS} days. Every match belongs to an event, so create
          one first.
        </Text>
        <Button self="flex-start" bg="$color9" borderWidth={0} onPress={onCreateEvent}>
          <Text color="$color1">Create an event</Text>
        </Button>
      </YStack>
    );
  }

  return (
    <YStack gap="$2">
      {events.map((event) => {
        const selected = event.id === selectedEventId;
        const date = toDate(event.EventDate);
        return (
          <XStack
            key={event.id}
            items="center"
            gap="$3"
            p="$3"
            bg={selected ? '$color3' : '$color2'}
            borderWidth={selected ? 2 : 1}
            borderColor={selected ? '$color9' : '$color6'}
            style={{ borderRadius: 10 }}
            pressStyle={{ opacity: 0.8 }}
            onPress={() => onSelect(event)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
          >
            <Ionicons
              name={selected ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color={(selected ? theme.color9?.val : theme.color10?.val) as string}
            />
            <YStack flex={1}>
              <Text color="$color" fontWeight="600" numberOfLines={1}>{event.Title}</Text>
              <Text color="$color10" fontSize="$3" numberOfLines={1}>
                {date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                {event.Location ? ` · ${event.Location}` : ''}
              </Text>
            </YStack>
          </XStack>
        );
      })}
    </YStack>
  );
}
