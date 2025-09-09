import React, { useContext, useEffect, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  Button,
  XStack,
  YStack,
  Card,
  Input,
  Select,
  Sheet,
  H4,
  H5,
  Paragraph,
  Circle,
  Separator
} from "tamagui";
import { Adapt } from '@tamagui/adapt'
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth0 } from "react-native-auth0";
import { getAllUserProfiles, createMatchHistory} from '../../firebase/services_firestore2';
import { newMatchHistory } from "@/firebase/types_index";
import { Alert } from "react-native";
import DateTimePicker from '@react-native-community/datetimepicker';
import { UserContext } from "../components/userContext";
import { SafeAreaWrapper } from "../components/SafeAreaWrapper";


export default function AddScore() {
  const router = useRouter();
  const [yourScore, setYourScore] = useState("0");
  const [opponentScore, setOpponentScore] = useState("0");
  const [matchType, setMatchType] = useState("singles");
  const [date, setDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tournament, setTournament] = useState("");
  const [yourPlayer1, setYourPlayer1] = useState("");
  const [yourPlayer2, setYourPlayer2] = useState("");
  const [opponentPlayer1, setOpponentPlayer1] = useState("");
  const [opponentPlayer2, setOpponentPlayer2] = useState("");


  const {user} = useAuth0()
  const {globalUser} = useContext(UserContext)

  let userName: string = ""
  let userID: string = ""
  if (globalUser && user && globalUser.name && user.sub){
    userName = globalUser.name
    userID = user.sub
  }
  const [players, setPlayers] = useState<string[]>([]);
  const [playerNameToId, setPlayerNameToId] = useState<{ [name: string]: string }>({});

  // Filter option lists so a chosen player cannot be selected again elsewhere
  const availableYourPlayer2 = players.filter((name) => name !== userName && name !== opponentPlayer1 && name !== opponentPlayer2);
  const availableOpponentPlayer1 = players.filter((name) => name !== userName && name !== yourPlayer2 && name !== opponentPlayer2);
  const availableOpponentPlayer2 = players.filter((name) => name !== userName && name !== yourPlayer2 && name !== opponentPlayer1);

  // Track focus to allow empty string while editing
  const [isYourScoreFocused, setIsYourScoreFocused] = useState(false);
  const [isOpponentScoreFocused, setIsOpponentScoreFocused] = useState(false);

  useEffect(() => {
    const fetchPlayers = async () => {
      const fetchedPlayers = await getAllUserProfiles();
      const uniqueNames = [...new Set(fetchedPlayers.map(player => player.Name).filter(name => name !== ""))];
      
      // Create name-to-id mapping
      const nameToIdMap: { [name: string]: string } = {};
      fetchedPlayers.forEach(player => {
        if (player.Name && player.Name !== "") {
          nameToIdMap[player.Name] = player.id;
        }
      });
      
      setPlayers(uniqueNames);
      setPlayerNameToId(nameToIdMap);
    };
    fetchPlayers();
  }, []);

  const resetGame = () => {
    setYourScore("0");
    setOpponentScore("0");
  };

  const incrementScore = (team: "your" | "opponent") => {

      if (team === "your") {
        if (parseInt(yourScore) < 99) {
          setYourScore(prev => ((isNaN(parseInt(prev)) ? 0 : parseInt(prev)) + 1).toString());
        }
      } else {
        if (parseInt(opponentScore) < 99) {
          setOpponentScore(prev => ((isNaN(parseInt(prev)) ? 0 : parseInt(prev)) + 1).toString());
        }
      }
    
  };

  const decrementScore = (team: "your" | "opponent") => {
    if (team === "your") {
      setYourScore(prev => Math.max(0, (isNaN(parseInt(prev)) ? 0 : parseInt(prev)) - 1).toString());
    } else {
      setOpponentScore(prev => Math.max(0, (isNaN(parseInt(prev)) ? 0 : parseInt(prev)) - 1).toString());
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const onTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const newDate = new Date(date);
      newDate.setHours(selectedTime.getHours(), selectedTime.getMinutes());
      setDate(newDate);
    }
  };

  const handleSaveMatch = async () => {

    // Prevent saving with duplicate player selections
    const selectedPlayers = [userName, yourPlayer2, opponentPlayer1, opponentPlayer2].filter((p) => p && p !== "");
    const hasDuplicatePlayers = new Set(selectedPlayers).size !== selectedPlayers.length;
    if (hasDuplicatePlayers) {
      Alert.alert(
        "Duplicate selection",
        "A player cannot be selected more than once.",
        [{ text: "OK" }]
      );
      return;
    }

    if (opponentPlayer1 !== "" && date !== null && yourScore !== "0"  && opponentScore !== "0" &&  ((matchType === 'doubles' && opponentPlayer2 !== '' && yourPlayer2 !== '') || matchType === 'singles')){
      
        // Get player IDs, fallback to names if ID not found
        const team1Player1Id = playerNameToId[userName] || userID;
        const team1Player2Id = matchType === 'doubles' ? (playerNameToId[yourPlayer2]) : '';
        const team2Player1Id = playerNameToId[opponentPlayer1];
        const team2Player2Id = matchType === 'doubles' ? (playerNameToId[opponentPlayer2]) : '';
        
        const matchData: newMatchHistory = {
          team1: [team1Player1Id, team1Player2Id, parseInt(yourScore)],
          team2: [team2Player1Id, team2Player2Id, parseInt(opponentScore)],
          date: date,
          id: ""
        };
        await createMatchHistory(matchData);
        router.replace('/matchHistory/viewScore')
    } else {
      Alert.alert(
        "Missing Information",
        "Please fill all the required information.",
        [{ text: "OK" }]
      )
    }
  };

  return (
    <SafeAreaWrapper>
      <View flex={1} bg="$background">
        {/* Header */}
        <XStack
          pr="$4"
          pl="$4"
          pt="$3"
          pb="$3"
          bg="$background"
          borderBottomWidth={1}
          borderBottomColor="$borderColor"
        >
          <Button
            variant="outlined"
            size="$3"
            onPress={() => router.back()}
            mr="$3"
          >
            <Ionicons name="arrow-back" size={24} color="$color1" />
          </Button>
          <H4 flex={1} verticalAlign="center">Add Match Scores</H4>
        </XStack>

        <ScrollView flex={1} p="$4" showsVerticalScrollIndicator={false}>
          <YStack pb="$8" space="$4">
            {/* Game Score Section */}
            <Card padding="$4" backgroundColor="$background" borderWidth={1} borderColor="$borderColor">
              <YStack space="$3">
                <H5 color="$color9" ml="$11" >Game Score</H5>
                
                <YStack space="$2">
                  {/* Your Team Row */}
                  <XStack verticalAlign="center" justify="center" space="$2">
                    <Circle
                      size="$3"
                      bg="$color9"
                      onPress={() => decrementScore("your")}
                    >
                      <Ionicons name="remove" size={16} color="white" />
                    </Circle>
                    <Card
                      padding="$1"
                      backgroundColor="$color4"
                      borderRadius="$2"
                      minWidth={48}
                      alignItems="center"
                    >
                      <Input
                        p="$1"
                        bg="$color4"
                        borderColor="transparent"
                        inputMode="numeric"
                        keyboardType="numeric"
                        maxLength={2}
                        fontSize='$5'
                        value={yourScore.toString()}
                        onFocus={() => {
                          setIsYourScoreFocused(true);
                          if (yourScore === "0") setYourScore("");
                        }}
                        onBlur={() => {
                          setIsYourScoreFocused(false);
                          if (yourScore === "") setYourScore("0");
                        }}
                        onChangeText={(text) => {
                          const onlyDigits = text.replace(/[^0-9]/g, '');
                          if (onlyDigits === '') {
                            if (isYourScoreFocused) {
                              setYourScore('');
                            } else {
                              setYourScore('0');
                            }
                            return;
                          }
                          const parsed = parseInt(onlyDigits, 10)
                          setYourScore(isNaN(parsed) ? "0" : parsed.toString())
                        }}
                      />
                    </Card>
                    <Circle
                      size="$3"
                      bg="$color9"
                      onPress={() => incrementScore("your")}
                    >
                      <Ionicons name="add" size={16} color="white" />
                    </Circle>
                  </XStack>
                  <XStack justify="center">
                    <Text fontSize="$2" color="$color" mt="$1">
                      Your Team
                    </Text>
                  </XStack>

                  {/* VS Row */}
                  <XStack justify="center">
                    <Card
                  
                      padding="$1"
                      backgroundColor="$color4"
                      borderRadius="$2"
                      minWidth={32}
                      height={32}
                      alignItems="center"
                      justify="center"
                    >
                      <Text fontWeight="bold" color="$color">VS</Text>
                    </Card>
                  </XStack>

                  {/* Opponent Team Row */}
                  <XStack verticalAlign="center" justify="center" space="$2">
                    <Circle
                      size="$3"
                      bg="$color9"
                      onPress={() => decrementScore("opponent")}
                    >
                      <Ionicons name="remove" size={16} color="white" />
                    </Circle>
                    <Card
                      padding="$1"
                      backgroundColor="$color4"
                      borderRadius="$2"
                      minWidth={48}
                      alignItems="center"
                    >
                      <Input
                        p="$1"
                        bg="$color4"
                        borderColor="transparent"
                        inputMode="numeric"
                        keyboardType="numeric"
                        maxLength={2}
                        fontSize='$5'
                        value={opponentScore.toString()}
                        onFocus={() => {
                          setIsOpponentScoreFocused(true);
                          if (opponentScore === "0") setOpponentScore("");
                        }}
                        onBlur={() => {
                          setIsOpponentScoreFocused(false);
                          if (opponentScore === "") setOpponentScore("0");
                        }}
                        onChangeText={(text) => {
                          const onlyDigits = text.replace(/[^0-9]/g, '');
                          if (onlyDigits === '') {
                            if (isOpponentScoreFocused) {
                              setOpponentScore('');
                            } else {
                              setOpponentScore('0');
                            }
                            return;
                          }
                          const parsed = parseInt(onlyDigits, 10)
                          setOpponentScore(isNaN(parsed) ? "0" : parsed.toString())
                        }}
                      />
                    </Card>
                    <Circle
                      size="$3"
                      bg="$color9"
                      onPress={() => incrementScore("opponent")}
                    >
                      <Ionicons name="add" size={16} color="white" />
                    </Circle>
                  </XStack>
                  <XStack justify="center">
                    <Text fontSize="$2" color="$color" mt="$1">
                      Opponent Team
                    </Text>
                  </XStack>
                </YStack>

                <Button
                  bg="$color9"
                  onPress={resetGame}
                  mt="$2"
                  color="$color1"
                >
                  Reset Game
                </Button>
              </YStack>
            </Card>

            {/* Match Setup Section */}
            <Card padding="$4" backgroundColor="$background" borderWidth={1} borderColor="$borderColor">
              <YStack space="$3">
                <H5 color="$color9">Match Setup</H5>
                
                {/* Match Type */}
                <YStack space="$2">
                  <Text fontSize="$3" fontWeight="500">Match Type</Text>
                  <XStack space="$2">
                    <Button
                      flex={1}
                      bg={matchType === "singles" ? "$color9" : "$color3"}
                      onPress={() => setMatchType("singles")}
                      color={matchType === "singles" ? "$color1" : "$color9"}
                    >
                      Singles
                    </Button>
                    <Button
                      flex={1}
                      bg={matchType === "doubles" ? "$color9" : "$color3"}
                      onPress={() => setMatchType("doubles")}
                      color={matchType === "doubles" ? "$color1" : "$color9"}
                    >
                      Doubles
                    </Button>
                  </XStack>
                </YStack>

                {/* Date */}
                <YStack space="$2">
                  <Text fontSize="$3" fontWeight="500">Date</Text>
                  <Button
                    bg="$color3"
                    borderColor="$borderColor"
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Text>{date.toDateString()}</Text>
                  </Button>
                  {showDatePicker && (
                    <DateTimePicker
                      value={date}
                      mode="date"
                      display="default"
                      onChange={onDateChange}
                    />
                  )}

                  <Text fontSize="$3" fontWeight="500">Time</Text>
                  <Button
                    bg="$color3"
                    borderColor="$borderColor"
                    onPress={() => setShowTimePicker(true)}
                  >
                    <Text>{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                  </Button>
                  {showTimePicker && (
                    <DateTimePicker
                      value={date}
                      mode="time"
                      display="default"
                      onChange={onTimeChange}
                    />
                  )}
                </YStack>

                {/* Tournament/Event */}
                <YStack space="$2">
                  <Text fontSize="$3" fontWeight="500">Tournament/Event (Optional)</Text>
                  <Input
                    value={tournament}
                    onChangeText={setTournament}
                    placeholder="Enter tournament name"
                  />
                </YStack>
              </YStack>
            </Card>

            {/* Select Players Section */}
            <Card padding="$4" backgroundColor="$background" borderWidth={1} borderColor="$borderColor">
              <YStack space="$3">
                <H5 color="$color9">Select Players</H5>
                
                {/* Your Team */}
                <YStack space="$2">
                  <Text fontSize="$3" fontWeight="500">Your Team</Text>
                  <Select
                    value={userName}
                  >
                    <Select.Trigger
                      backgroundColor="$color4"
                      borderColor="$borderColor"
                      width="100%"
                    >
                      <Select.Value>{userName || "Select Player 1"}</Select.Value>
                    </Select.Trigger>
                  </Select>

                  {matchType === "doubles" && (
                    <Select
                      value={yourPlayer2}
                      onValueChange={(value) => {
                        setYourPlayer2(value);
                        if (value === opponentPlayer1) setOpponentPlayer1("");
                        if (value === opponentPlayer2) setOpponentPlayer2("");
                      }}
                    >
                      <Select.Trigger
                        backgroundColor="$color4"
                        borderColor="$borderColor"
                        width="100%"
                      >
                        <Select.Value placeholder="Select Player 2" />
                      </Select.Trigger>

                      {/* Sheet for mobile */}
                      <Adapt when={true} platform="touch">
                        <Sheet
                          modal
                          dismissOnSnapToBottom
                          position={0}
                        >
                          <Sheet.Frame height={400}>
                            <Adapt.Contents />
                          </Sheet.Frame>
                          <Sheet.Overlay />
                        </Sheet>
                      </Adapt>

                      {/* Scrollable Content */}
                      <Select.Content zIndex={200000}>
                        <Select.ScrollUpButton />
                        <Select.Viewport minH={100} maxH={300}>
                          <Select.Group>
                            <Select.Label>Players</Select.Label>
                            {availableYourPlayer2.map((playerName, index) => (
                              <Select.Item key={playerName} value={playerName} index={index}>
                                <Select.ItemText>{playerName}</Select.ItemText>
                              </Select.Item>
                            ))}
                          </Select.Group>
                        </Select.Viewport>
                        <Select.ScrollDownButton />
                      </Select.Content>
                    </Select>
                  )}

                </YStack>

                {/* Opponent Team */}
                <YStack space="$2">
                  <Text fontSize="$3" fontWeight="500">Opponent Team</Text>
                  <Select
                    value={opponentPlayer1}
                    onValueChange={(value) => {
                      setOpponentPlayer1(value);
                      if (value === yourPlayer2) setYourPlayer2("");
                      if (value === opponentPlayer2) setOpponentPlayer2("");
                    }}
                  >
                    <Select.Trigger
                      backgroundColor="$color4"
                      borderColor="$borderColor"
                      width="100%"
                    >
                      <Select.Value placeholder="Select Player 1" />
                    </Select.Trigger>

                    {/* Sheet for mobile */}
                    <Adapt when={true} platform="touch">
                      <Sheet
                        modal
                        dismissOnSnapToBottom
                        position={0}
                      >
                        <Sheet.Frame height={400}>
                          <Adapt.Contents />
                        </Sheet.Frame>
                        <Sheet.Overlay />
                      </Sheet>
                    </Adapt>

                    {/* Scrollable Content */}
                    <Select.Content zIndex={200000}>
                      <Select.ScrollUpButton />
                      <Select.Viewport minH={100} maxH={300}>
                        <Select.Group>
                          <Select.Label>Players</Select.Label>
                          {availableOpponentPlayer1.map((playerName, index) => (
                            <Select.Item key={playerName} value={playerName} index={index}>
                              <Select.ItemText>{playerName}</Select.ItemText>
                            </Select.Item>
                          ))}
                        </Select.Group>
                      </Select.Viewport>
                      <Select.ScrollDownButton />
                    </Select.Content>
                  </Select>

                  {matchType === "doubles" && (
                    <Select
                      value={opponentPlayer2}
                      onValueChange={(value) => {
                        setOpponentPlayer2(value);
                        if (value === yourPlayer2) setYourPlayer2("");
                        if (value === opponentPlayer1) setOpponentPlayer1("");
                      }}
                    >
                      <Select.Trigger
                        backgroundColor="$color4"
                        borderColor="$borderColor"
                        width="100%"
                      >
                        <Select.Value placeholder="Select Player 2" />
                      </Select.Trigger>

                      {/* Sheet for mobile */}
                      <Adapt when={true} platform="touch">
                        <Sheet
                          modal
                          dismissOnSnapToBottom
                          position={0}
                        >
                          <Sheet.Frame height={400}>
                            <Adapt.Contents />
                          </Sheet.Frame>
                          <Sheet.Overlay />
                        </Sheet>
                      </Adapt>

                      {/* Scrollable Content */}
                      <Select.Content zIndex={200000}>
                        <Select.ScrollUpButton />
                        <Select.Viewport minH={100} maxH={300}>
                          <Select.Group>
                            <Select.Label>Players</Select.Label>
                            {availableOpponentPlayer2.map((playerName, index) => (
                              <Select.Item key={playerName} value={playerName} index={index}>
                                <Select.ItemText>{playerName}</Select.ItemText>
                              </Select.Item>
                            ))}
                          </Select.Group>
                        </Select.Viewport>
                        <Select.ScrollDownButton />
                      </Select.Content>
                    </Select>
                  )}
                </YStack>

                <Button
                  bg="$color9"
                  onPress={() => {
                    
                  }}
                  mt="$2"
                  color="$color1"
                >
                  Quick Add Player
                </Button>

                
              </YStack>
            </Card>
            <Button
                bg="$color9"
                onPress={handleSaveMatch}
                mt="$1"
                color="$color1"
              >
                Save match scores
              </Button>
          </YStack>
        </ScrollView>
      </View>
    </SafeAreaWrapper>
  );
}




