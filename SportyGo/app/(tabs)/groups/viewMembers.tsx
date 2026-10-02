import React, { useEffect, useMemo, useState } from "react";
import { YStack, XStack, Text, H2, H4, Input, Button, Card, ScrollView, Avatar } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import { Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth0 } from "react-native-auth0";
import { GroupDoc, UserDoc } from "../../../firebase/types_index";
import { getGroupById, getUsersByIds, addGroupAdmin, removeGroupAdmin } from "../../../firebase/services_firestore2";
import { SafeAreaWrapper } from "@/components/SafeAreaWrapper";

function getInitials(name: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ViewMembers() {
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<GroupDoc | undefined>(undefined);
  const [members, setMembers] = useState<UserDoc[]>([]);
  const [query, setQuery] = useState("");
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const { user } = useAuth0();

  const userId = user?.sub || '';
  const isOwner = group?.OwnerId === userId;
  const isAdmin = group?.AdminIds?.includes(userId) ?? false;
  const canAccessSettings = isOwner || isAdmin;

  useEffect(() => {
    const load = async () => {
      const gid = (typeof groupId === 'string' && groupId);
      if (!gid) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const group = await getGroupById(gid);
      setGroup(group);
      if (group && Array.isArray(group.MemberIds) && group.MemberIds.length > 0) {
        const profiles = await getUsersByIds(group.MemberIds);
        setMembers(profiles);
      } else {
        setMembers([]);
      }
      setLoading(false);
    };
    load();
  }, [groupId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(m =>
      (m.Name || "").toLowerCase().includes(q) ||
      (m.Email || "").toLowerCase().includes(q) ||
      (m.Phone || "").toLowerCase().includes(q)
    );
  }, [members, query]);

  const getMemberRole = (memberId: string): 'owner' | 'admin' | 'member' => {
    if (group?.OwnerId === memberId) return 'owner';
    if (group?.AdminIds?.includes(memberId)) return 'admin';
    return 'member';
  };

  const handleToggleAdmin = (member: UserDoc) => {
    const memberRole = getMemberRole(member.id);
    if (memberRole === 'owner') return; // Can't change owner role

    if (memberRole === 'admin') {
      Alert.alert(
        "Remove Admin",
        `Remove ${member.Name} as admin?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              try {
                await removeGroupAdmin(group!.id, member.id);
                setGroup(prev => prev ? {
                  ...prev,
                  AdminIds: (prev.AdminIds || []).filter(id => id !== member.id)
                } : prev);
              } catch (error) {
                console.error('Error removing admin:', error);
                Alert.alert("Error", "Failed to remove admin.");
              }
            }
          }
        ]
      );
    } else {
      Alert.alert(
        "Make Admin",
        `Make ${member.Name} an admin? Admins can edit group settings.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Make Admin",
            onPress: async () => {
              try {
                await addGroupAdmin(group!.id, member.id);
                setGroup(prev => prev ? {
                  ...prev,
                  AdminIds: [...(prev.AdminIds || []), member.id]
                } : prev);
              } catch (error) {
                console.error('Error adding admin:', error);
                Alert.alert("Error", "Failed to make admin.");
              }
            }
          }
        ]
      );
    }
  };

  const roleBadge = (memberId: string) => {
    const role = getMemberRole(memberId);
    if (role === 'owner') {
      return (
        <XStack bg="#4A90D9" rounded="$2" px="$2" py="$1" ml="$2">
          <Text color="white" fontSize="$1" fontWeight="600">Owner</Text>
        </XStack>
      );
    }
    if (role === 'admin') {
      return (
        <XStack bg="#E8A838" rounded="$2" px="$2" py="$1" ml="$2">
          <Text color="white" fontSize="$1" fontWeight="600">Admin</Text>
        </XStack>
      );
    }
    return null;
  };

  return (
    <SafeAreaWrapper>
      <YStack flex={1} p="$4" bg="$background">
        <YStack mb={20}>
          <XStack justify="space-between" items="center" mb={10}>
            <Button
              bg="$color2"
              borderColor="$color6"
              borderWidth="$1"
              onPress={() => router.replace('/groups/displayGroups')}
              px="$3"
              py="$2"
            >
              <XStack items="center" space="$2">
                <Ionicons name="arrow-back" size={18} color="#888" />
                <Text color="$color">Back</Text>
              </XStack>
            </Button>
            {canAccessSettings && (
              <Button
                bg="$color2"
                borderColor="$color6"
                borderWidth="$1"
                onPress={() => {
                  router.push({
                    pathname: '/groups/groupSettings',
                    params: { groupId: group?.id }
                  });
                }}
                px="$3"
                py="$2"
              >
                <XStack items="center" space="$2">
                  <Ionicons name="settings-outline" size={18} color="#888" />
                  <Text color="$color">Settings</Text>
                </XStack>
              </Button>
            )}
          </XStack>
          <Text
            color="$color9"
            fontWeight="bold"
            fontSize="$10"
            numberOfLines={2}
            ellipsizeMode="tail"
            style={{ textAlign: 'center' }}
          >
            {group?.Name || "Group Members"}
          </Text>
        </YStack>

        <Input
          placeholder="Search members..."
          value={query}
          onChangeText={(text: any) => setQuery(text)}
          background="$color2"
          borderColor="$color6"
          px="$4"
          py="$3"
          color="$color"
          placeholderTextColor="$color10"
          style={{ fontSize: 16 }}
          mb={10}
        />

        <Text color="$color10" mb={10}>
          {loading ? "Loading members..." : `${filtered.length} member${filtered.length === 1 ? "" : "s"}`}
        </Text>

        <ScrollView flex={1} showsVerticalScrollIndicator>
          <YStack space="$3" pb="$4">
            {!loading && filtered.length === 0 ? (
              <Text color="$color10">No members found.</Text>
            ) : (
              filtered.map((u) => (
                <Card
                  key={u.id}
                  bg="$color2"
                  borderRadius="$4"
                  p="$3"
                  borderWidth="$1"
                  borderColor="$color6"
                >
                  <XStack items="center" space="$3">
                    <Avatar circular size="$6" borderWidth={1} borderColor="$color6" backgroundColor="$color2">
                      <Avatar.Image src={require("../../../assets/images/defaultUserProfileImage.png")} />
                      <Avatar.Fallback backgroundColor="$color2">
                        <Text color="$color9">{getInitials(u.Name)}</Text>
                      </Avatar.Fallback>
                    </Avatar>
                    <YStack flex={1}>
                      <XStack items="center">
                        <H4 color="$color" fontWeight="600">{u.Name}</H4>
                        {roleBadge(u.id)}
                      </XStack>
                      <Text color="$color10" fontSize="$2">{u.Email}</Text>
                      {!!u.Phone && (
                        <Text color="$color10" fontSize="$2">{u.Phone}</Text>
                      )}
                    </YStack>
                    {/* Admin toggle button - only visible to owner, not on the owner's own card */}
                    {isOwner && u.id !== group?.OwnerId && (
                      <Button
                        bg="transparent"
                        borderWidth={0}
                        p="$2"
                        onPress={() => handleToggleAdmin(u)}
                        aria-label={getMemberRole(u.id) === 'admin' ? `Remove ${u.Name} as admin` : `Make ${u.Name} an admin`}
                      >
                        <Ionicons
                          name={getMemberRole(u.id) === 'admin' ? "shield" : "shield-outline"}
                          size={22}
                          color={getMemberRole(u.id) === 'admin' ? "#E8A838" : "#888"}
                        />
                      </Button>
                    )}
                  </XStack>
                </Card>
              ))
            )}
          </YStack>
        </ScrollView>

        {/* Add Members Button */}
        <Button
          bg="$color9"
          color="$color1"
          borderWidth="$0"
          onPress={() => {
            router.push({
              pathname: '/groups/addMembers',
              params: { groupId: group?.id }
            });
          }}
          p="$3"
          mt="$4"
          style={{ borderRadius: 8 }}
        >
          <XStack items="center" space="$2">
            <Ionicons name="person-add-outline" size={20} color="white" />
            <Text color="$color1" fontWeight="600">Add Members</Text>
          </XStack>
        </Button>
      </YStack>
    </SafeAreaWrapper>
  );
}
