import React from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View, YStack, Card, Button, Text, Paragraph, H3, Spinner } from "tamagui";
import { getGroupInvite } from "../../../firebase/services_firestore2";
import { addGroupMember } from "../../../firebase/services_firestore2";
import { useAuth0 } from "react-native-auth0";
import { Alert } from "react-native";
import { GroupInviteDoc } from "../../../firebase/types_index";

export default function GroupInviteScreen() {
  const { inviteCode } = useLocalSearchParams<{ inviteCode: string }>();
  const [invite, setInvite] = useState<GroupInviteDoc | null>(null);
  const [status, setStatus] = useState<"checking" | "valid" | "invalid" | "expired">("checking");
  const { user } = useAuth0();
  let userId: string | null = null;
  if (user && user.sub) {
    userId = user.sub;
  } else {  
    Alert.alert("Error", "Please login to continue");
    router.replace("/index" as any);
  }

  useEffect(() => {
    async function verifyInvite() {
      const invite = await getGroupInvite(inviteCode);
      if (invite) {
        setInvite(invite);
      }
      if (invite?.expired) {
        setStatus("expired");
      } else if (invite?.maxUses && invite?.used && invite.maxUses <= invite.used) {
        setStatus("invalid");
      } else if (invite?.validUntil && invite?.validUntil < new Date()) {
        setStatus("invalid");
      } else {
        setStatus("valid");
      }
    }
    verifyInvite();
  }, [inviteCode]);

  const handleAddGroupMember = async () => {
    if (invite && userId) {
      const addGroupMemberResult = await addGroupMember(userId, invite.groupId);
      if (addGroupMemberResult) {
        router.replace("/groups" as any);
      } else if (addGroupMemberResult === false) {
        Alert.alert("Error", "You are already a member of this group");
      } else {
        Alert.alert("Error", "Failed to add group member");
      }
    }
  };

  if (status === "checking") {
    return (
      <View flex={1} bg="$background">
        <YStack flex={1} p="$4" space="$2" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <Spinner color="$color9" />
          <Text color="$color10">Verifying invite code...</Text>
        </YStack>
      </View>
    );
  }

  if (status === "expired") {
    return (
      <View flex={1} bg="$background">
        <YStack flex={1} p="$4" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <Card elevate bordered p="$5" borderWidth={1} borderColor="$borderColor" width="100%" style={{ maxWidth: 420, alignItems: 'center' }}>
            <YStack width="100%" space="$3" style={{ alignItems: 'center' }}>
              <H3 color="$color" style={{ textAlign: 'center' }}>Invite Expired</H3>
              <Paragraph color="$color10" style={{ textAlign: 'center' }}>
                This invite link has expired and is no longer valid.
              </Paragraph>
            </YStack>
          </Card>
        </YStack>
      </View>
    );
  }

  if (status === "invalid") {
    return (
      <View flex={1} bg="$background">
        <YStack flex={1} p="$4" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <Card elevate bordered p="$5" borderWidth={1} borderColor="$borderColor" width="100%" style={{ maxWidth: 420, alignItems: 'center' }}>
            <YStack width="100%" space="$3" style={{ alignItems: 'center' }}>
              <H3 color="$color" style={{ textAlign: 'center' }}>Invalid Invite</H3>
              <Paragraph color="$color10" style={{ textAlign: 'center' }}>
                This invite link is invalid or has reached its maximum uses.
              </Paragraph>
            </YStack>
          </Card>
        </YStack>
      </View>
    );
  }

  return (
    <View flex={1} bg="$background">
      <YStack flex={1} p="$4" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Card elevate bordered p="$5" borderWidth={1} borderColor="$borderColor" width="100%" style={{ maxWidth: 420, alignItems: 'center' }}>
          <YStack width="100%" space="$3" style={{ alignItems: 'center' }}>
            <H3 color="$color" style={{ textAlign: 'center' }}>Join Group</H3>
            <Paragraph color="$color10" style={{ textAlign: 'center' }}>
              You've been invited to join this group!
            </Paragraph>
            <YStack width="100%" space="$3">
              <Button size="$5" bg="$color9" color="$color1" onPress={handleAddGroupMember}>
                Join Group
              </Button>
            </YStack>
          </YStack>
        </Card>
      </YStack>
    </View>
  );
}
