/**
 * @fileoverview Home screen: the landing page for signed-in users.
 *
 *   1. Record       : win rate with wins / losses / draws
 *   2. Next up      : the next 2 events the user RSVP'd "going" to
 *   3. Recent matches: the 5 most recent results
 *
 * Match history is re-read every time the tab gains focus; upcoming events come from a realtime
 * listener. Signing out lives on the Profile tab.
 *
 * @route /(tabs)/dashboard
 */

import React, { useContext, useEffect, useMemo, useState } from "react";
import { ScrollView, YStack, XStack, Text, Card, H2, H4, Paragraph, Separator, Spinner, Button, useTheme } from "tamagui";
import { useAuth0 } from "react-native-auth0";
import { getUserMatchHistory, getUserVote, getUserGroups, listenUserEvents, toDate } from "@/firebase/services_firestore2";
import { newMatchHistory, EventDoc } from "@/firebase/types_index";

import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { UserContext } from "@/components/userContext";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaWrapper } from "@/components/SafeAreaWrapper";
import { matchOutcomeFor, summarizeMatches } from "@/utils/matchStats";

const RESULT_COLORS = { W: "$success", L: "$danger", D: "$color10" } as const;

export default function Dashboard() {
  const theme = useTheme();
  const { user } = useAuth0();
  const { globalUser } = useContext(UserContext);
  const userId = user?.sub ?? "";
  const firstName = (globalUser?.name ?? "").trim().split(/\s+/)[0];

  const [matchHistory, setMatchHistory] = useState<newMatchHistory[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState<boolean>(true);
  const [matchesFailed, setMatchesFailed] = useState(false);

  const [myUpcomingEvents, setMyUpcomingEvents] = useState<EventDoc[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(true);

  // Re-read match history whenever the tab gains focus (this also covers the first load)
  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;
      const fetchMatches = async () => {
        if (!userId) {
          setMatchHistory([]);
          setIsLoadingMatches(false);
          return;
        }
        try {
          const data = await getUserMatchHistory(userId);
          if (isActive) {
            setMatchHistory(data);
            setMatchesFailed(false);
          }
        } catch (error) {
          console.error("Error loading match history:", error);
          if (isActive) setMatchesFailed(true);
        } finally {
          if (isActive) setIsLoadingMatches(false);
        }
      };
      fetchMatches();
      return () => {
        isActive = false;
      };
    }, [userId])
  );

  /**
   * Realtime listener for upcoming events the user is going to: their groups' events plus ones
   * they were invited to individually or created, filtered to future events voted "going".
   */
  useEffect(() => {
    let cancelled = false as boolean;
    let unsubscribe: undefined | (() => void);

    const setup = async () => {
      if (!userId) {
        setMyUpcomingEvents([]);
        setIsLoadingEvents(false);
        return;
      }

      setIsLoadingEvents(true);

      const handleEvents = async (events: EventDoc[]) => {
        try {
          const now = Date.now();
          // Only future events can be "upcoming", so skip RSVP lookups for past ones
          const futureEvents = events
            .map((evt) => ({ evt, date: toDate(evt.EventDate) }))
            .filter(({ date }) => date.getTime() > now);

          const results = await Promise.all(
            futureEvents.map(async ({ evt, date }) => ({ evt, date, vote: await getUserVote(evt.id, userId) }))
          );

          const goingUpcoming = results
            .filter(({ vote }) => vote === "going")
            .sort((a, b) => a.date.getTime() - b.date.getTime())
            .map(({ evt }) => evt)
            .slice(0, 2);

          if (!cancelled) setMyUpcomingEvents(goingUpcoming);
        } catch (error) {
          console.error("Error loading upcoming events:", error);
        } finally {
          if (!cancelled) setIsLoadingEvents(false);
        }
      };

      const groups = await getUserGroups(userId).catch(() => []);
      // The screen may have unmounted while groups loaded; don't attach a listener nobody cleans up
      if (cancelled) return;
      unsubscribe = listenUserEvents(groups.map((g) => g.id), userId, handleEvents);
    };

    setup();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [userId]);

  const summary = useMemo(() => summarizeMatches(matchHistory, userId), [matchHistory, userId]);

  /** The 5 most recent matches the user played in, with the user's own score first. */
  const recentMatches = useMemo(
    () =>
      (matchHistory ?? [])
        .map((match) => ({ match, outcome: matchOutcomeFor(match, userId) }))
        .filter(({ outcome }) => outcome !== null)
        .slice(0, 5)
        .map(({ match, outcome }) => ({
          id: match.id,
          outcome: outcome!,
          dateStr: toDate(match.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        })),
    [matchHistory, userId]
  );

  const formatEventDate = (d: unknown) => {
    const date = toDate(d);
    return `${date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  };

  const loadingRow = (
    <XStack items="center" gap="$2" py="$2">
      <Spinner size="small" color="$color9" />
      <Text color="$color10">Loading…</Text>
    </XStack>
  );

  /** Card title with a "see all" style link on the right. */
  const cardHeader = (title: string, linkLabel: string, onPress: () => void) => (
    <XStack justify="space-between" items="center">
      <H4 color="$color">{title}</H4>
      <XStack items="center" gap="$1" onPress={onPress} hitSlop={12} accessibilityRole="link">
        <Text color="$color9" fontWeight="600">{linkLabel}</Text>
        <Ionicons name="chevron-forward" size={16} color={theme.color9?.val as string} />
      </XStack>
    </XStack>
  );

  return (
    <SafeAreaWrapper>
      <ScrollView flex={1} bg="$background" showsVerticalScrollIndicator={false}>
        <YStack p="$4" gap="$4">
          <YStack>
            <Paragraph color="$color10">Welcome back</Paragraph>
            <H2 color="$color" fontWeight="800" numberOfLines={1}>{firstName || "Player"}</H2>
          </YStack>

          {/* Record */}
          <Card p="$4" borderRadius="$4" bg="$color9">
            {isLoadingMatches ? (
              <XStack items="center" gap="$2" py="$2">
                <Spinner size="small" color="$color1" />
                <Text color="$color1">Loading…</Text>
              </XStack>
            ) : matchesFailed ? (
              <Text color="$color1">Couldn&apos;t load your matches. Pull up this tab again to retry.</Text>
            ) : summary.played === 0 ? (
              <YStack gap="$3">
                <Text color="$color1" fontSize="$6" fontWeight="700">No matches yet</Text>
                <Text color="$color1" opacity={0.85}>Record your first match to start tracking your win rate.</Text>
                <Button self="flex-start" bg="$color1" color="$color9" onPress={() => router.push("/matches/addScore")}>
                  Record a match
                </Button>
              </YStack>
            ) : (
              <XStack justify="space-between" items="flex-end">
                <YStack>
                  <Text color="$color1" opacity={0.85}>Win rate</Text>
                  <Text color="$color1" fontSize={44} fontWeight="900">{summary.winRate}%</Text>
                </YStack>
                <YStack items="flex-end" gap="$1">
                  <Text color="$color1" fontWeight="700">
                    {summary.wins}W · {summary.losses}L{summary.draws > 0 ? ` · ${summary.draws}D` : ""}
                  </Text>
                  <Text color="$color1" opacity={0.85}>
                    {summary.played} {summary.played === 1 ? "match" : "matches"}
                  </Text>
                </YStack>
              </XStack>
            )}
          </Card>

          {/* Next up */}
          <Card p="$4" borderRadius="$4" bg="$color2" borderWidth={1} borderColor="$borderColor">
            <YStack gap="$2">
              {cardHeader("Next up", "All events", () => router.push("/events/EventsList"))}
              <Separator />
              {isLoadingEvents ? loadingRow : null}
              {!isLoadingEvents && myUpcomingEvents.length === 0 ? (
                <Paragraph py="$2" color="$color10">
                  Nothing coming up that you&apos;re going to. RSVP to an event and it will show here.
                </Paragraph>
              ) : null}
              {!isLoadingEvents && myUpcomingEvents.map((evt) => (
                <YStack
                  key={evt.id}
                  py="$2"
                  pressStyle={{ opacity: 0.7 }}
                  onPress={() => router.push({ pathname: "/events/EventView", params: { eventId: evt.id } })}
                >
                  <Text fontWeight="700" color="$color" numberOfLines={1}>{evt.Title}</Text>
                  <Text color="$color9" fontWeight="600" fontSize="$3">{formatEventDate(evt.EventDate)}</Text>
                  {evt.Location ? <Text color="$color10" fontSize="$3" numberOfLines={1}>{evt.Location}</Text> : null}
                </YStack>
              ))}
            </YStack>
          </Card>

          {/* Recent matches */}
          <Card p="$4" borderRadius="$4" bg="$color2" borderWidth={1} borderColor="$borderColor">
            <YStack gap="$2">
              {cardHeader("Recent matches", "All matches", () => router.push("/matches/viewScore"))}
              <Separator />
              {isLoadingMatches ? loadingRow : null}
              {!isLoadingMatches && recentMatches.length === 0 ? (
                <Paragraph py="$2" color="$color10">No matches yet.</Paragraph>
              ) : null}
              {!isLoadingMatches && recentMatches.map((row, idx) => (
                <XStack key={row.id || idx} justify="space-between" items="center" py="$2">
                  <XStack items="center" gap="$3">
                    <Text width={20} fontWeight="800" color={RESULT_COLORS[row.outcome.result]}>{row.outcome.result}</Text>
                    <Text color="$color" fontWeight="600">{row.outcome.myScore} – {row.outcome.theirScore}</Text>
                  </XStack>
                  <Text color="$color10" fontSize="$3">{row.dateStr}</Text>
                </XStack>
              ))}
            </YStack>
          </Card>
        </YStack>
      </ScrollView>
    </SafeAreaWrapper>
  );
}
