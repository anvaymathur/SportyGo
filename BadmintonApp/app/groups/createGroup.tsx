import React, { useState } from "react";
import { View, Alert, ScrollView } from "react-native";
import { 
  Button, Input, 
  YStack, XStack, 
  Text, Avatar, 
  H2, Select,
  TextArea, Sheet
} from 'tamagui';
import { Adapt } from '@tamagui/adapt'

import { router } from "expo-router";
import { useAuth0 } from "react-native-auth0";
import { createGroup } from '../../firebase/services_firestore2';

export default function CreateGroup() {
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [skillLevel, setSkillLevel] = useState('');
  const [privacy, setPrivacy] = useState('');
  const [homeCourt, setHomeCourt] = useState('');
  const [meetingSchedule, setMeetingSchedule] = useState('');
  const {user} = useAuth0();

  const skillLevels = [
    { value: 'recreational', label: 'Recreational' },
    { value: 'competitive', label: 'Competitive' },
    { value: 'professional', label: 'Professional' }
  ];

  const privacyOptions = [
    { value: 'open', label: 'Open' },
    { value: 'invite-only', label: 'Invite only' },
    { value: 'private', label: 'Private' }
  ];

  const frequencyOptions = [
    { value: 'weekly', label: 'Weekly' },
    { value: 'bi-weekly', label: 'Bi-weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'as-needed', label: 'As needed' }
  ];

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert("Missing Information", "Please enter a group name.");
      return;
    }
    
    // Here you would typically save the group data to your backend
    console.log('Creating Group:', {
      groupName,
      description,
      skillLevel,
      privacy,
      homeCourt,
      meetingSchedule
    })
    if (user && user.sub){

      const groupInfo={
        id: '',
        Name: groupName,
        OwnerId: user.sub,
        MemberIds: [user.sub],
        Description: description,
        SkillLevel: skillLevel,
        Privacy: privacy,
        HomeCourt: homeCourt,
        MeetingSchedule: meetingSchedule
      }
      try {
        console.log('Creating group with data:', groupInfo);
        const groupId = await createGroup(user.sub, groupInfo);
        console.log('Group created successfully with ID:', groupId);
        router.push('/groups/displayGroups');
      } catch (error) {
        console.error('Error creating group:', error);
        console.log(error)
        Alert.alert("Error", "Failed to create group. Please try again.");
      }

    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <YStack flex={1} p="$4" space="$6">
          {/* Header */}
            <H2 color="$color9" fontWeight="bold" flex={1} style={{ textAlign: 'center' }}>
              Group Details
            </H2>

          {/* Group Photo Placeholder */}
          <YStack mb="$6" style={{ alignItems: 'center' }}>
            <Avatar 
              circular
              size="$16" 
              borderWidth={2} 
              borderColor="$color9"
              borderStyle="dashed"
              background="transparent"
              mb="$2"
            >
              <Avatar.Fallback background="transparent">
                <Text fontSize="$8" color="$color9">+</Text>
              </Avatar.Fallback>
            </Avatar>
            <Text color="$color10" fontSize="$3" style={{ textAlign: 'center' }}>
              Add Group Photo
            </Text>
          </YStack>

          {/* Form Fields */}
          <YStack space="$5" flex={1}>
            {/* Group Name */}
            <YStack space="$2">
              <Text color="$color" fontSize="$4" fontWeight="600">
                Group Name *
              </Text>
              <Input
                value={groupName}
                onChangeText={setGroupName}
                placeholder="Enter group name"
                borderColor="$color6"
                borderWidth={1}
                background="$color2"
                color="$color"
                placeholderTextColor="$color10"
                fontSize="$4"
                p="$3"
                style={{ borderRadius: 8 }}
              />
            </YStack>

            {/* Description */}
            <YStack space="$2">
              <Text color="$color" fontSize="$4" fontWeight="600">
                Description
              </Text>
              <TextArea
                value={description}
                onChangeText={setDescription}
                placeholder="What's this group about?"
                borderColor="$color6"
                borderWidth={1}
                background="$color2"
                color="$color"
                placeholderTextColor="$color10"
                fontSize="$4"
                p="$3"
                lineHeight={100}
                maxLength={150}
                style={{ borderRadius: 8 }}
              />
              <XStack style={{ justifyContent: 'flex-end' }}>
                <Text color="$color10" fontSize="$2">
                  {description.length}/150
                </Text>
              </XStack>
            </YStack>

            {/* Group Skill Level */}
            <YStack space="$2" p="$1">
              <Text color="$color" fontSize="$4" fontWeight="600">
                Group Skill Level
              </Text>
              <Select
                value={skillLevel}
                onValueChange={setSkillLevel}
                defaultValue=""
              >
                <Select.Trigger
                  borderWidth={2}
                  borderColor="$color6"
                  backgroundColor="$color2"
                  p="$3"
                  borderRadius={8}
                >
                  <Select.Value placeholder="Select skill level" />
                </Select.Trigger>

                {/* Mobile (touch) + small screen = render as Sheet */}
                <Adapt when={true} platform="touch">
                  <Sheet modal dismissOnSnapToBottom snapPoints={[50]}>
                    <Sheet.Frame>
                      <Adapt.Contents />
                    </Sheet.Frame>
                    <Sheet.Overlay />
                  </Sheet>
                </Adapt>

                {/* Web or large screens: render as dropdown */}
                <Select.Content zIndex={1000}>
                  <Select.ScrollUpButton />
                  <Select.Viewport>
                    <Select.Group>
                      {skillLevels.map((level, index) => (
                        <Select.Item
                          key={level.value}
                          index={index}
                          value={level.value}
                        >
                          <Select.ItemText>{level.label}</Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.Group>
                  </Select.Viewport>
                  <Select.ScrollDownButton />
                </Select.Content>
              </Select>
            </YStack>

            {/* Privacy */}
            <YStack space="$2" p="$1">
              <Text color="$color" fontSize="$4" fontWeight="600">
                Privacy
              </Text>
              <Select
                value={privacy}
                onValueChange={setPrivacy}
                defaultValue=""
              >
                <Select.Trigger
                  borderWidth={2}
                  borderColor="$color6"
                  backgroundColor="$color2"
                  p="$3"
                  borderRadius={8}
                >
                  <Select.Value placeholder="Select privacy" />
                </Select.Trigger>

                {/* Mobile (touch) + small screen = render as Sheet */}
                <Adapt when={true} platform="touch">
                  <Sheet modal dismissOnSnapToBottom snapPoints={[50]}>
                    <Sheet.Frame>
                      <Adapt.Contents />
                    </Sheet.Frame>
                    <Sheet.Overlay />
                  </Sheet>
                </Adapt>

                {/* Web or large screens: render as dropdown */}
                <Select.Content zIndex={1000}>
                  <Select.ScrollUpButton />
                  <Select.Viewport>
                    <Select.Group>
                      {privacyOptions.map((level, index) => (
                        <Select.Item
                          key={level.value}
                          index={index}
                          value={level.value}
                        >
                          <Select.ItemText>{level.label}</Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.Group>
                  </Select.Viewport>
                  <Select.ScrollDownButton />
                </Select.Content>
              </Select>
            </YStack>

            {/* Home Court */}
            <YStack space="$2">
              <Text color="$color" fontSize="$4" fontWeight="600">
                Home Court
              </Text>
              <Input
                value={homeCourt}
                onChangeText={setHomeCourt}
                placeholder="Enter court location"
                borderColor="$color6"
                borderWidth={1}
                background="$color2"
                color="$color"
                placeholderTextColor="$color10"
                fontSize="$4"
                p="$3"
                style={{ borderRadius: 8 }}
              />
            </YStack>

            {/* Meeting Schedule */}
            <YStack space="$2" p="$1">
              <Text color="$color" fontSize="$4" fontWeight="600">
                Meeting Schedule
              </Text>
              <Select
                value={meetingSchedule}
                onValueChange={setMeetingSchedule}
                defaultValue=""
              >
                <Select.Trigger
                  borderWidth={2}
                  borderColor="$color6"
                  backgroundColor="$color2"
                  p="$3"
                  borderRadius={8}
                >
                  <Select.Value placeholder="Select meeting schedule" />
                </Select.Trigger>

                {/* Mobile (touch) + small screen = render as Sheet */}
                <Adapt when={true} platform="touch">
                  <Sheet modal dismissOnSnapToBottom snapPoints={[50]}>
                    <Sheet.Frame>
                      <Adapt.Contents />
                    </Sheet.Frame>
                    <Sheet.Overlay />
                  </Sheet>
                </Adapt>

                {/* Web or large screens: render as dropdown */}
                <Select.Content zIndex={1000}>
                  <Select.ScrollUpButton />
                  <Select.Viewport>
                    <Select.Group>
                      {frequencyOptions.map((level, index) => (
                        <Select.Item
                          key={level.value}
                          index={index}
                          value={level.value}
                        >
                          <Select.ItemText>{level.label}</Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.Group>
                  </Select.Viewport>
                  <Select.ScrollDownButton />
                </Select.Content>
              </Select>
            </YStack>
          </YStack>

          {/* Create Group Button */}
          
          <Button
          bg="$color9"
          color="$color1"
          onPress={handleCreateGroup}
          style={{ borderRadius: 8 }}
          >
            Create Group
          </Button>
        </YStack>
      </ScrollView>
    </View>
  );
}