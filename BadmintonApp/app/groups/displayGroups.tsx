import React, { useEffect, useState } from "react";
import {
  Text,
  ScrollView,
  YStack,
  XStack,
  Input,
  Button,
  H1,
  H4,
  Square,
  Card,
  Theme,
} from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import { getGroups, getUserGroups } from '../../firebase/services_firestore2';
import { useAuth0 } from "react-native-auth0";
import { router } from "expo-router";
import { GroupDoc } from '../../firebase/types_index';
import { sharedState } from "../shared";


export default function DisplayGroups() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState("All Teams");
  const [groups, setGroups] = useState<GroupDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const {user, clearSession} = useAuth0()

  const onLogout = async () => {
    try {
      await clearSession();
      router.replace('/userSetup/login' );
    } catch (e) {
      console.log('Logout error:', e);
    }
  };


  const toAddScore = async() => {
    router.push('/matchHistory/viewScore')
  }

  const loadGroups = async () => {
    if (user && user.sub) {
      try {
        setLoading(true);
        const groupsData = await getUserGroups(user.sub);
        setGroups(groupsData);
      } catch (error) {
        console.error("Error loading groups:", error);
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadGroups();
  }, [user]);

  const filteredTeams = groups.filter(group =>
    (group.Name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
      <YStack
        flex={1}
        p="$4"
      >
        {/* Header */}
        <XStack
          justify="space-between"
          verticalAlign="center"
        >
          <H1 color="green" fontWeight="bold" mb={40}>
            My Groups
          </H1>
        </XStack>

        

        {/* Search Bar */}
        {/* <YStack space="$4">
          <Input
            placeholder="Search teams..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            background="$gray2"
            borderColor="$green6"
            borderWidth={2}
            
            px="$4"
            py="$3"
            color="white"
            placeholderTextColor="$gray10"
            fontSize="$4"
          />
        </YStack> */}

        {/* Groups List */}
        <ScrollView
          flex={1}
          showsVerticalScrollIndicator={true}
          contentContainerStyle={{ pb: 20 }}
        >
          <YStack space="$3">
            {loading ? (
              <Text color="gray" verticalAlign="center" p="$4">
                Loading groups...
              </Text>
            ) : filteredTeams.length === 0 ? (
              <Text color="gray" verticalAlign="center" p="$4">
                No groups found. Create your first group or join a group!
              </Text>
            ) : (
              filteredTeams.map((group) => (
                                  <Card
                    key={group.id}
                    bg="$green2"
                    borderRadius="$4"
                    p="$4"
                    borderWidth={1}
                    borderColor="$green6"
                    onPress={() => {
                      sharedState.groupPressedId = group.id;
                      router.push('/EventsList');
                    }}
                    mt={20}
                  >
                  <XStack verticalAlign="center" space="$3">
                    {/* Team Details */}
                    <YStack flex={1} space="$1">
                      <H4 color="$green10" fontWeight="600">
                        {group.Name || "Unnamed Group"}
                      </H4>
                      <XStack verticalAlign="center" space="$2">
                        <Ionicons name="people" size={16} color="gray" />
                        <Text color="$green10" fontSize="$3">
                          {(group.MemberIds?.length || 0)} members
                        </Text>
                      </XStack>
                      {/* Show additional info if available */}
                      {group.Description && (
                        <Text color="gray" fontSize="$2">
                          {group.Description}
                        </Text>
                      )}
                      {group.HomeCourt && (
                        <Text color="gray" fontSize="$2">
                          Court: {group.HomeCourt}
                        </Text>
                      )}
                    </YStack>
                  </XStack>
                </Card>
              ))
            )}
          </YStack>
          {/* Create Team Button */}
        <Button
          bg="$green10"
          color="white"
          borderWidth={0} 
          onPress={() => router.push('/groups/createGroup')}
          p='$2'
          flexDirection="row"
          mt={10}
          verticalAlign="center"
        >
          <Ionicons name="add" size={20} color="white" />
            Create Group
        </Button>
        </ScrollView>

         {/* Floating Action Button */}
         <Button
          position="absolute"
          circular
          b={20}
          r={20}
          width={56}
          height={56

          }
          bg="$green10"
          borderWidth={0}
          onPress={toAddScore}
          shadowColor="$green8"
          shadowOffset={{ width: 0, height: 2 }}
          shadowOpacity={0.25}
          shadowRadius={3.84}
          elevation={5}
          color='white'
          
        >
          SO
        </Button>
      </YStack>
  );
}
