/**
 * @fileoverview Edit Event screen
 *
 * Lets an event's organiser change its details (title, date and time, location, cost, RSVP
 * cutoff) until the event starts. Who is invited is not changed here.
 *
 * @route /(tabs)/events/EditEvent?eventId=...
 */
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Switch } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth0 } from 'react-native-auth0';
import { YStack, XStack, Button, Input, Text, Card, ScrollView, Spinner } from 'tamagui';
import { SafeAreaWrapper } from '@/components/SafeAreaWrapper';
import { ScreenHeader } from '@/components/ScreenHeader';
import { getEvent, updateEvent, hasEventStarted, toDate } from '../../../firebase/services_firestore2';
import { EventDetailsErrors, toEventUpdates, validateEventDetails } from '@/utils/eventForm';

type PickerField = 'date' | 'time' | 'cutoff' | null;

export default function EditEvent() {
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();
  const { user } = useAuth0();
  const userId = user?.sub ?? '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [errors, setErrors] = useState<EventDetailsErrors>({});
  const [picker, setPicker] = useState<PickerField>(null);

  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState(new Date());
  const [location, setLocation] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [votingEnabled, setVotingEnabled] = useState(true);
  const [votingCutoff, setVotingCutoff] = useState(new Date());

  useEffect(() => {
    let cancelled = false;
    const leave = (message: string) => {
      Alert.alert("Can't edit this event", message);
      router.back();
    };
    (async () => {
      if (!eventId) return leave('The event could not be found.');
      try {
        const event = await getEvent(eventId);
        if (cancelled) return;
        if (!event) return leave('The event could not be found.');
        if (event.CreatorID !== userId) return leave('Only the organiser can edit an event.');
        if (hasEventStarted(event.EventDate)) return leave('This event has already started.');

        const date = toDate(event.EventDate);
        const votingOn = event.VotingEnabled !== false;
        const cutoff = event.CutoffDate ? toDate(event.CutoffDate) : date;
        setTitle(event.Title ?? '');
        setEventDate(date);
        setLocation(event.Location ?? '');
        setTotalCost(event.TotalCost ? String(event.TotalCost) : '');
        setVotingEnabled(votingOn);
        // Events saved with voting off carry a placeholder cutoff; start from the event date instead
        setVotingCutoff(votingOn && cutoff.getFullYear() > 1970 ? cutoff : date);
        setLoading(false);
      } catch (error) {
        console.error('Error loading event:', error);
        if (!cancelled) leave('The event could not be loaded. Check your connection and try again.');
      }
    })();
    return () => { cancelled = true; };
  }, [eventId, userId]);

  const onPick = (field: Exclude<PickerField, null>) => (_event: unknown, selected?: Date) => {
    // Android closes its dialog itself; iOS shows an inline spinner until "Done"
    if (Platform.OS !== 'ios') setPicker(null);
    if (!selected) return;
    if (field === 'cutoff') {
      setVotingCutoff(selected);
      return;
    }
    const next = new Date(eventDate);
    if (field === 'date') next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    else next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    setEventDate(next);
  };

  const handleSave = async () => {
    if (!eventId || savingRef.current) return;
    const input = { title, eventDate, location, totalCost, votingEnabled, votingCutoff };
    const found = validateEventDetails(input);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    savingRef.current = true;
    setSaving(true);
    try {
      await updateEvent(eventId, toEventUpdates(input));
      router.back();
    } catch (error) {
      console.error('Error updating event:', error);
      Alert.alert("Couldn't save", 'Your changes were not saved. Please try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaWrapper>
        <ScreenHeader title="Edit event" onBack={() => router.back()} />
        <YStack flex={1} justify="center" items="center" gap="$2">
          <Spinner size="large" color="$color9" />
          <Text color="$color10">Loading event…</Text>
        </YStack>
      </SafeAreaWrapper>
    );
  }

  const fieldLabel = (text: string) => <Text color="$color" fontSize="$4" fontWeight="600">{text}</Text>;
  const fieldError = (message?: string) => (message ? <Text color="$danger" fontSize="$3">{message}</Text> : null);
  const pickerButton = (field: Exclude<PickerField, null>, text: string) => (
    <Button
      flex={1}
      bg="$color2"
      borderColor={picker === field ? '$color9' : '$color6'}
      borderWidth={1}
      justify="flex-start"
      onPress={() => setPicker(picker === field ? null : field)}
    >
      <Text color="$color">{text}</Text>
    </Button>
  );
  const renderPicker = (field: Exclude<PickerField, null>, value: Date, mode: 'date' | 'time', maximumDate?: Date) =>
    picker === field ? (
      <YStack>
        <DateTimePicker
          value={value}
          mode={mode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={mode === 'date' ? new Date() : undefined}
          maximumDate={maximumDate}
          onChange={onPick(field)}
        />
        {Platform.OS === 'ios' ? (
          <Button size="$3" self="flex-end" bg="$color9" color="$color1" onPress={() => setPicker(null)}>Done</Button>
        ) : null}
      </YStack>
    ) : null;

  return (
    <SafeAreaWrapper>
      <ScreenHeader title="Edit event" onBack={() => router.back()} />
      <ScrollView flex={1} keyboardShouldPersistTaps="handled">
        <YStack p="$4" gap="$4">
          <Card p="$4" bg="$color1" borderColor="$borderColor" borderWidth={1}>
            <YStack gap="$4">
              <YStack gap="$2">
                {fieldLabel('Event title')}
                <Input
                  value={title}
                  onChangeText={(text: any) => setTitle(text)}
                  placeholder="Event title"
                  maxLength={100}
                  bg="$color2"
                  color="$color"
                  placeholderTextColor="$color10"
                  borderColor={errors.title ? '$danger' : '$color6'}
                />
                {fieldError(errors.title)}
              </YStack>

              <YStack gap="$2">
                {fieldLabel('Date and time')}
                <XStack gap="$2">
                  {pickerButton('date', eventDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }))}
                  {pickerButton('time', eventDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))}
                </XStack>
                {renderPicker('date', eventDate, 'date')}
                {renderPicker('time', eventDate, 'time')}
                {fieldError(errors.eventDate)}
              </YStack>

              <YStack gap="$2">
                {fieldLabel('Location')}
                <Input
                  value={location}
                  onChangeText={(text: any) => setLocation(text)}
                  placeholder="Where is it?"
                  maxLength={200}
                  bg="$color2"
                  color="$color"
                  placeholderTextColor="$color10"
                  borderColor={errors.location ? '$danger' : '$color6'}
                />
                {fieldError(errors.location)}
              </YStack>

              <YStack gap="$2">
                {fieldLabel('Total cost (optional)')}
                <Input
                  value={totalCost}
                  onChangeText={(text: any) => setTotalCost(String(text).replace(/[^0-9.]/g, ''))}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  bg="$color2"
                  color="$color"
                  placeholderTextColor="$color10"
                  borderColor={errors.totalCost ? '$danger' : '$color6'}
                />
                {fieldError(errors.totalCost)}
              </YStack>
            </YStack>
          </Card>

          <Card p="$4" bg="$color1" borderColor="$borderColor" borderWidth={1}>
            <YStack gap="$3">
              <XStack justify="space-between" items="center">
                <YStack flex={1} pr="$3">
                  {fieldLabel('RSVPs')}
                  <Text color="$color10" fontSize="$3">Let people say whether they&apos;re going.</Text>
                </YStack>
                <Switch
                  value={votingEnabled}
                  onValueChange={setVotingEnabled}
                  accessibilityLabel="Allow RSVPs"
                  trackColor={{ true: '#065F46' }}
                />
              </XStack>
              {votingEnabled ? (
                <YStack gap="$2">
                  <Text color="$color10" fontSize="$3">RSVP by the end of</Text>
                  <XStack>{pickerButton('cutoff', votingCutoff.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }))}</XStack>
                  {renderPicker('cutoff', votingCutoff, 'date', eventDate)}
                  {fieldError(errors.votingCutoff)}
                </YStack>
              ) : null}
            </YStack>
          </Card>

          <Text color="$color10" fontSize="$3">
            Changing who is invited isn&apos;t supported yet. Existing RSVPs are kept.
          </Text>

          <Button size="$5" bg="$color9" color="$color1" borderWidth={0} onPress={handleSave} disabled={saving} opacity={saving ? 0.6 : 1}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </YStack>
      </ScrollView>
    </SafeAreaWrapper>
  );
}
