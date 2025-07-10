import React, { useState } from 'react';
import { View, Text, TextInput, Button, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';

const GROUPS = [
  'Basketball Club',
  'Chess Club',
  'Gaming Group',
  'Soccer Team',
  'Board Game Society',
  'Esports Club',
  'Tennis Club',
  'Volleyball Group',
];

type FormErrors = {
  gameDate?: string;
  gameTime?: string;
  location?: string;
  votingCutoff?: string;
  group?: string;
};

export default function CreateGameSession() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // State for form fields
  const [gameDate, setGameDate] = useState(tomorrow);
  const [showGameDate, setShowGameDate] = useState(false);
  const [gameTime, setGameTime] = useState(new Date());
  const [showGameTime, setShowGameTime] = useState(false);
  const [location, setLocation] = useState('');
  const [votingCutoff, setVotingCutoff] = useState(today);
  const [showVotingCutoff, setShowVotingCutoff] = useState(false);
  const [group, setGroup] = useState('');

  // State for errors
  const [errors, setErrors] = useState<FormErrors>({});
  // State for success
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Validation helpers
  const validate = () => {
    const newErrors: FormErrors = {};
    if (!gameDate || gameDate < new Date(today.setHours(0,0,0,0))) {
      newErrors.gameDate = 'Game date cannot be in the past';
    }
    if (!gameTime) {
      newErrors.gameTime = 'Game time is required';
    }
    if (!location || location.trim().length < 3) {
      newErrors.location = 'Location must be at least 3 characters';
    }
    if (!votingCutoff || votingCutoff < new Date(today.setHours(0,0,0,0))) {
      newErrors.votingCutoff = 'Voting cutoff cannot be in the past';
    }
    if (votingCutoff > gameDate) {
      newErrors.votingCutoff = 'Voting cutoff must be before or on the game date';
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
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
    }, 1000);
  };

  const handleCancel = () => {
    Alert.alert('Cancel', 'Are you sure you want to cancel? All entered data will be lost.', [
      { text: 'No' },
      { text: 'Yes', onPress: resetForm },
    ]);
  };

  const resetForm = () => {
    setGameDate(tomorrow);
    setGameTime(new Date());
    setLocation('');
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

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.header}>Create New Game Session</Text>
        <Text style={styles.subtitle}>Set up a new game session for your group</Text>
      </View>
      {!success ? (
        <View style={styles.form}>
          {/* Game Date */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Game Date</Text>
            <TouchableOpacity onPress={() => setShowGameDate(true)} style={styles.inputTouchable}>
              <Text style={styles.inputText}>{gameDate ? gameDate.toISOString().split('T')[0] : 'Select date'}</Text>
            </TouchableOpacity>
            {showGameDate && (
              <DateTimePicker
                value={gameDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={today}
                onChange={onChangeGameDate}
              />
            )}
            {errors.gameDate && <Text style={styles.error}>{errors.gameDate}</Text>}
          </View>

          {/* Game Time */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Game Time</Text>
            <TouchableOpacity onPress={() => setShowGameTime(true)} style={styles.inputTouchable}>
              <Text style={styles.inputText}>{gameTime ? gameTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Select time'}</Text>
            </TouchableOpacity>
            {showGameTime && (
              <DateTimePicker
                value={gameTime}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onChangeGameTime}
              />
            )}
            {errors.gameTime && <Text style={styles.error}>{errors.gameTime}</Text>}
          </View>

          {/* Location */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={[styles.input, errors.location && styles.inputError]}
              value={location}
              onChangeText={setLocation}
              placeholder="Enter game location"
              autoCapitalize="words"
            />
            {errors.location && <Text style={styles.error}>{errors.location}</Text>}
          </View>

          {/* Voting Cutoff */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Voting closes on:</Text>
            <TouchableOpacity onPress={() => setShowVotingCutoff(true)} style={styles.inputTouchable}>
              <Text style={styles.inputText}>{votingCutoff ? votingCutoff.toISOString().split('T')[0] : 'Select date'}</Text>
            </TouchableOpacity>
            {showVotingCutoff && (
              <DateTimePicker
                value={votingCutoff}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={today}
                onChange={onChangeVotingCutoff}
              />
            )}
            {errors.votingCutoff && <Text style={styles.error}>{errors.votingCutoff}</Text>}
          </View>

          {/* Group */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Group</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={group}
                onValueChange={setGroup}
                style={styles.picker}
              >
                <Picker.Item label="Select a group" value="" />
                {GROUPS.map(g => (
                  <Picker.Item label={g} value={g} />
                ))}
              </Picker>
            </View>
            {errors.group && <Text style={styles.error}>{errors.group}</Text>}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.button, styles.secondary]} onPress={handleCancel} disabled={loading}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.primary, loading && styles.buttonLoading]} onPress={handleSubmit} disabled={loading}>
              <Text style={styles.buttonText}>{loading ? 'Creating...' : 'Create Session'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.successMessage}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.successHeader}>Game Session Created Successfully!</Text>
          <Text style={styles.successText}>Your game session has been created and participants will be notified.</Text>
          <View style={styles.successActions}>
            <TouchableOpacity style={[styles.button, styles.secondary]} onPress={handleCreateAnother}>
              <Text style={styles.buttonText}>Create Another Session</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.primary]} onPress={handleViewSessions}>
              <Text style={styles.buttonText}>View All Sessions</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  headerContainer: {
    padding: 24,
    paddingBottom: 16,
  },
  backButton: {
    marginBottom: 16,
    paddingVertical: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007bff',
    fontWeight: '600',
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  form: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  formGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#e74c3c',
  },
  error: {
    color: '#e74c3c',
    fontSize: 13,
    marginTop: 2,
  },
  inputTouchable: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 10,
    backgroundColor: '#fff',
  },
  inputText: {
    fontSize: 16,
    color: '#333',
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  picker: {
    height: 44,
    width: '100%',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  primary: {
    backgroundColor: '#007bff',
  },
  secondary: {
    backgroundColor: '#f1f1f1',
  },
  buttonText: {
    color: '#222',
    fontWeight: 'bold',
    fontSize: 16,
  },
  buttonLoading: {
    opacity: 0.7,
  },
  successMessage: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  successIcon: {
    fontSize: 48,
    color: '#27ae60',
    marginBottom: 12,
  },
  successHeader: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  successText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 24,
    textAlign: 'center',
  },
  successActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
}); 