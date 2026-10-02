import React, { useEffect, useState } from "react";
import { Alert, Platform } from "react-native";
import {
  Button, Input,
  YStack, XStack,
  Text, Avatar,
  H2, Select,
  TextArea,
  ScrollView, Card,
  Stack
} from 'tamagui';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import { router, useLocalSearchParams } from "expo-router";
import { useAuth0 } from "react-native-auth0";
import { getGroupById, updateGroup, imageToBase64 } from '../../../firebase/services_firestore2';
import { GroupDoc } from '../../../firebase/types_index';
import { SafeAreaWrapper } from '@/components/SafeAreaWrapper';
import { Ionicons } from "@expo/vector-icons";

export default function GroupSettings() {
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const { user } = useAuth0();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [group, setGroup] = useState<GroupDoc | undefined>(undefined);

  // Form state
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [skillLevel, setSkillLevel] = useState('');
  const [privacy, setPrivacy] = useState('');
  const [homeCourt, setHomeCourt] = useState('');
  const [meetingSchedule, setMeetingSchedule] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [photoChanged, setPhotoChanged] = useState(false);

  const countNonSpaceChars = (val: string) => val.replace(/ /g, '').length;
  const DESCRIPTION_LIMIT = 150;

  const generateGroupInitials = (name: string): string => {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2);
  };

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

  // Check if current user is owner or admin
  const isOwner = group?.OwnerId === user?.sub;
  const isAdmin = group?.AdminIds?.includes(user?.sub || '') ?? false;
  const canEdit = isOwner || isAdmin;

  useEffect(() => {
    const load = async () => {
      const gid = typeof groupId === 'string' && groupId;
      if (!gid) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const g = await getGroupById(gid);
      setGroup(g);
      if (g) {
        setGroupName(g.Name || '');
        setDescription(g.Description || '');
        setSkillLevel(g.SkillLevel || '');
        setPrivacy(g.Privacy || '');
        setHomeCourt(g.HomeCourt || '');
        setMeetingSchedule(g.MeetingSchedule || '');
        // Set photo: if it's a real image (base64 or URL), show it
        if (g.PhotoUrl && !g.PhotoUrl.startsWith('INITIALS:')) {
          setSelectedPhoto(g.PhotoUrl);
        }
      }
      setLoading(false);
    };
    load();
  }, [groupId]);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to select a photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setSelectedPhoto(result.assets[0].uri);
        setPhotoChanged(true);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const clearPhoto = () => {
    setSelectedPhoto(null);
    setPhotoChanged(true);
  };

  const handleSave = async () => {
    if (!group?.id) return;
    const trimmedName = groupName.trim();
    if (!trimmedName) {
      Alert.alert("Missing Information", "Please enter a group name.");
      return;
    }

    setSaving(true);
    try {
      let photoUrl: string | undefined = group.PhotoUrl;

      if (photoChanged) {
        if (selectedPhoto) {
          // Only re-encode if it's a new local URI (not an existing base64/URL)
          if (!selectedPhoto.startsWith('data:')) {
            photoUrl = await imageToBase64(selectedPhoto);
          } else {
            photoUrl = selectedPhoto;
          }
        } else {
          // Photo was cleared — use initials
          photoUrl = `INITIALS:${generateGroupInitials(trimmedName)}`;
        }
      } else if (!photoUrl || photoUrl.startsWith('INITIALS:')) {
        // Keep the initials placeholder in sync with a renamed group
        photoUrl = `INITIALS:${generateGroupInitials(trimmedName)}`;
      }

      const updates: Partial<GroupDoc> = {
        Name: trimmedName,
        Description: description,
        SkillLevel: skillLevel,
        Privacy: privacy,
        HomeCourt: homeCourt,
        MeetingSchedule: meetingSchedule,
        PhotoUrl: photoUrl,
      };

      await updateGroup(group.id, updates);
      Alert.alert("Success", "Group settings updated.", [
        { text: "OK", onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error updating group:', error);
      Alert.alert("Error", "Failed to update group settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaWrapper>
        <YStack flex={1} p="$4" justify="center" items="center">
          <Text color="$color10">Loading group settings...</Text>
        </YStack>
      </SafeAreaWrapper>
    );
  }

  if (!group) {
    return (
      <SafeAreaWrapper>
        <YStack flex={1} p="$4" justify="center" items="center">
          <Text color="$color10">Group not found.</Text>
          <Button mt="$4" onPress={() => router.back()}>
            <Text>Go Back</Text>
          </Button>
        </YStack>
      </SafeAreaWrapper>
    );
  }

  if (!canEdit) {
    return (
      <SafeAreaWrapper>
        <YStack flex={1} p="$4" justify="center" items="center">
          <Ionicons name="lock-closed-outline" size={48} color="#888" />
          <Text color="$color10" mt="$4" fontSize="$5">You don't have permission to edit group settings.</Text>
          <Button mt="$4" bg="$color2" borderColor="$color6" borderWidth="$1" onPress={() => router.back()}>
            <Text color="$color">Go Back</Text>
          </Button>
        </YStack>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper>
      <ScrollView>
        <YStack flex={1} p="$4" space="$6" z={1}>
          {/* Header */}
          <XStack justify="space-between" verticalAlign="center" mb="$2">
            <Button
              bg="$color2"
              borderColor="$color6"
              borderWidth="$1"
              onPress={() => router.back()}
              px="$3"
              py="$2"
            >
              <XStack verticalAlign="center" space="$2">
                <Ionicons name="arrow-back" size={18} color="#888" />
                <Text color="$color">Back</Text>
              </XStack>
            </Button>
          </XStack>
          <H2 color="$color9" fontWeight="bold" flex={1} style={{ textAlign: 'center' }} pb="$8">
            Group Settings
          </H2>

          {/* Group Photo */}
          <YStack mb="$6" style={{ alignItems: 'center' }} p="$4">
            <Stack>
              <Button
                onPress={pickImage}
                bg="transparent"
                borderWidth={0}
                p={0}
                disabled={saving}
                circular
                size="$16"
              >
                <Avatar
                  circular
                  size="$16"
                  borderWidth={2}
                  borderColor="$color9"
                  borderStyle={selectedPhoto ? "solid" : "dashed"}
                  background="transparent"
                  mb="$2"
                >
                  {selectedPhoto ? (
                    <Avatar.Image src={selectedPhoto} />
                  ) : groupName ? (
                    <Avatar.Fallback backgroundColor="$color9" justifyContent="center" alignItems="center">
                      <Text fontSize="$6" color="$color1" fontWeight="bold" style={{ textAlign: 'center' }}>
                        {generateGroupInitials(groupName)}
                      </Text>
                    </Avatar.Fallback>
                  ) : (
                    <Avatar.Fallback background="transparent">
                      <Text fontSize="$8" color="$color9">+</Text>
                    </Avatar.Fallback>
                  )}
                </Avatar>
              </Button>
              <Text color="$color10" fontSize="$3" style={{ textAlign: 'center' }}>
                {saving ? 'Saving...' : selectedPhoto ? '' : groupName ? `Will show: ${generateGroupInitials(groupName)}` : 'Add Group Photo'}
              </Text>
            </Stack>
            {selectedPhoto && (
              <Button ml="$20" onPress={clearPhoto} bg="$color9" borderWidth={10} p={0} disabled={saving}>
                <Ionicons name="trash" size={20} color="white" />
              </Button>
            )}
          </YStack>

          {/* Form Fields */}
          <YStack space="$5" flex={1}>
            {/* Group Name */}
            <YStack space="$2">
              <Text color="$color" fontSize="$4" fontWeight="600">Group Name *</Text>
              <Input
                value={groupName}
                onChangeText={(text: any) => setGroupName(text)}
                placeholder="Enter group name"
                borderColor="$color6"
                borderWidth={1}
                background="$color2"
                color="$color"
                placeholderTextColor="$color10"
                p="$3"
                style={{ borderRadius: 8, fontSize: 16 }}
              />
            </YStack>

            {/* Description */}
            <YStack space="$2">
              <Text color="$color" fontSize="$4" fontWeight="600">Description</Text>
              <TextArea
                value={description}
                onChangeText={(text: any) => {
                  if (countNonSpaceChars(text) <= DESCRIPTION_LIMIT) {
                    setDescription(text);
                  }
                }}
                placeholder="What's this group about?"
                borderColor="$color6"
                borderWidth={1}
                background="$color2"
                color="$color"
                placeholderTextColor="$color10"
                p="$3"
                numberOfLines={5}
                maxLength={150}
                style={{ borderRadius: 8, textAlignVertical: 'top', minHeight: 120, fontSize: 16 }}
              />
              <XStack style={{ justifyContent: 'flex-end' }}>
                <Text color="$color10" fontSize="$2">
                  {countNonSpaceChars(description)}/{DESCRIPTION_LIMIT}
                </Text>
              </XStack>
            </YStack>

            {/* Skill Level */}
            <YStack space="$2" p="$1">
              <Text color="$color" fontSize="$4" fontWeight="600">Group Skill Level</Text>
              {Platform.OS === 'web' ? (
                <Select value={skillLevel} onValueChange={setSkillLevel} defaultValue="">
                  <Select.Trigger borderWidth={2} borderColor="$color6" backgroundColor="$color2" p="$3" borderRadius={8}>
                    <Select.Value placeholder="Select skill level" />
                  </Select.Trigger>
                  <Select.Content zIndex={1000}>
                    <Select.ScrollUpButton />
                    <Select.Viewport height={56 * skillLevels.length + 16}>
                      <Select.Group>
                        {skillLevels.map((level, index) => (
                          <Select.Item key={level.value} index={index} value={level.value}>
                            <Select.ItemText>{level.label}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Group>
                    </Select.Viewport>
                    <Select.ScrollDownButton />
                  </Select.Content>
                </Select>
              ) : (
                <Card borderRadius="$3" overflow="hidden" borderWidth={1} borderColor="$color6" bg="$color2">
                  <Picker
                    selectedValue={skillLevel}
                    onValueChange={setSkillLevel}
                    style={{ color: Platform.OS === 'ios' ? '#000' : undefined }}
                  >
                    <Picker.Item label="Select skill level" value="" color={Platform.OS === 'ios' ? '#000' : undefined} />
                    {skillLevels.map(l => <Picker.Item key={l.value} label={l.label} value={l.value} color={Platform.OS === 'ios' ? '#000' : undefined} />)}
                  </Picker>
                </Card>
              )}
            </YStack>

            {/* Privacy */}
            <YStack space="$2" p="$1">
              <Text color="$color" fontSize="$4" fontWeight="600">Privacy</Text>
              {Platform.OS === 'web' ? (
                <Select value={privacy} onValueChange={setPrivacy} defaultValue="">
                  <Select.Trigger borderWidth={2} borderColor="$color6" backgroundColor="$color2" p="$3" borderRadius={8}>
                    <Select.Value placeholder="Select privacy" />
                  </Select.Trigger>
                  <Select.Content zIndex={1000}>
                    <Select.ScrollUpButton />
                    <Select.Viewport>
                      <Select.Group>
                        {privacyOptions.map((level, index) => (
                          <Select.Item key={level.value} index={index} value={level.value}>
                            <Select.ItemText>{level.label}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Group>
                    </Select.Viewport>
                    <Select.ScrollDownButton />
                  </Select.Content>
                </Select>
              ) : (
                <Card borderRadius="$3" overflow="hidden" borderWidth={1} borderColor="$color6" bg="$color2">
                  <Picker
                    selectedValue={privacy}
                    onValueChange={(val) => setPrivacy(val)}
                    style={{ color: Platform.OS === 'ios' ? '#000' : undefined }}
                  >
                    <Picker.Item label="Select privacy" value="" color={Platform.OS === 'ios' ? '#000' : undefined} />
                    {privacyOptions.map((opt) => (
                      <Picker.Item key={opt.value} label={opt.label} value={opt.value} color={Platform.OS === 'ios' ? '#000' : undefined} />
                    ))}
                  </Picker>
                </Card>
              )}
            </YStack>

            {/* Home Court */}
            <YStack space="$2">
              <Text color="$color" fontSize="$4" fontWeight="600">Home Court</Text>
              <Input
                value={homeCourt}
                onChangeText={(text: any) => setHomeCourt(text)}
                placeholder="Enter court location"
                borderColor="$color6"
                borderWidth={1}
                background="$color2"
                color="$color"
                placeholderTextColor="$color10"
                p="$3"
                style={{ borderRadius: 8, fontSize: 16 }}
              />
            </YStack>

            {/* Meeting Schedule */}
            <YStack space="$2" p="$1">
              <Text color="$color" fontSize="$4" fontWeight="600">Meeting Schedule</Text>
              {Platform.OS === 'web' ? (
                <Select value={meetingSchedule} onValueChange={setMeetingSchedule} defaultValue="">
                  <Select.Trigger borderWidth={2} borderColor="$color6" backgroundColor="$color2" p="$3" borderRadius={8}>
                    <Select.Value placeholder="Select meeting schedule" />
                  </Select.Trigger>
                  <Select.Content zIndex={1000}>
                    <Select.ScrollUpButton />
                    <Select.Viewport>
                      <Select.Group>
                        {frequencyOptions.map((level, index) => (
                          <Select.Item key={level.value} index={index} value={level.value}>
                            <Select.ItemText>{level.label}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Group>
                    </Select.Viewport>
                    <Select.ScrollDownButton />
                  </Select.Content>
                </Select>
              ) : (
                <Card borderRadius="$3" overflow="hidden" borderWidth={1} borderColor="$color6" bg="$color2">
                  <Picker
                    selectedValue={meetingSchedule}
                    onValueChange={(val) => setMeetingSchedule(val)}
                    style={{ color: Platform.OS === 'ios' ? '#000' : undefined }}
                  >
                    <Picker.Item label="Select meeting schedule" value="" color={Platform.OS === 'ios' ? '#000' : undefined} />
                    {frequencyOptions.map((opt) => (
                      <Picker.Item key={opt.value} label={opt.label} value={opt.value} color={Platform.OS === 'ios' ? '#000' : undefined} />
                    ))}
                  </Picker>
                </Card>
              )}
            </YStack>
          </YStack>

          {/* Save Button */}
          <Button
            bg="$color9"
            color="$color1"
            onPress={handleSave}
            style={{ borderRadius: 8 }}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </YStack>
      </ScrollView>
    </SafeAreaWrapper>
  );
}
