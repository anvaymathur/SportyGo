import React, { useState, useEffect } from 'react';
import { Alert, Platform, TouchableOpacity } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { createEvent, getUserGroups, getAllUserProfiles } from '../firebase/services_firestore2';
import { GroupDoc, UserDoc } from '../firebase/types_index';
import { useAuth0 } from 'react-native-auth0';
import { Theme, YStack, XStack, ScrollView, Button, Input, Label, Paragraph, H2, Text, Card } from 'tamagui';

 type FormErrors = {
  title?: string;
  gameDate?: string;
  gameTime?: string;
  location?: string;
  totalCost?: string;
  votingCutoff?: string;
  groups?: string;
  participants?: string;
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
  const [totalCost, setTotalCost] = useState('');
  const [votingEnabled, setVotingEnabled] = useState(true);
  const [votingCutoff, setVotingCutoff] = useState(() => {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    return endOfToday;
  });
  const [showVotingCutoff, setShowVotingCutoff] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // State for groups and users
  const [groups, setGroups] = useState<GroupDoc[]>([]);
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // State for errors
  const [errors, setErrors] = useState<FormErrors>({});
  // State for success
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch groups and users on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingGroups(true);
        setLoadingUsers(true);
        
        const [fetchedGroups, fetchedUsers] = await Promise.all([
          getUserGroups(userId),
          getAllUserProfiles()
        ]);
        
        setGroups(fetchedGroups);
        setUsers(fetchedUsers);
        setGroupsLoaded(true);
      } catch (error) {
        Alert.alert('Error', 'Failed to load groups and users.');
      } finally {
        setLoadingGroups(false);
        setLoadingUsers(false);
      }
    };

    fetchData();
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
    if (totalCost && (isNaN(Number(totalCost)) || Number(totalCost) < 0)) {
      newErrors.totalCost = 'Total cost must be a valid positive number';
    }
    if (votingEnabled) {
      if (!votingCutoff) {
        newErrors.votingCutoff = 'Voting cutoff date is required';
              } else {
          const now = new Date();
          now.setHours(0, 0, 0, 0); // Set to 12:00am
          if (votingCutoff < now) {
      newErrors.votingCutoff = 'Voting cutoff cannot be in the past';
    }
        // Allow voting cutoff on the same date as the game
        // The voting will automatically close when the event starts
      }
    }
    
    // Check minimum participants requirement
    const selectedGroupData = selectedGroup ? groups.find(g => g.id === selectedGroup) : null;
    const groupMemberCount = selectedGroupData ? selectedGroupData.MemberIds.length : 0;
    const individualCount = selectedParticipants.length + (!selectedGroup && !selectedParticipants.includes(userId) ? 1 : 0);
    const totalParticipants = groupMemberCount + individualCount;
    
    if (totalParticipants < 2) {
      newErrors.participants = 'You need at least 2 participants total (group and/or individuals)';
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
    if (selectedDate) {
      // Set the voting cutoff to the end of the selected date (23:59:59)
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);
      setVotingCutoff(endOfDay);
    }
  };

  // Submit handler
  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      // Ensure creator is always included as a participant
      let finalIndividualParticipants = [...selectedParticipants];
      
      // If no group is selected, creator must be in individual participants
      if (!selectedGroup && !finalIndividualParticipants.includes(userId)) {
        finalIndividualParticipants.push(userId);
      }
      
      // Build EventDoc object
      const event = {
        id: '', // Firestore will generate the ID
        GroupIDs: selectedGroup ? [selectedGroup] : [],
        IndividualParticipantIDs: finalIndividualParticipants,
        Title: title.trim(),
        EventDate: new Date(
          gameDate.getFullYear(),
          gameDate.getMonth(),
          gameDate.getDate(),
          gameTime.getHours(),
          gameTime.getMinutes()
        ),
        Location: location,
        TotalCost: totalCost ? Number(totalCost) : undefined,
        CutoffDate: votingEnabled ? votingCutoff : new Date('1970-01-01'),
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
    setTotalCost('');
    setVotingEnabled(true);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    setVotingCutoff(endOfToday);
    setSelectedGroup(null);
    setSelectedParticipants([]);
    setUserSearchQuery('');
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

  const toggleParticipant = (userId: string) => {
    setSelectedParticipants(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const getSelectedParticipantNames = () => {
    return selectedParticipants.map(userId => 
      users.find(u => u.id === userId)?.Name || 'Unknown User'
    );
  };

  const getFilteredUsers = () => {
    if (!userSearchQuery.trim()) return users;
    return users.filter(user => 
      user.Name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      user.Email.toLowerCase().includes(userSearchQuery.toLowerCase())
    );
  };



  const FieldError = ({ message }: { message?: string }) =>
    message ? (
      <Paragraph fontSize={13} mt={2} color="#EF4444">{message}</Paragraph>
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
    <YStack mb={12}>{children}</YStack>
  );

  return (
    <Theme name="earthy-sport-light">
      <YStack flex={1} bg="$background">
        <YStack p={20} pb={12}>
          <Text onPress={() => router.back()} color="$color9" fontWeight="600" style={{ fontSize: 16 }} mb={12}>
            ← Back
          </Text>
          <H2 verticalAlign="center" mb={2}>
            Create New Game Session
          </H2>
          <Paragraph verticalAlign="center" color="$color10" style={{ fontSize: 16 }} mb={16}>
            Set up a new game session for your group
          </Paragraph>
        </YStack>

        {!success ? (
          <ScrollView>
            <YStack px={16} pb={20}>
              <Card
                backgroundColor="$color2"
                  padding={16}
                borderRadius={12}
                shadowColor="$shadowColor"
                borderWidth={1}
                borderColor="$borderColor"
              >
                <YStack>
                  {/* Title */}
                  <FormGroup>
                    <Label htmlFor="title" style={{ fontSize: 16, fontWeight: '500' }} mb={4}>
                      Event Title
                    </Label>
                    <Input
                      id="title"
                      value={title}
                      onChangeText={setTitle}
                      placeholder="Enter event title (e.g., 'Weekend Tournament')"
                      autoCapitalize="words"
                       borderColor={errors.title ? "#EF4444" : "$borderColor"}
                      bg="$color1"
                    />
                    <FieldError message={errors.title} />
                  </FormGroup>

                  {/* Game Date */}
                  <FormGroup>
                    <Label style={{ fontSize: 16, fontWeight: '500' }} mb={4}>
                      Game Date
                    </Label>
                    <InputLikeButton onPress={() => setShowGameDate(true)} >
                      {gameDate ? gameDate.toLocaleDateString() : 'Select date'}
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
                    <Label style={{ fontSize: 16, fontWeight: '500' }} mb={4}>
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
                    <Label style={{ fontSize: 16, fontWeight: '500' }} mb={4}>
                      Location
                    </Label>
                    <Input
                      value={location}
                      onChangeText={setLocation}
                      placeholder="Enter game location"
                      autoCapitalize="words"
                       borderColor={errors.location ? "#EF4444" : "$borderColor"}
                      bg="$color1"
                    />
                    <FieldError message={errors.location} />
                  </FormGroup>

                  {/* Total Cost */}
                  <FormGroup>
                    <Label style={{ fontSize: 16, fontWeight: '500' }} mb={4}>
                      Total Cost (Optional)
                    </Label>
                    <Input
                      value={totalCost}
                      onChangeText={setTotalCost}
                      placeholder="Enter total cost (e.g., 50.00)"
                      keyboardType="numeric"
                      borderColor={errors.totalCost ? "#EF4444" : "$borderColor"}
                      bg="$color1"
                    />
                    <FieldError message={errors.totalCost} />
                  </FormGroup>

                  {/* Voting Toggle */}
                  <FormGroup>
                    <Label style={{ fontSize: 16, fontWeight: '500' }} mb={4}>
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
                  </FormGroup>

                  {/* Voting Cutoff - Only show if voting is enabled */}
                  {votingEnabled && (
                  <FormGroup>
                      <Label style={{ fontSize: 16, fontWeight: '500' }} mb={4}>
                      Voting closes on:
                    </Label>
                                          <InputLikeButton onPress={() => setShowVotingCutoff(true)}>
                        {votingCutoff ? votingCutoff.toLocaleDateString() : 'Select date'}
                      </InputLikeButton>
                    {showVotingCutoff && (
                      <DateTimePicker
                        value={votingCutoff}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          minimumDate={new Date(today.setHours(0, 0, 0, 0))}
                        onChange={onChangeVotingCutoff}
                      />
                    )}
                    <FieldError message={errors.votingCutoff} />
                  </FormGroup>
                  )}

                  {/* Group Selection */}
                  <FormGroup>
                    <Label style={{ fontSize: 16, fontWeight: '500' }} mb={4}>
                      Group (Optional)
                    </Label>
                    {loadingGroups ? (
                      <YStack p={12} bg="$color3" verticalAlign="center">
                        <Text fontSize={14} color="$color10">
                          Loading your groups...
                        </Text>
                      </YStack>
                                        ) : (
                      <YStack>
                    <YStack borderWidth={1} borderColor="$borderColor" overflow="hidden" bg="$color1">
                          <Picker 
                            selectedValue={selectedGroup} 
                            onValueChange={setSelectedGroup} 
                            enabled={!loadingGroups && groupsLoaded}
                            style={{ 
                              backgroundColor: 'transparent',
                              color: Platform.OS === 'ios' ? '#000' : undefined
                            }}
                          >
                            <Picker.Item 
                              label="No group selected" 
                              value={null}
                              color={Platform.OS === 'ios' ? '#666' : undefined}
                            />
                        {groups.map((g) => (
                              <Picker.Item 
                                key={g.id} 
                                label={g.Name} 
                                value={g.id}
                                color={Platform.OS === 'ios' ? '#000' : undefined}
                              />
                        ))}
                      </Picker>
                    </YStack>
                        {selectedGroup && (
                          <Card mt={4} p={8} bg="$color3" borderRadius="$2">
                            <Text fontSize={12} color="$color10">
                              Selected: {groups.find(g => g.id === selectedGroup)?.Name}
                            </Text>
                          </Card>
                        )}


                      </YStack>
                    )}
                  </FormGroup>

                                    {/* Individual Participants Selection */}
                  <FormGroup>
                    <Label style={{ fontSize: 16, fontWeight: '500' }} mb={4}>
                      Individual Participants (Optional)
                    </Label>
                    <Input
                      placeholder="Search users by name or email..."
                      value={userSearchQuery}
                      onChangeText={setUserSearchQuery}
                      mb={8}
                      bg="$color1"
                      borderColor="$borderColor"
                    />
                    <YStack space="$2" height={200}>
                      <ScrollView showsVerticalScrollIndicator={false}>
                        {/* Selected users at the top */}
                        {getFilteredUsers()
                          .filter(user => selectedParticipants.includes(user.id))
                          .map((user) => (
                            <TouchableOpacity
                              key={user.id}
                              onPress={() => toggleParticipant(user.id)}
                              disabled={loadingUsers}
                            >
                              <Card
                                p={8}
                                bg="$color9"
                                borderWidth={1}
                                borderColor="$color9"
                                borderRadius="$2"
                                mb={2}
                              >
                                <Text
                                  fontSize={13}
                                  fontWeight="500"
                                  color="$color1"
                                >
                                  {user.Name}
                                </Text>
                                <Text
                                  fontSize={11}
                                  color="$color1"
                                  mt={1}
                                >
                                  {user.Email}
                                </Text>
                              </Card>
                            </TouchableOpacity>
                          ))}
                        
                        {/* Unselected users below */}
                        {getFilteredUsers()
                          .filter(user => !selectedParticipants.includes(user.id))
                          .map((user) => (
                            <TouchableOpacity
                              key={user.id}
                              onPress={() => toggleParticipant(user.id)}
                              disabled={loadingUsers}
                            >
                              <Card
                                p={8}
                                bg="$color1"
                                borderWidth={1}
                                borderColor="$borderColor"
                                borderRadius="$2"
                                mb={2}
                              >
                                <Text
                                  fontSize={13}
                                  fontWeight="500"
                                  color="$color"
                                >
                                  {user.Name}
                                </Text>
                                <Text
                                  fontSize={11}
                                  color="$color10"
                                  mt={1}
                                >
                                  {user.Email}
                                </Text>
                              </Card>
                            </TouchableOpacity>
                          ))}
                        
                        {getFilteredUsers().length === 0 && !loadingUsers && (
                          <Card p={16} bg="$color3" borderRadius="$2">
                            <Text color="$color10" fontSize={14} style={{ textAlign: 'center' }}>
                              {userSearchQuery ? 'No users found matching your search' : 'No users available'}
                            </Text>
                          </Card>
                        )}
                        {loadingUsers && (
                          <Card p={16} bg="$color3" borderRadius="$2">
                            <Text color="$color10" fontSize={14} style={{ textAlign: 'center' }}>
                              Loading users...
                            </Text>
                          </Card>
                        )}
                      </ScrollView>
                    </YStack>
                    <FieldError message={errors.participants} />
                  </FormGroup>

                  {/* Participants Summary */}
                  <FormGroup>
                    <Label style={{ fontSize: 16, fontWeight: '500' }} mb={4}>
                      Participants Summary
                    </Label>
                    <Card p={12} bg="$color3" borderRadius="$2">
                      {(() => {
                        const selectedGroupData = selectedGroup ? groups.find(g => g.id === selectedGroup) : null;
                        const groupMemberCount = selectedGroupData ? selectedGroupData.MemberIds.length : 0;
                        const individualCount = selectedParticipants.length + (!selectedGroup && !selectedParticipants.includes(userId) ? 1 : 0);
                        const totalParticipants = groupMemberCount + individualCount;
                        
                        return (
                          <>
                            <Text fontSize={14} fontWeight="500" mb={4}>
                              Total Participants: {totalParticipants}
                            </Text>
                            <Text fontSize={12} color="$color10">
                              Group: {selectedGroup ? `${selectedGroupData?.Name} (${groupMemberCount} members)` : 'No'} | Individuals: {individualCount}
                              {!selectedGroup && !selectedParticipants.includes(userId) && ' (including you)'}
                            </Text>

                            {totalParticipants < 2 && (
                              <Text fontSize={12} color="#EF4444" mt={4}>
                                ⚠️ Minimum 2 participants required
                              </Text>
                            )}
                          </>
                        );
                      })()}
                    </Card>
                  </FormGroup>

                  {/* Actions */}
                  <XStack flexDirection="row" justify="space-between" mt={12}>
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
