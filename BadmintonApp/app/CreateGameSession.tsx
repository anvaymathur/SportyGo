import React, { useState, useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { createEvent, getGroups } from '../firebase/services_firestore2';
import { GroupDoc } from '../firebase/types_index';
import { useAuth0 } from 'react-native-auth0';
import { Theme, YStack, XStack, ScrollView, Button, Input, Label, Paragraph, H2, Text, Card } from 'tamagui';

 type FormErrors = {
  title?: string;
  gameDate?: string;
  gameTime?: string;
  location?: string;
  votingCutoff?: string;
  group?: string;
};

export default function CreateGameSession() {
  const today = new Date();
  const tomorrow = new Date(today);
  const { user } = useAuth0();
  let userId = 'default-user';

  if (user && user.sub) {
    userId = user.sub;
  }

  tomorrow.setDate(tomorrow.getDate() + 1);

  // State for form fields
  const [title, setTitle] = useState('');
  const [gameDate, setGameDate] = useState(tomorrow);
  const [showGameDate, setShowGameDate] = useState(false);
  const [gameTime, setGameTime] = useState(new Date());
  const [showGameTime, setShowGameTime] = useState(false);
  const [location, setLocation] = useState('');
  const [votingEnabled, setVotingEnabled] = useState(true);
  const [votingCutoff, setVotingCutoff] = useState(today);
  const [showVotingCutoff, setShowVotingCutoff] = useState(false);
  const [group, setGroup] = useState('');

  // State for groups
  const [groups, setGroups] = useState<GroupDoc[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  // State for errors
  const [errors, setErrors] = useState<FormErrors>({});
  // State for success
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch groups on component mount
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        setLoadingGroups(true);
        const fetchedGroups = await getGroups();
        setGroups(fetchedGroups);
      } catch (error) {
        Alert.alert('Error', 'Failed to load groups.');
      } finally {
        setLoadingGroups(false);
      }
    };

    fetchGroups();
  }, []);

  // Validation helpers
  const validate = () => {
    const newErrors: FormErrors = {};
    if (!title || title.trim().length < 3) {
      newErrors.title = 'Title must be at least 3 characters';
    }
    if (!gameDate || gameDate < new Date(today.setHours(0, 0, 0, 0))) {
      newErrors.gameDate = 'Game date cannot be in the past';
    }
    if (!gameTime) {
      newErrors.gameTime = 'Game time is required';
    }
    if (!location || location.trim().length < 3) {
      newErrors.location = 'Location must be at least 3 characters';
    }
    if (votingEnabled) {
      if (!votingCutoff || votingCutoff < new Date(today.setHours(0, 0, 0, 0))) {
        newErrors.votingCutoff = 'Voting cutoff cannot be in the past';
      }
      if (votingCutoff > gameDate) {
        newErrors.votingCutoff = 'Voting cutoff must be before or on the game date';
      }
    }
    if (!group) {
      newErrors.group = 'Group is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handlers for date/time pickers
  const onChangeGameDate = (event: any, selectedDate?: Date) => {
    setShowGameDate(false);
    if (selectedDate) setGameDate(selectedDate);
  };
  const onChangeGameTime = (event: any, selectedTime?: Date) => {
    setShowGameTime(false);
    if (selectedTime) setGameTime(selectedTime);
  };
  const onChangeVotingCutoff = (event: any, selectedDate?: Date) => {
    setShowVotingCutoff(false);
    if (selectedDate) setVotingCutoff(selectedDate);
  };

  // Submit handler
  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      // Build EventDoc object
      const event = {
        id: '', // Firestore will generate the ID
        GroupID: group,
        Title: title.trim(),
        EventDate: new Date(
          gameDate.getFullYear(),
          gameDate.getMonth(),
          gameDate.getDate(),
          gameTime.getHours(),
          gameTime.getMinutes()
        ),
        Location: location,
        CutoffDate: votingEnabled ? votingCutoff : undefined,
        CreatorID: userId,
        VotingEnabled: votingEnabled,
      };
      await createEvent(event);
      setLoading(false);
      setSuccess(true);
    } catch (e) {
      setLoading(false);
      Alert.alert('Error', 'Failed to create event.');
    }
  };

  const handleCancel = () => {
    Alert.alert('Cancel', 'Are you sure you want to cancel? All entered data will be lost.', [
      { text: 'No' },
      { text: 'Yes', onPress: () => router.back() },
    ]);
  };

  const resetForm = () => {
    setTitle('');
    setGameDate(tomorrow);
    setGameTime(new Date());
    setLocation('');
    setVotingEnabled(true);
    setVotingCutoff(today);
    setGroup('');
    setErrors({});
    setSuccess(false);
    setLoading(false);
  };

  const handleCreateAnother = () => {
    resetForm();
  };

  const handleViewSessions = () => {
    router.push('/EventsList');
  };

  const FieldError = ({ message }: { message?: string }) =>
    message ? (
      <Paragraph style={{ fontSize: 13, marginTop: 2, color: '#EF4444' }}>{message}</Paragraph>
    ) : null;

  const InputLikeButton = ({
    children,
    onPress,
    disabled,
  }: {
    children: React.ReactNode;
    onPress: () => void;
    disabled?: boolean;
  }) => (
    <Button
      onPress={onPress}
      disabled={disabled}
      unstyled
      borderWidth={1}
      borderColor="$borderColor"
      rounded="$3"
      p={10}
      bg="$color1"
      verticalAlign="flex-start"
    >
      <Text style={{ fontSize: 16 }} color="$color">
        {children}
      </Text>
    </Button>
  );

  const FormGroup = ({ children }: { children: React.ReactNode }) => (
    <YStack mb={18}>{children}</YStack>
  );

  return (
    <Theme name="earthy-sport-light">
      <YStack flex={1} bg="$background">
        <YStack p={24} pb={16}>
          <Text onPress={() => router.back()} color="$color9" fontWeight="600" style={{ fontSize: 16 }} mb={16}>
            ← Back
          </Text>
          <H2 verticalAlign="center" mb={4}>
            Create New Game Session
          </H2>
          <Paragraph verticalAlign="center" color="$color10" style={{ fontSize: 16 }} mb={24}>
            Set up a new game session for your group
          </Paragraph>
        </YStack>

        {!success ? (
          <ScrollView>
            <YStack px={20} pb={24}>
              <Card
                backgroundColor="$color2"
                padding={20}
                borderRadius={12}
                shadowColor="$shadowColor"
                borderWidth={1}
                borderColor="$borderColor"
              >
                <YStack>
                  {/* Title */}
                  <FormGroup>
                    <Label htmlFor="title" style={{ fontSize: 16, fontWeight: '500' }} mb={6}>
                      Event Title
                    </Label>
                    <Input
                      id="title"
                      value={title}
                      onChangeText={setTitle}
                      placeholder="Enter event title (e.g., 'Weekend Tournament')"
                      autoCapitalize="words"
                      borderColor={errors.title ? ('#EF4444' as any) : ('$borderColor' as any)}
                      bg="$color1"
                    />
                    <FieldError message={errors.title} />
                  </FormGroup>

                  {/* Game Date */}
                  <FormGroup>
                    <Label style={{ fontSize: 16, fontWeight: '500' }} mb={6}>
                      Game Date
                    </Label>
                    <InputLikeButton onPress={() => setShowGameDate(true)} >
                      {gameDate ? gameDate.toISOString().split('T')[0] : 'Select date'}
                    </InputLikeButton>
                    {showGameDate && (
                      <DateTimePicker
                        value={gameDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        minimumDate={today}
                        onChange={onChangeGameDate}
                      />
                    )}
                    <FieldError message={errors.gameDate} />
                  </FormGroup>

                  {/* Game Time */}
                  <FormGroup>
                    <Label style={{ fontSize: 16, fontWeight: '500' }} mb={6}>
                      Game Time
                    </Label>
                    <InputLikeButton onPress={() => setShowGameTime(true)}>
                      {gameTime
                        ? gameTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'Select time'}
                    </InputLikeButton>
                    {showGameTime && (
                      <DateTimePicker
                        value={gameTime}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={onChangeGameTime}
                      />
                    )}
                    <FieldError message={errors.gameTime} />
                  </FormGroup>

                  {/* Location */}
                  <FormGroup>
                    <Label style={{ fontSize: 16, fontWeight: '500' }} mb={6}>
                      Location
                    </Label>
                    <Input
                      value={location}
                      onChangeText={setLocation}
                      placeholder="Enter game location"
                      autoCapitalize="words"
                      borderColor={errors.location ? ('#EF4444' as any) : ('$borderColor' as any)}
                      bg="$color1"
                    />
                    <FieldError message={errors.location} />
                  </FormGroup>

                  {/* Voting Toggle */}
                  <FormGroup>
                    <Label style={{ fontSize: 16, fontWeight: '500' }} mb={6}>
                      Enable Voting
                    </Label>
                    <XStack verticalAlign="center" space={12}>
                      <Button
                        size="$3"
                        bg={votingEnabled ? '$color9' : '$color3'}
                        color={votingEnabled ? '$color1' : '$color'}
                        onPress={() => setVotingEnabled(true)}
                        disabled={loading}
                      >
                        Yes
                      </Button>
                      <Button
                        size="$3"
                        bg={!votingEnabled ? '$color9' : '$color3'}
                        color={!votingEnabled ? '$color1' : '$color'}
                        onPress={() => setVotingEnabled(false)}
                        disabled={loading}
                      >
                        No
                      </Button>
                    </XStack>
                    <Paragraph style={{ fontSize: 14, color: '$color10', marginTop: 4 }}>
                      Allow participants to vote on attendance
                    </Paragraph>
                  </FormGroup>

                  {/* Voting Cutoff - Only show if voting is enabled */}
                  {votingEnabled && (
                    <FormGroup>
                      <Label style={{ fontSize: 16, fontWeight: '500' }} mb={6}>
                        Voting closes on:
                      </Label>
                      <InputLikeButton onPress={() => setShowVotingCutoff(true)}>
                        {votingCutoff ? votingCutoff.toISOString().split('T')[0] : 'Select date'}
                      </InputLikeButton>
                      {showVotingCutoff && (
                        <DateTimePicker
                          value={votingCutoff}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          minimumDate={today}
                          onChange={onChangeVotingCutoff}
                        />
                      )}
                      <FieldError message={errors.votingCutoff} />
                    </FormGroup>
                  )}

                  {/* Group */}
                  <FormGroup>
                    <Label style={{ fontSize: 16, fontWeight: '500' }} mb={6}>
                      Group
                    </Label>
                    <YStack borderWidth={1} borderColor="$borderColor" overflow="hidden" bg="$color1">
                      <Picker selectedValue={group} onValueChange={setGroup} enabled={!loadingGroups}>
                        <Picker.Item label={loadingGroups ? 'Loading groups...' : 'Select a group'} value="" />
                        {groups.map((g) => (
                          <Picker.Item key={g.id} label={g.Name} value={g.id} />
                        ))}
                      </Picker>
                    </YStack>
                    <FieldError message={errors.group} />
                  </FormGroup>

                  {/* Actions */}
                  <XStack flexDirection="row" justify="space-between" mt={16}>
                    <Button
                      flex={1}
                      bg="$color2"
                      color="$color"
                      onPress={handleCancel}
                      disabled={loading}
                      mx={4}
                    >
                      Cancel
                    </Button>
                    <Button
                      flex={1}
                      bg="$color9"
                      color="$color1"
                      opacity={loading ? 0.7 : 1}
                      onPress={handleSubmit}
                      disabled={loading}
                      mx={4}
                    >
                      {/* {loading ? 'Creating...' : 'Create Session'} */}
                      Create
                    </Button>
                  </XStack>
                </YStack>
              </Card>
            </YStack>
          </ScrollView>
        ) : (
          <YStack verticalAlign="center" justify="center" p={32}>
            <Text style={{ fontSize: 48 }} color="$color9" mb={12}>
              ✓
            </Text>
            <H2 verticalAlign="center" mb={8}>
              Game Session Created Successfully!
            </H2>
            <Paragraph verticalAlign="center" color="$color" style={{ fontSize: 16 }} mb={24}>
              Your game session has been created and participants will be notified.
            </Paragraph>
            <XStack justify="space-between" width="100%">
              <Button flex={1} bg="$color2" color="$color" onPress={handleCreateAnother} mx={4}>
                Create Another Session
              </Button>
              <Button flex={1} bg="$color9" color="$color12" onPress={handleViewSessions} mx={4}>
                View All Sessions
              </Button>
            </XStack>
          </YStack>
        )}
      </YStack>
    </Theme>
  );
} 
