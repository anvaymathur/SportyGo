import React, { useEffect, useState } from "react";
import { View, Text, Button, XStack, YStack, Card, H4, Paragraph, Separator, Spinner, Avatar } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { deleteMatchHistory, getMatchHistoryById, getUserProfile } from "../../firebase/services_firestore2";
import type { newMatchHistory } from "@/firebase/types_index";

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ViewIndividualScore() {
  const router = useRouter();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState<newMatchHistory | undefined>(undefined);
  const [team1Names, setTeam1Names] = useState<string>("");
  const [team2Names, setTeam2Names] = useState<string>("");

  useEffect(() => {
    const fetchMatch = async () => {
      if (!matchId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const data = await getMatchHistoryById(matchId);
      setMatch(data);

      // Fetch display names for players using profiles
      if (data) {
        const p11 = await getUserProfile(data.team1[0]);
        const p12 = data.team1[1] ? await getUserProfile(data.team1[1]) : undefined;
        const p21 = await getUserProfile(data.team2[0]);
        const p22 = data.team2[1] ? await getUserProfile(data.team2[1]) : undefined;
        setTeam1Names(`${p11?.Name ?? data.team1[0]}${p12 ? ` & ${p12?.Name ?? data.team1[1]}` : ""}`);
        setTeam2Names(`${p21?.Name ?? data.team2[0]}${p22 ? ` & ${p22?.Name ?? data.team2[1]}` : ""}`);
      }
      setLoading(false);
    };

    fetchMatch();
  }, [matchId]);

  const formatDate = (date: Date | string | any) => {
    let dateObj: Date;
    if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === "string") {
      dateObj = new Date(date);
    } else if (date && date.toDate) {
      dateObj = date.toDate();
    } else {
      dateObj = new Date(date);
    }
    if (isNaN(dateObj.getTime())) return "Invalid Date";
    const hasTime = dateObj.getHours() !== 0 || dateObj.getMinutes() !== 0;
    return hasTime
      ? dateObj.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
      : dateObj.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  if (loading) {
    return (
      <YStack flex={1} bg="$background" justify="center" verticalAlign="center" space="$4">
        <Spinner size="large" color="$color9" />
        <Text color="$color10">Loading match...</Text>
      </YStack>
    );
  }

  if (!match) {
    return (
      <YStack flex={1} bg="$background" justify="center" verticalAlign="center" space="$4" p="$4">
        <H4 color="$color">Match not found</H4>
        <Paragraph color="$color10">We couldn't load this match. Try again from your history.</Paragraph>
        <Button variant="outlined" onPress={() => router.back()} mt="$2" icon={<Ionicons name="arrow-back" size={18} />}>Go Back</Button>
      </YStack>
    );
  }

  const isTeam1Winner = match.team1[2] > match.team2[2];
  const isTie = match.team1[2] === match.team2[2];
  const resultBg = "$color2" as any;
  const resultText = (isTie ? "$color" : "$color") as any;
  const isDoubles = Boolean((match.team1[1] && match.team1[1].trim()) || (match.team2[1] && match.team2[1].trim()));
  const scoreDiff = Math.abs(match.team1[2] - match.team2[2]);

  const [t1p1Name, t1p2Name] = team1Names.split(" & ");
  const [t2p1Name, t2p2Name] = team2Names.split(" & ");

  return (
    <View flex={1} bg="$background">
      {/* Header */}
      <XStack
        pr="$4"
        pl="$4"
        pt="$3"
        pb="$3"
        bg="$color2"
        borderBottomWidth={1}
        borderBottomColor="$borderColor"
        verticalAlign="center"
      >
        <Button
          variant="outlined"
          size="$3"
          onPress={() => router.back()}
          mr="$3"
          icon={<Ionicons name="arrow-back" size={20} />}
        />
        <H4 flex={1}>Match Details</H4>
        <Button
          variant="outlined"
          size="$3"
          onPress={() => { /* placeholder for edit functionality */ }}
          icon={<Ionicons name="create-outline" size={20} />}
        >
          Edit
        </Button>
      </XStack>

      {/* Content */}
      <YStack p="$4" space="$5">
        {/* Meta row: date + match type */}
        <XStack verticalAlign="center" space="$2" >
          <Card padding="$2" bg="$color2" borderWidth={1} borderColor="$borderColor" borderRadius="$2">
            <Text color="$color10" fontSize="$2">{formatDate(match.date)}</Text>
          </Card>
          <Card padding="$2" bg="$color9" borderRadius="$2">
            <Text color="$color1" fontSize="$2">{isDoubles ? "Doubles" : "Singles"}</Text>
          </Card>
        </XStack>

        {/* Winner banner: full width */}
        <Card padding="$4" bg={resultBg} borderWidth={1} borderColor="$borderColor" borderRadius="$4">
          <XStack verticalAlign="center" justify="center" space="$2">
            {!isTie && <Ionicons name="trophy" size={22} color="#FFD700" />}
            <Text color={resultText} fontWeight="$7" fontSize="$5" numberOfLines={2} style={{ textAlign: 'center' }}>
              {isTie ? "Tie" : `${isTeam1Winner ? team1Names : team2Names} Won`}
            </Text>
          </XStack>
        </Card>

        {/* Headline matchup */}
        {isDoubles ? (
          <YStack space="$2" verticalAlign="center">
            <XStack justify="center"><Text fontSize="$6" fontWeight="700" color="$color" numberOfLines={2} style={{ textAlign: 'center' }}>{team1Names}</Text></XStack>
            <XStack justify="center"><Text fontSize="$6" fontWeight="700" color="$color" style={{ textAlign: 'center' }}>VS</Text></XStack>
            <XStack justify="center"><Text fontSize="$6" fontWeight="700" color="$color" numberOfLines={2} style={{ textAlign: 'center' }}>{team2Names}</Text></XStack>
          </YStack>
        ) : (
          <XStack justify="center" verticalAlign="center">
            <Text fontSize="$6" fontWeight="700" color="$color" numberOfLines={2} style={{ textAlign: 'center' }}>
              {team1Names}  vs  {team2Names}
            </Text>
          </XStack>
        )}

        {/* Scoreboard */}
        <Card p="$5" bg="$color2" borderWidth={1} borderColor="$borderColor" borderRadius="$4">
          <YStack space="$4">
            <XStack justify="space-between" verticalAlign="center">
              <YStack flex={1} pr="$2">
                <Text fontSize="$4" fontWeight="700" color="$color">{team1Names}</Text>
                <XStack space="$2" verticalAlign="center">
                  <Avatar size="$4" circular>
                    <Avatar.Image accessibilityLabel={t1p1Name || "Player"} src={undefined as any} />
                    <Avatar.Fallback backgroundColor="$color9">
                      <Text color="$color1" fontSize={14}>{getInitials(t1p1Name || "?")}</Text>
                    </Avatar.Fallback>
                  </Avatar>
                  {isDoubles && (
                    <Avatar size="$4" circular>
                      <Avatar.Image accessibilityLabel={t1p2Name || "Player"} src={undefined as any} />
                      <Avatar.Fallback backgroundColor="$color9">
                        <Text color="$color1" fontSize={14}>{getInitials(t1p2Name || "?")}</Text>
                      </Avatar.Fallback>
                    </Avatar>
                  )}
                </XStack>
              </YStack>
              <XStack space="$2" verticalAlign="center">
                <Text fontSize="$8" fontWeight="900" color="$color">{match.team1[2]}</Text>
              </XStack>
            </XStack>

            <XStack justify="center" verticalAlign="center">
              <Card padding="$3" bg="$color9" borderRadius="$3" minWidth={64} alignItems="center">
                <Text fontWeight="bold" color="$color1" fontSize="$3">VS</Text>
              </Card>
            </XStack>

            <XStack justify="space-between" verticalAlign="center">
              <YStack flex={1} pr="$2">
                <Text fontSize="$4" fontWeight="700" color="$color">{team2Names}</Text>
                <XStack space="$2" verticalAlign="center">
                  <Avatar size="$4" circular>
                    <Avatar.Image accessibilityLabel={t2p1Name || "Player"} src={undefined as any} />
                    <Avatar.Fallback backgroundColor="$color9">
                      <Text color="$color1" fontSize={14}>{getInitials(t2p1Name || "?")}</Text>
                    </Avatar.Fallback>
                  </Avatar>
                  {isDoubles && (
                    <Avatar size="$4" circular>
                      <Avatar.Image accessibilityLabel={t2p2Name || "Player"} src={undefined as any} />
                      <Avatar.Fallback backgroundColor="$color9">
                        <Text color="$color1" fontSize={14}>{getInitials(t2p2Name || "?")}</Text>
                      </Avatar.Fallback>
                    </Avatar>
                  )}
                </XStack>
              </YStack>
              <XStack space="$2" verticalAlign="center">
                <Text fontSize="$8" fontWeight="900" color="$color">{match.team2[2]}</Text>
              </XStack>
            </XStack>

            <Separator />

            {/* Big Score difference banner */}
            <XStack justify="center" verticalAlign="center">
              <Card padding="$3" bg="$color9" borderRadius="$3">
                <XStack verticalAlign="center" space="$2">
                  <Ionicons name={isTie ? "remove" : isTeam1Winner ? "arrow-up" : "arrow-down"} size={20} color="#FFFFFF" />
                  <Text color="$color1" fontSize="$6" fontWeight="800">
                    {isTie ? "No difference" : `+${scoreDiff}`}
                  </Text>
                </XStack>
              </Card>
            </XStack>
          </YStack>
        </Card>

        {/* Actions */}
        <XStack space="$3">
          <Button flex={1} bg="$color9" color="$color1" onPress={() => router.back()} icon={<Ionicons name="arrow-back" size={18} />}>Back to History</Button>
          <Button flex={1} bg="#ed5e68"variant="outlined" onPress={() => {deleteMatchHistory(matchId); router.replace('/matchHistory/viewScore')}} icon={<Ionicons name="trash-outline" size={18} />}>Delete Match</Button>
        </XStack>
      </YStack>
    </View>
  );
}
