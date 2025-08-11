import React, { useState, useEffect, useContext } from "react";
import {
  ScrollView,
  View,
  Text,
  Button,
  XStack,
  YStack,
  Card,
  H4,
  H5,
  Paragraph,
  Avatar,
  
  Separator,
  Spinner
} from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth0 } from "react-native-auth0";
import { getUserProfile, getUserMatchHistory } from '../../firebase/services_firestore2';
import { newMatchHistory } from "@/firebase/types_index";
import { UserContext } from "../components/userContext";

// Light status colors for win/tie/lose
const STATUS_COLORS = {
  winBg: '#D1FAE5',   // light green
  tieBg: '#FEF9C3',   // light yellow
  loseBg: '#FEE2E2',  // light red
} as const;

// Mock data structure for match history

export default function ViewScore() {
  const router = useRouter();
  const { user } = useAuth0();
  const {globalUser} = useContext(UserContext)
  const [matchHistory, setMatchHistory] = useState<newMatchHistory[]>([]);
  const [loading, setLoading] = useState(true);

  let userName: string = ""
  let userID: string = ""

  if (globalUser && user && globalUser.name && user.sub){
    userName = globalUser.name
    userID = user.sub
  }



  useEffect(() => {
    // const fetchPlayers = async () => {
    //   try {
    //     const fetchedPlayers = await getAllUserProfiles();
    //     if (fetchedPlayers && Array.isArray(fetchedPlayers)) {
    //       const uniqueNames = [...new Set(fetchedPlayers.map(player => player.Name).filter(name => name !== ""))];
    //       setPlayers(uniqueNames);
    //     } else {
    //       setPlayers([]);
    //     }
    //   } catch (error) {
    //     setPlayers([]);
    //   }
    // };



    const fetchMatchHistory = async () => {
      setLoading(true);
      const userMatchHistory = await getUserMatchHistory(userID);
      setMatchHistory(userMatchHistory); 
      setLoading(false);
    };

    fetchMatchHistory();
  }, []);

  const getCurrentUserTeam = (match: newMatchHistory) => {
    
    if (match.team1[0] === userID || match.team1[1] === userID) {
      return "team1";
    } else if (match.team2[0] === userID || match.team2[1] === userID) {
      return "team2";
    }
    return null;
  };

  const getTeamResult = (match: newMatchHistory) => {
    if (!match?.team1 || !match?.team2) return "tie";
    if (typeof match.team1[2] !== "number" || typeof match.team2[2] !== "number") return "tie";
  
    if (match.team1[2] > match.team2[2]) {
      return "team1";
    } else if (match.team2[2] > match.team1[2]) {
      return "team2";
    }
    return "tie";
  };

  const getCardBackgroundColor = (match: newMatchHistory) => {
    const userTeam = getCurrentUserTeam(match);
    const winningTeam = getTeamResult(match);
    if (!userTeam) return STATUS_COLORS.winBg;
    
    if (userTeam === winningTeam) {
      return STATUS_COLORS.winBg;
    } else if (winningTeam === "tie") {
      return STATUS_COLORS.tieBg;
    } else {
      return STATUS_COLORS.loseBg;
    }
  };

  const formatDate = (date: Date | string | any) => {
    // Convert to Date object if it's not already
    let dateObj: Date;
    
    if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === 'string') {
      dateObj = new Date(date);
    } else if (date && date.toDate) {
      // Handle Firestore Timestamp
      dateObj = date.toDate();
    } else {
      // Fallback for any other format
      dateObj = new Date(date);
    }
    
    // Check if the date is valid
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }
    
    // Check if the date has time information (not just midnight)
    const hasTime = dateObj.getHours() !== 0 || dateObj.getMinutes() !== 0;
    
    if (hasTime) {
      // Show both date and time
      return dateObj.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } else {
      // Show only date
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
  };

  const getPlayerDisplay = async (player1: string, player2?: string) => {
    const player1Profile = await getUserProfile(player1);
    if (player2) {
      const player2Profile = await getUserProfile(player2);
      // Safely handle possibly undefined profiles
      return `${player1Profile?.Name ?? player1} & ${player2Profile?.Name ?? player2}`;
    }
    return player1Profile?.Name ?? player1;
  };

    if (loading) {
        return (
        <YStack flex={1} bg="$background" justify="center" verticalAlign="center" space="$4">
            <Spinner size="large" color="$color9" />
            <Text color="gray">Loading match history...</Text>
      </YStack>
    );
  }

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
        <H4 flex={1}>Match History</H4>
        <Button
          variant="outlined"
          size="$3"
          onPress={() => router.push('/matchHistory/addScore')}
          icon={<Ionicons name="add" size={20} />}
        />
      </XStack>

      <ScrollView flex={1} p="$4" showsVerticalScrollIndicator={false}>
        <YStack space="$4" pb="$8">
          {(() => {
            if (matchHistory.length === 0) {
              return (
                <Card padding="$6" backgroundColor="$color2" borderWidth={1} borderColor="$borderColor">
                  <YStack space="$3" verticalAlign="center">
                    <Ionicons name="trophy-outline" size={48} color="#666" />
                    <H5 color="$color">No matches yet</H5>
                    <Paragraph color="$color10" style={{textAlign: "center"}}>
                      Start playing matches to see your history here
                    </Paragraph>
                    <Button
                      bg="$color9"
                      color="$color1"
                      onPress={() => router.push('/matchHistory/addScore')}
                      mt="$2"
                    >
                      Add First Match
                    </Button>
                  </YStack>
                </Card>
              );
            } else {
              return matchHistory.map((match) => {
                const userTeam = getCurrentUserTeam(match);
                const winningTeam = getTeamResult(match);
                const isUserWinner = userTeam === winningTeam;
                const isTie = winningTeam === "tie";

                return (
                  <Card
                    key={`${match.team1[0]}-${match.team2[0]}-${match.date.toString()}`}
                    padding="$4"
                    backgroundColor={getCardBackgroundColor(match)}
                    borderWidth={1}
                    borderColor="$borderColor"
                    elevation={2}
                  >
                    <YStack space="$3">
                      {/* Header with date and tournament */}
                      <XStack justify="space-between" verticalAlign="center">
                        <YStack>
                          <Text fontSize="$2" color="$color">
                            {formatDate(match.date)}
                          </Text>
                          {/* {match.tournament && (
                            <Badge size="$2" backgroundColor="$blue8" color="white">
                              {match.tournament}
                            </Badge>
                          )}*/}
                        </YStack> 
                        {/* <Badge
                          size="$2"
                          backgroundColor={match.matchType === "doubles" ? "$purple8" : "$orange8"}
                          color="white"
                        >
                          {match.matchType === "doubles" ? "Doubles" : "Singles"}
                        </Badge> */}
                      </XStack>

                      <Separator />

                      {/* Match Details */}
                      <YStack space="$3">
                        {/* Team 1 */}
                        <XStack justify="space-between" verticalAlign="center">
                          <YStack flex={1}>
                            <Text fontSize="$3" fontWeight="600" color="$color">
                              {getPlayerDisplay(match.team1[0], match.team1[1])}
                            </Text>
                            <Text fontSize="$2" color="$color10">
                              Team 1
                            </Text>
                          </YStack>
                          <XStack space="$2" verticalAlign="center">
                            <Text fontSize="$6" fontWeight="bold" color="$color">
                              {match.team1[2]}
                            </Text>
                            {winningTeam === "team1" && (
                              <Ionicons name="trophy" size={20} color="#FFD700" />
                            )}
                          </XStack>
                        </XStack>

                        {/* VS */}
                        <XStack justify="center" verticalAlign="center">
                          <Card
                            padding="$2"
                            bg="$color9"
                            borderRadius="$2"
                            minWidth={40}
                            alignItems="center"
                          >
                            <Text fontWeight="bold" color="$color1" fontSize="$2">
                              VS
                            </Text>
                          </Card>
                        </XStack>

                        {/* Team 2 */}
                        <XStack justify="space-between" verticalAlign="center">
                          <YStack flex={1}>
                            <Text fontSize="$3" fontWeight="600" color="$color">
                              {getPlayerDisplay(match.team2[0], match.team2[1])}
                            </Text>
                            <Text fontSize="$2" color="$color10">
                              Team 2
                            </Text>
                          </YStack>
                          <XStack space="$2" verticalAlign="center">
                            <Text fontSize="$6" fontWeight="bold" color="$color">
                              {match.team2[2]}
                            </Text>
                            {winningTeam === "team2" && (
                              <Ionicons name="trophy" size={20} color="#FFD700" />
                            )}
                          </XStack>
                        </XStack>
                      </YStack>

                      {/* Result indicator */}
                      {userTeam && (
                        <Card
                          padding="$2"
                          backgroundColor={isUserWinner ? STATUS_COLORS.winBg : isTie ? STATUS_COLORS.tieBg : STATUS_COLORS.loseBg}
                          borderRadius="$2"
                          alignItems="center"
                        >
                          <Text
                            fontSize="$2"
                            fontWeight="600"
                            color="$color"
                          >
                            {isUserWinner ? "🏆 You Won!" : isTie ? "🤝 It's a Tie!" : "😔 You Lost"}
                          </Text>
                        </Card>
                      )}
                    </YStack>
                  </Card>
                );
              });
            }
          })()}
        </YStack>
      </ScrollView>
    </View>
  );
}