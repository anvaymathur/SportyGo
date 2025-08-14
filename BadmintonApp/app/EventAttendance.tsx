import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getEvent, getVoteCounts, getUserVote, getAllUserProfiles, updateAttendance } from '../firebase/services_firestore2';
import { useAuth0 } from 'react-native-auth0';
import { UserDoc } from '../firebase/types_index';

interface AttendanceRecord {
  userId: string;
  userName: string;
  userEmail: string;
  votedStatus: 'going' | 'maybe' | 'not' | null;
  hasArrived: boolean;
  arrivalTime?: Date;
}

export default function EventAttendance() {
  const params = useLocalSearchParams();
  const eventId = params.eventId as string;
  const { user } = useAuth0();
  const userId = user?.sub || 'default-user';

  const [eventData, setEventData] = useState<any>(null);
  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const fetchEventData = async () => {
      if (!eventId) return;
      
      try {
        setLoading(true);
        const data = await getEvent(eventId);
        if (data) {
          setEventData(data);
          // Check if current user is the event creator (admin)
          setIsAdmin(data.CreatorID === userId);
        } else {
          Alert.alert('Error', 'Event not found');
          router.back();
        }
      } catch (error) {
        console.error('Error fetching event:', error);
        Alert.alert('Error', 'Failed to load event');
        router.back();
      } finally {
        setLoading(false);
      }
    };

    fetchEventData();
  }, [eventId, userId]);

  useEffect(() => {
    const fetchAttendanceData = async () => {
      if (!eventData || !isAdmin) return;

      try {
        // Get all users who voted 'going' or 'maybe'
        const [voteCounts, allUsers] = await Promise.all([
          getVoteCounts(eventId),
          getAllUserProfiles()
        ]);

        const attendanceRecords: AttendanceRecord[] = [];

        // Get individual votes for each user
        for (const user of allUsers) {
          try {
            const userVote = await getUserVote(eventId, user.id);
            if (userVote === 'going' || userVote === 'maybe') {
              attendanceRecords.push({
                userId: user.id,
                userName: user.Name,
                userEmail: user.Email,
                votedStatus: userVote,
                hasArrived: false, // Will be loaded from attendance data
              });
            }
          } catch (error) {
            console.error(`Error fetching vote for user ${user.id}:`, error);
          }
        }

        setAttendanceList(attendanceRecords);
      } catch (error) {
        console.error('Error fetching attendance data:', error);
        Alert.alert('Error', 'Failed to load attendance data');
      }
    };

    fetchAttendanceData();
  }, [eventData, isAdmin, eventId]);

  const toggleAttendance = (userId: string) => {
    setAttendanceList(prev => 
      prev.map(record => 
        record.userId === userId 
          ? { 
              ...record, 
              hasArrived: !record.hasArrived,
              arrivalTime: !record.hasArrived ? new Date() : undefined
            }
          : record
      )
    );
  };

  const saveAttendance = async () => {
    if (!eventId) return;

    try {
      setSaving(true);
      await updateAttendance(eventId, attendanceList);
      Alert.alert('Success', 'Attendance saved successfully');
    } catch (error) {
      console.error('Error saving attendance:', error);
      Alert.alert('Error', 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const getArrivedCount = () => {
    return attendanceList.filter(record => record.hasArrived).length;
  };

  const getTotalExpected = () => {
    return attendanceList.length;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading attendance...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Access Denied</Text>
          <Text style={styles.errorSubtext}>Only the event creator can manage attendance</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Event Attendance</Text>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Event Info */}
        <View style={styles.eventCard}>
          <Text style={styles.eventTitle}>{eventData?.Title}</Text>
          <Text style={styles.eventDate}>
            {eventData?.EventDate ? 
              new Date(eventData.EventDate.seconds ? eventData.EventDate.seconds * 1000 : eventData.EventDate).toLocaleString() 
              : 'Date not set'
            }
          </Text>
          <Text style={styles.eventLocation}>
            {typeof eventData?.Location === 'string' ? eventData.Location : 'Location not specified'}
          </Text>
        </View>

        {/* Attendance Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Attendance Summary</Text>
          <View style={styles.summaryStats}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{getArrivedCount()}</Text>
              <Text style={styles.statLabel}>Arrived</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{getTotalExpected() - getArrivedCount()}</Text>
              <Text style={styles.statLabel}>Not Arrived</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{getTotalExpected()}</Text>
              <Text style={styles.statLabel}>Total Expected</Text>
            </View>
          </View>
        </View>

        {/* Attendance List */}
        <View style={styles.attendanceCard}>
          <Text style={styles.attendanceTitle}>Mark Attendance</Text>
          {attendanceList.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No attendees found</Text>
              <Text style={styles.emptyStateSubtext}>Users who voted 'going' or 'maybe' will appear here</Text>
            </View>
          ) : (
            attendanceList.map((record) => (
              <TouchableOpacity
                key={record.userId}
                style={[styles.attendeeItem, record.hasArrived && styles.attendeeItemArrived]}
                onPress={() => toggleAttendance(record.userId)}
                activeOpacity={0.7}
              >
                <View style={styles.attendeeInfo}>
                  <Text style={styles.attendeeName}>{record.userName}</Text>
                  <Text style={styles.attendeeEmail}>{record.userEmail}</Text>
                  <View style={styles.voteStatus}>
                    <Text style={styles.voteStatusText}>
                      Voted: {record.votedStatus === 'going' ? 'Going' : 'Maybe'}
                    </Text>
                  </View>
                </View>
                <View style={styles.attendanceStatus}>
                  <View style={[
                    styles.statusIndicator,
                    record.hasArrived ? styles.statusArrived : styles.statusNotArrived
                  ]}>
                    <Text style={styles.statusText}>
                      {record.hasArrived ? '✓' : '○'}
                    </Text>
                  </View>
                  {record.hasArrived && record.arrivalTime && (
                    <Text style={styles.arrivalTime}>
                      {record.arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={saveAttendance}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save Attendance'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    paddingVertical: 8,
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007bff',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  container: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  eventCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  eventTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  eventDate: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  eventLocation: {
    fontSize: 16,
    color: '#666',
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007bff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  attendanceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  attendanceTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  attendeeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f8f9fa',
  },
  attendeeItemArrived: {
    backgroundColor: '#d4edda',
  },
  attendeeInfo: {
    flex: 1,
  },
  attendeeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  attendeeEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  voteStatus: {
    alignSelf: 'flex-start',
  },
  voteStatusText: {
    fontSize: 12,
    color: '#007bff',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  attendanceStatus: {
    alignItems: 'center',
    marginLeft: 12,
  },
  statusIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusArrived: {
    backgroundColor: '#28a745',
  },
  statusNotArrived: {
    backgroundColor: '#e9ecef',
    borderWidth: 2,
    borderColor: '#dee2e6',
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  arrivalTime: {
    fontSize: 12,
    color: '#666',
  },
  saveButton: {
    backgroundColor: '#007bff',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 32,
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});
