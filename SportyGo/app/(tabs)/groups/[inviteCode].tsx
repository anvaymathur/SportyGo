import React, { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Linking, Alert } from "react-native";
import { YStack, Card, Button, Text, Paragraph, H3, Spinner } from "tamagui";
import { getGroupInvite, addGroupMember, getGroupById, isInviteUsable } from "../../../firebase/services_firestore2";

import { useAuth0 } from "react-native-auth0";
import { GroupDoc, GroupInviteDoc } from "../../../firebase/types_index";
import { SafeAreaWrapper } from "@/components/SafeAreaWrapper";
import { ScreenHeader } from "@/components/ScreenHeader";

type InviteStatus = "checking" | "valid" | "invalid" | "expired" | "already_member" | "error";

/**
 * Join-a-group screen. Reached from an invite link (deep link) or by typing an invite code on
 * the Groups tab. Checks the invite, shows which group it is for, and joins on confirmation.
 */
export default function GroupInviteScreen() {
  const localParams = useLocalSearchParams<{ inviteCode?: string }>();
  const [invite, setInvite] = useState<GroupInviteDoc | null>(null);
  const [group, setGroup] = useState<GroupDoc | null>(null);
  const joiningRef = useRef(false);
  const [joining, setJoining] = useState(false);
  const [status, setStatus] = useState<InviteStatus>("checking");
  const [inviteCode, setInviteCode] = useState<string | undefined>(localParams.inviteCode);
  const [attempt, setAttempt] = useState(0);

  const { user, isLoading } = useAuth0();
  const userId = user?.sub ?? null;

  // Invite links only work once signed in; go through the normal launch flow first
  useEffect(() => {
    if (!isLoading && !userId) router.replace("/");
  }, [isLoading, userId]);

  // Listen for incoming deep links
  useEffect(() => {
    const handleUrl = (url: string) => {
      try {
        const parsed = new URL(url);
        const code = parsed.searchParams.get("inviteCode");
        if (code) setInviteCode(code);
      } catch {
        console.warn("Invalid URL:", url);
      }
    };

    Linking.getInitialURL().then(url => {
      if (url) handleUrl(url);
    });

    const subscription = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, []);

  // Verify invite whenever inviteCode changes
  useEffect(() => {
    if (!inviteCode || !userId) return;
    let cancelled = false;

    async function verifyInvite() {
      setStatus("checking");
      try {
        const found = await getGroupInvite(inviteCode!);
        if (cancelled) return;
        if (!found) {
          setStatus("invalid");
          return;
        }
        setInvite(found);
        if (found.expired) {
          setStatus("expired");
          return;
        }
        if (!isInviteUsable(found, found.groupId)) {
          setStatus("invalid");
          return;
        }
        const foundGroup = await getGroupById(found.groupId);
        if (cancelled) return;
        if (!foundGroup) {
          // The group was deleted after the invite was made
          setStatus("invalid");
          return;
        }
        setGroup(foundGroup);
        setStatus(foundGroup.MemberIds?.includes(userId!) ? "already_member" : "valid");
      } catch (error) {
        console.error("Error checking invite:", error);
        if (!cancelled) setStatus("error");
      }
    }

    verifyInvite();
    return () => { cancelled = true; };
  }, [inviteCode, userId, attempt]);

  const goToGroups = () => router.replace("/groups/displayGroups");
  const openGroup = (groupId: string) => router.replace({ pathname: "/groups/viewMembers", params: { groupId } });

  const handleAddGroupMember = async () => {
    if (!invite || !userId || joiningRef.current) return;
    joiningRef.current = true;
    setJoining(true);
    try {
      const result = await addGroupMember(userId, invite.groupId, invite.inviteCode);
      if (result === 'joined' || result === 'already_member') {
        openGroup(invite.groupId);
      } else if (result === 'invite_unavailable') {
        // Someone else may have used the last spot since the invite was checked
        setStatus("invalid");
      } else {
        Alert.alert("Couldn't join", "This group no longer exists.");
        setStatus("invalid");
      }
    } catch (error) {
      console.error('Error joining group:', error);
      Alert.alert("Couldn't join", "Something went wrong joining the group. Please try again.");
    } finally {
      joiningRef.current = false;
      setJoining(false);
    }
  };

  const memberCount = group?.MemberIds?.length ?? 0;

  const renderBody = () => {
    if (!inviteCode) {
      return (
        <>
          <H3 color="$color">No invite code</H3>
          <Paragraph color="$color10" style={{ textAlign: 'center' }}>
            Open an invite link, or enter a code from the Groups tab.
          </Paragraph>
        </>
      );
    }
    if (status === "checking") {
      return (
        <>
          <Spinner color="$color9" />
          <Text color="$color10">Checking invite…</Text>
        </>
      );
    }
    if (status === "error") {
      return (
        <>
          <H3 color="$color">Couldn&apos;t check this invite</H3>
          <Paragraph color="$color10" style={{ textAlign: 'center' }}>Check your connection and try again.</Paragraph>
          <Button bg="$color9" color="$color1" mt="$3" onPress={() => setAttempt((n) => n + 1)}>Try again</Button>
        </>
      );
    }
    if (status === "expired") {
      return (
        <>
          <H3 color="$color">Invite expired</H3>
          <Paragraph color="$color10" style={{ textAlign: 'center' }}>
            This invite is no longer valid. Ask a group admin for a new one.
          </Paragraph>
        </>
      );
    }
    if (status === "invalid") {
      return (
        <>
          <H3 color="$color">Invite not valid</H3>
          <Paragraph color="$color10" style={{ textAlign: 'center' }}>
            This code doesn&apos;t match an active invite, or it has been used the maximum number of times.
            Codes are case-sensitive.
          </Paragraph>
        </>
      );
    }
    if (status === "already_member") {
      return (
        <>
          <H3 color="$color">You&apos;re already in {group?.Name || 'this group'}</H3>
          <Button bg="$color9" color="$color1" borderWidth="$0" mt="$3" onPress={() => invite && openGroup(invite.groupId)}>
            View group
          </Button>
        </>
      );
    }
    return (
      <>
        <Paragraph color="$color10">You&apos;ve been invited to join</Paragraph>
        <H3 color="$color" style={{ textAlign: 'center' }}>{group?.Name || 'a group'}</H3>
        <Text color="$color10">{memberCount} {memberCount === 1 ? 'member' : 'members'}</Text>
        {group?.Description ? (
          <Paragraph color="$color" style={{ textAlign: 'center' }} numberOfLines={4}>{group.Description}</Paragraph>
        ) : null}
        <Button
          bg="$color9"
          color="$color1"
          borderWidth="$0"
          width="100%"
          onPress={handleAddGroupMember}
          disabled={joining}
          opacity={joining ? 0.6 : 1}
          mt="$3"
        >
          {joining ? "Joining…" : "Join group"}
        </Button>
      </>
    );
  };

  return (
    <SafeAreaWrapper>
      <ScreenHeader title="Join a group" onBack={goToGroups} />
      <YStack flex={1} p="$4" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Card bordered p="$5" width="100%" bg="$color2" style={{ maxWidth: 420, alignItems: 'center' }}>
          <YStack gap="$2" width="100%" style={{ alignItems: 'center' }}>
            {renderBody()}
          </YStack>
        </Card>
      </YStack>
    </SafeAreaWrapper>
  );
}
