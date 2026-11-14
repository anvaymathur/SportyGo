import React, { useCallback, useRef, useState } from "react";
import { Keyboard } from "react-native";
import {
  Text,
  ScrollView,
  YStack,
  XStack,
  Input,
  Button,
  H2,
  H4,
  Paragraph,
  Card,
  Avatar,
  Spinner,
  useTheme,
} from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import { getUserGroups } from '../../../firebase/services_firestore2';
import { useFocusEffect } from "@react-navigation/native";
import { useAuth0 } from "react-native-auth0";
import { router } from "expo-router";
import { GroupDoc } from '../../../firebase/types_index';
import { SafeAreaWrapper } from "@/components/SafeAreaWrapper";
import { parseInviteCode } from "@/utils/inviteCode";


function getGroupInitials(name: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  let initials;
  if (parts.length === 1) {
    initials = parts[0].slice(0, 2).toUpperCase();
  } else {
    initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return initials;
}

export default function DisplayGroups() {
  const theme = useTheme();
  const mutedIcon = theme.color10?.val as string;
  const [searchQuery, setSearchQuery] = useState("");
  const [groups, setGroups] = useState<GroupDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  // "Join with code" panel
  const [joinOpen, setJoinOpen] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

  const { user } = useAuth0();
  const userId = user?.sub;

  // Only the first load shows the spinner; refreshes on refocus happen in the background
  const hasLoadedRef = useRef(false);

  const loadGroups = useCallback(async () => {
    if (!userId) return;
    try {
      if (!hasLoadedRef.current) setLoading(true);
      setGroups(await getUserGroups(userId));
      setLoadFailed(false);
      hasLoadedRef.current = true;
    } catch (error) {
      console.error("Error loading groups:", error);
      // Keep showing the last good list on a failed background refresh
      if (!hasLoadedRef.current) setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Reload whenever the tab comes back into view, so groups created, joined, edited,
  // left or deleted elsewhere show up without restarting the app
  useFocusEffect(
    useCallback(() => {
      loadGroups();
    }, [loadGroups])
  );

  const submitCode = () => {
    const code = parseInviteCode(codeInput);
    if (!code) {
      setCodeError("Enter the invite code or paste the invite link.");
      return;
    }
    Keyboard.dismiss();
    setJoinOpen(false);
    setCodeInput("");
    setCodeError(null);
    router.push({ pathname: '/groups/[inviteCode]', params: { inviteCode: code } });
  };

  const filteredGroups = groups.filter(group =>
    (group.Name || "").toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const renderList = () => {
    if (loading) {
      return (
        <XStack items="center" gap="$2" p="$4">
          <Spinner size="small" color="$color9" />
          <Text color="$color10">Loading your groups…</Text>
        </XStack>
      );
    }
    if (loadFailed) {
      return (
        <YStack items="center" gap="$2" p="$5">
          <Text color="$color" fontWeight="600">Couldn&apos;t load your groups</Text>
          <Text color="$color10">Check your connection and try again.</Text>
          <Button mt="$2" bg="$color9" color="$color1" onPress={loadGroups}>Try again</Button>
        </YStack>
      );
    }
    if (groups.length === 0) {
      return (
        <YStack items="center" gap="$2" p="$5">
          <Ionicons name="people-outline" size={40} color={mutedIcon} />
          <Text color="$color" fontSize="$5" fontWeight="600">No groups yet</Text>
          <Text color="$color10" style={{ textAlign: 'center' }}>
            Create a group for your regular game, or join one with an invite code from a friend.
          </Text>
        </YStack>
      );
    }
    if (filteredGroups.length === 0) {
      return <Text color="$color10" p="$4">No groups match &quot;{searchQuery.trim()}&quot;.</Text>;
    }
    return filteredGroups.map((group) => (
      <Card
        key={group.id}
        bg="$color2"
        borderRadius="$4"
        p="$4"
        borderWidth={1}
        borderColor="$color6"
        pressStyle={{ opacity: 0.8 }}
        onPress={() => router.push({ pathname: '/groups/viewMembers', params: { groupId: group.id } })}
      >
        <XStack items="center" gap="$3">
          <Avatar circular size="$6" borderWidth={1} borderColor="$color6" backgroundColor="$color9">
            {group.PhotoUrl && group.PhotoUrl.startsWith('data:') ? (
              <Avatar.Image src={group.PhotoUrl} />
            ) : (
              <Avatar.Fallback backgroundColor="$color9" justifyContent="center" alignItems="center">
                <Text color="$color1" fontSize="$4" fontWeight="bold" style={{ textAlign: 'center' }}>
                  {group.PhotoUrl && group.PhotoUrl.startsWith('INITIALS:')
                    ? group.PhotoUrl.replace('INITIALS:', '')
                    : getGroupInitials(group.Name || "?")}
                </Text>
              </Avatar.Fallback>
            )}
          </Avatar>

          <YStack flex={1} gap="$1">
            <H4 color="$color" fontWeight="600" numberOfLines={1}>
              {group.Name || "Unnamed Group"}
            </H4>
            <XStack items="center" gap="$2">
              <Ionicons name="people" size={16} color={mutedIcon} />
              <Text color="$color10" fontSize="$3">
                {(group.MemberIds?.length || 0)} {(group.MemberIds?.length || 0) === 1 ? 'member' : 'members'}
              </Text>
            </XStack>
            {group.Description ? (
              <Text color="$color10" fontSize="$2" numberOfLines={2}>{group.Description}</Text>
            ) : null}
            {group.HomeCourt ? (
              <Text color="$color10" fontSize="$2" numberOfLines={1}>Court: {group.HomeCourt}</Text>
            ) : null}
          </YStack>
          <Ionicons name="chevron-forward" size={18} color={mutedIcon} />
        </XStack>
      </Card>
    ));
  };

  return (
    <SafeAreaWrapper>
      <YStack flex={1} px="$4" pt="$3" gap="$3">
        <YStack>
          <H2 color="$color" fontWeight="700">My Groups</H2>
          {!loading && !loadFailed ? (
            <Paragraph color="$color10">
              {groups.length} {groups.length === 1 ? 'group' : 'groups'}
            </Paragraph>
          ) : null}
        </YStack>

        <XStack gap="$3">
          <Button
            flex={1}
            bg="$color9"
            color="$color1"
            borderWidth={0}
            icon={<Ionicons name="add" size={18} color={theme.color1?.val as string} />}
            onPress={() => router.push('/groups/createGroup')}
          >
            Create group
          </Button>
          <Button
            flex={1}
            bg="$color1"
            color="$color9"
            borderWidth={1}
            borderColor="$color9"
            icon={<Ionicons name="key-outline" size={18} color={theme.color9?.val as string} />}
            onPress={() => { setJoinOpen((open) => !open); setCodeError(null); }}
          >
            Join with code
          </Button>
        </XStack>

        {joinOpen ? (
          <Card bg="$color2" borderWidth={1} borderColor="$color6" p="$3">
            <YStack gap="$2">
              <Text color="$color" fontWeight="600">Enter an invite code</Text>
              <XStack gap="$2" items="center">
                <Input
                  flex={1}
                  value={codeInput}
                  onChangeText={(text: any) => { setCodeInput(text); setCodeError(null); }}
                  placeholder="Invite code or link"
                  autoCapitalize="none"
                  autoFocus
                  returnKeyType="go"
                  onSubmitEditing={submitCode}
                  background="$color1"
                  borderColor="$color6"
                  color="$color"
                  placeholderTextColor="$color10"
                  style={{ fontSize: 16 }}
                />
                <Button bg="$color9" color="$color1" borderWidth={0} onPress={submitCode}>Join</Button>
              </XStack>
              {codeError ? <Text color="$danger" fontSize="$3">{codeError}</Text> : (
                <Text color="$color10" fontSize="$2">Codes are case-sensitive. A group admin can share one from Add Members.</Text>
              )}
            </YStack>
          </Card>
        ) : null}

        {groups.length > 3 ? (
          <Input
            placeholder="Search groups…"
            value={searchQuery}
            onChangeText={(text: any) => setSearchQuery(text)}
            background="$color2"
            borderColor="$color6"
            color="$color"
            placeholderTextColor="$color10"
            style={{ fontSize: 16 }}
          />
        ) : null}

        <ScrollView flex={1} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <YStack gap="$3" pb="$6">
            {renderList()}
          </YStack>
        </ScrollView>
      </YStack>
    </SafeAreaWrapper>
  );
}
