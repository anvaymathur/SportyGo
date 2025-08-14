import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Animated, SafeAreaView, Dimensions } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { castVote, listenVoteCounts, getEvent, getUserVote, hasEventStarted } from '../firebase/services_firestore2';
import { VoteDoc, VoteStatus } from '../firebase/types_index';
import { useAuth0 } from 'react-native-auth0';

export default function EventView() {
  const params = useLocalSearchParams();
  const eventId = params.eventId as string; // Use string for Firestore
  const { user } = useAuth0();
  const userId = user?.sub || 'default-user'; 
  const [eventData, setEventData] = useState<any>(null);
  const [currentFilter, setCurrentFilter] = useState<'all' | 'going' | 'maybe' | 'not'>('all');
  const [isVotingOpen, setIsVotingOpen] = useState(true);
  const [countdown, setCountdown] = useState('');
  const [userVoteStatus, setUserVoteStatus] = useState('Select your response above');
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const [voteCounts, setVoteCounts] = useState({ going: 0, maybe: 0, not: 0 });
  const [userVote, setUserVote] = useState<null | VoteStatus>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [eventStarted, setEventStarted] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    
    const fetchEventData = async () => {
      try {
        setIsLoading(true);
        const data = await getEvent(eventId);
        if (data) {
          setEventData(data);
          // Check if current user is the event creator (admin)
          setIsAdmin(data.CreatorID === userId);
          // Check if event has started
          setEventStarted(hasEventStarted(data.EventDate));
        } else {
          // Handle case where event doesn't exist
          Alert.alert('Error', 'Event not found');
          router.back();
        }
      } catch (error) {
        console.error('Error fetching event:', error);
        Alert.alert('Error', 'Failed to load event');
        router.back();
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchEventData();
  }, [eventId]);

  // Listen to vote counts
  useEffect(() => {
    if (!eventId) return;
    const unsubscribe = listenVoteCounts(eventId, (counts) => {
      setVoteCounts(counts);
    });
    return unsubscribe;
  }, [eventId]);

  // Fetch user's previous vote
  useEffect(() => {
    if (!eventId || !userId) return;
    
    const fetchUserVote = async () => {
      try {
        const previousVote = await getUserVote(eventId, userId);
        setUserVote(previousVote);
        if (previousVote) {
          setUserVoteStatus(`You voted: ${previousVote.charAt(0).toUpperCase() + previousVote.slice(1)}`);
        } else {
          setUserVoteStatus('Select your response above');
        }
      } catch (error) {
        console.error('Error fetching user vote:', error);
      }
    };
    
    fetchUserVote();
  }, [eventId, userId]);

  // Countdown timer effect
  useEffect(() => {
    if (!eventData?.CutoffDate || eventData?.VotingEnabled === false) {
      setIsVotingOpen(false);
      setCountdown('No voting');
      return;
    }
    
    const votingCutoff = new Date(eventData.CutoffDate.toDate ? eventData.CutoffDate.toDate() : eventData.CutoffDate);
    
    const updateCountdown = () => {
      const now = new Date();
      const timeLeft = votingCutoff.getTime() - now.getTime();
      
      if (timeLeft <= 0) {
        setIsVotingOpen(false);
        setCountdown('Voting Closed');
        return;
      }
      
      const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
      const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
      
      let countdownText = 'Closes in ';
      if (days > 0) {
        countdownText += `${days} day${days > 1 ? 's' : ''}, `;
      }
      countdownText += `${hours} hour${hours > 1 ? 's' : ''}`;
      
      if (days === 0 && hours < 2) {
        countdownText += `, ${minutes} minute${minutes > 1 ? 's' : ''}`;
      }
      
      setCountdown(countdownText);
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    
    return () => clearInterval(interval);
  }, [eventData]);

  const handleVote = async (vote: VoteStatus) => {
    if (!eventData?.VotingEnabled) {
      Alert.alert('Voting Disabled', 'Voting is not enabled for this event.');
      return;
    }
    
    if (!isVotingOpen) {
      Alert.alert('Voting Closed', 'Voting has closed for this event.');
      return;
    }
    
    if (!eventId) {
      Alert.alert('Error', 'Event ID is missing.');
      return;
    }
    
    try {
      await castVote(eventId, vote, userId);
      setUserVote(vote);
      setUserVoteStatus(`You voted: ${vote.charAt(0).toUpperCase() + vote.slice(1)}`);
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.2, duration: 150, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true })
      ]).start();
    } catch (error: any) {
      console.error('Error casting vote:', error);
      
      // Check if it's a time conflict error
      if (error.message && error.message.includes('conflicts with')) {
        Alert.alert('Time Conflict', error.message);
      } else {
        Alert.alert('Error', 'Failed to cast vote. Please try again.');
      }
    }
  };

  const getResponseIcon = (response: string) => {
    const icons = { 'going': '✓', 'maybe': '?', 'not': '✗' };
    return icons[response as keyof typeof icons] || '';
  };

  const getTotalResponses = () => {
    return voteCounts.going + voteCounts.maybe + voteCounts.not;
  };

  const getFilteredCount = () => {
    if (currentFilter === 'all') {
      return getTotalResponses();
    }
    return voteCounts[currentFilter] || 0;
  };

  const { width } = Dimensions.get('window');
  const isSmallScreen = width < 375;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading event...</Text>
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
      </View>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
                {/* Event Header */}
        <View style={styles.eventHeader}>
          <Text style={styles.eventTitle}>{eventData?.Title || 'Event'}</Text>
          <View style={styles.eventDetail}>
            <Text style={styles.eventDetailIcon}>📅</Text>
            <View style={styles.eventDetailContent}>
              <Text style={styles.eventDetailLabel}>Date & Time</Text>
              <Text style={styles.eventDetailValue}>
                {eventData?.EventDate ? 
                  (eventData.EventDate instanceof Date ? 
                    eventData.EventDate.toDateString() : 
                    new Date(eventData.EventDate.seconds ? eventData.EventDate.seconds * 1000 : eventData.EventDate).toDateString()
                  ) : 'Date not set'
                }
              </Text>
              <Text style={styles.eventDetailSub}>
                {eventData?.EventDate ? 
                  (eventData.EventDate instanceof Date ? 
                    eventData.EventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
                    new Date(eventData.EventDate.seconds ? eventData.EventDate.seconds * 1000 : eventData.EventDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  ) : 'Time not set'
                }
              </Text>
            </View>
          </View>
          
          <View style={styles.eventDetail}>
            <Text style={styles.eventDetailIcon}>📍</Text>
            <View style={styles.eventDetailContent}>
              <Text style={styles.eventDetailLabel}>Location</Text>
              <Text style={styles.eventDetailValue}>
                {typeof eventData?.Location === 'string' ? eventData.Location : 
                 (eventData?.Location && typeof eventData.Location === 'object' && eventData.Location._lat && eventData.Location._long) 
                   ? `${eventData.Location._lat.toFixed(6)}, ${eventData.Location._long.toFixed(6)}` 
                   : 'Location not specified'
                }
              </Text>
            </View>
          </View>
          
          <View style={styles.eventDetail}>
            <Text style={styles.eventDetailIcon}>⏰</Text>
            <View style={styles.eventDetailContent}>
              <Text style={styles.eventDetailLabel}>
                {eventData?.VotingEnabled === false ? 'Voting Status' : 'Voting Closes'}
              </Text>
              <Text style={styles.eventDetailValue}>
                {eventData?.VotingEnabled === false ? 'Voting Disabled' :
                  eventData?.CutoffDate ? 
                    (eventData.CutoffDate instanceof Date ? 
                      eventData.CutoffDate.toDateString() : 
                      new Date(eventData.CutoffDate.seconds ? eventData.CutoffDate.seconds * 1000 : eventData.CutoffDate).toDateString()
                    ) : 'Date not set'
                }
              </Text>
              {eventData?.VotingEnabled !== false && (
                <Text style={[styles.eventDetailCountdown, !isVotingOpen && styles.countdownClosed]}>
                  {countdown}
                </Text>
              )}
            </View>
          </View>
        </View>

      {/* Voting Section */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Will you be attending?</Text>
        
        {eventData?.VotingEnabled === false ? (
          <View style={styles.votingStatus}>
            <Text style={[styles.status, styles.statusError]}>
              Voting Disabled
            </Text>
            <Text style={[styles.eventDetailSub, { marginTop: 8 }]}>
              This event does not have voting enabled. Contact the event organizer for more information.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.votingStatus}>
              <Text style={[styles.status, isVotingOpen ? styles.statusSuccess : styles.statusError]}>
                {isVotingOpen ? 'Voting Open' : 'Voting Closed'}
              </Text>
            </View>
            
            <View style={styles.votingButtons}>
              <TouchableOpacity 
                style={[styles.voteBtn, styles.voteBtnGoing, userVote === 'going' && styles.voteBtnActive]}
                onPress={() => handleVote('going')}
                disabled={!isVotingOpen}
              >
                <Text style={styles.voteBtnIcon}>✓</Text>
                <Text style={styles.voteBtnLabel}>Going</Text>
                <Animated.Text style={[styles.voteBtnCount, { transform: [{ scale: scaleAnim }] }]}>
                  {voteCounts.going}
                </Animated.Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.voteBtn, styles.voteBtnMaybe, userVote === 'maybe' && styles.voteBtnActive]}
                onPress={() => handleVote('maybe')}
                disabled={!isVotingOpen}
              >
                <Text style={styles.voteBtnIcon}>?</Text>
                <Text style={styles.voteBtnLabel}>Maybe</Text>
                <Animated.Text style={[styles.voteBtnCount, { transform: [{ scale: scaleAnim }] }]}>
                  {voteCounts.maybe}
                </Animated.Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.voteBtn, styles.voteBtnNotGoing, userVote === 'not' && styles.voteBtnActive]}
                onPress={() => handleVote('not')}
                disabled={!isVotingOpen}
              >
                <Text style={styles.voteBtnIcon}>✗</Text>
                <Text style={styles.voteBtnLabel}>Not Going</Text>
                <Animated.Text style={[styles.voteBtnCount, { transform: [{ scale: scaleAnim }] }]}>
                  {voteCounts.not}
                </Animated.Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.userVoteStatus}>
              <Text style={styles.userVoteText}>{userVoteStatus}</Text>
            </View>
          </>
        )}
      </View>

             {/* Admin Attendance Section - Only show for admin when event has started */}
       {isAdmin && eventStarted && (
         <View style={styles.card}>
           <Text style={styles.sectionTitle}>Event Management</Text>
           <TouchableOpacity
             style={styles.attendanceButton}
             onPress={() => router.push({
               pathname: '/EventAttendance',
               params: { eventId: eventId }
             })}
           >
             <Text style={styles.attendanceButtonText}>📋 Manage Attendance</Text>
             <Text style={styles.attendanceButtonSubtext}>Mark who has arrived at the event</Text>
           </TouchableOpacity>
         </View>
       )}

       {/* Vote Summary Section - Only show if voting is enabled */}
       {eventData?.VotingEnabled !== false && (
         <View style={styles.card}>
           <View style={styles.attendeesHeader}>
             <Text style={styles.sectionTitle}>Vote Summary</Text>
             <Text style={styles.attendeeCount}>{getTotalResponses()} total responses</Text>
           </View>
          
          <View style={styles.attendeeFilters}>
            <TouchableOpacity 
              style={[styles.filterBtn, currentFilter === 'all' && styles.filterBtnActive]}
              onPress={() => setCurrentFilter('all')}
            >
              <Text style={styles.filterBtnText}>All</Text>
              <Text style={styles.filterCount}>{getTotalResponses()}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.filterBtn, currentFilter === 'going' && styles.filterBtnActive]}
              onPress={() => setCurrentFilter('going')}
            >
              <Text style={styles.filterBtnText}>Going</Text>
              <Text style={styles.filterCount}>{voteCounts.going}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.filterBtn, currentFilter === 'maybe' && styles.filterBtnActive]}
              onPress={() => setCurrentFilter('maybe')}
            >
              <Text style={styles.filterBtnText}>Maybe</Text>
              <Text style={styles.filterCount}>{voteCounts.maybe}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.filterBtn, currentFilter === 'not' && styles.filterBtnActive]}
              onPress={() => setCurrentFilter('not')}
            >
              <Text style={styles.filterBtnText}>Not Going</Text>
              <Text style={styles.filterCount}>{voteCounts.not}</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.voteSummary}>
            <Text style={styles.summaryText}>
              {currentFilter === 'all' 
                ? `Total responses: ${getTotalResponses()}`
                : `${currentFilter.charAt(0).toUpperCase() + currentFilter.slice(1)}: ${getFilteredCount()}`
              }
            </Text>
          </View>
        </View>
      )}
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
  },
  backButton: {
    paddingVertical: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007bff',
    fontWeight: '600',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  eventHeader: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
  },
  eventBadge: {
    backgroundColor: '#007bff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  eventBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  eventTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  eventDescription: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    marginBottom: 20,
  },
  eventDetails: {
    gap: 16,
  },
  eventDetail: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  eventDetailIcon: {
    fontSize: 20,
    marginRight: 12,
    marginTop: 2,
  },
  eventDetailContent: {
    flex: 1,
  },
  eventDetailLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  eventDetailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  eventDetailSub: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  eventDetailCountdown: {
    fontSize: 14,
    color: '#007bff',
    marginTop: 2,
  },
  countdownClosed: {
    color: '#e74c3c',
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  votingStatus: {
    marginBottom: 16,
  },
  status: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    fontSize: 14,
    fontWeight: '600',
    alignSelf: 'flex-start',
  },
  statusSuccess: {
    backgroundColor: '#d4edda',
    color: '#155724',
  },
  statusError: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
  },
  votingButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  voteBtn: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    minHeight: 80,
  },
  voteBtnActive: {
    borderColor: '#007bff',
    backgroundColor: '#f0f8ff',
  },
  voteBtnGoing: {
    borderColor: '#28a745',
  },
  voteBtnMaybe: {
    borderColor: '#ffc107',
  },
  voteBtnNotGoing: {
    borderColor: '#dc3545',
  },
  voteBtnIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  voteBtnLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  voteBtnCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007bff',
  },
  userVoteStatus: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  userVoteText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  attendeesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  attendeeCount: {
    fontSize: 14,
    color: '#666',
  },
  attendeeFilters: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minHeight: 44,
  },
  filterBtnActive: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  filterBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  filterCount: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  attendeesList: {
    gap: 12,
  },
  attendeeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  attendeeAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007bff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  attendeeAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  attendeeInfo: {
    flex: 1,
  },
  attendeeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  attendeeResponse: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  attendeeResponseGoing: {
    backgroundColor: '#d4edda',
  },
  attendeeResponseMaybe: {
    backgroundColor: '#fff3cd',
  },
  attendeeResponseNotGoing: {
    backgroundColor: '#f8d7da',
  },
  attendeeResponseIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  attendeeResponseText: {
    fontSize: 12,
    fontWeight: '600',
  },
  voteSummary: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  summaryText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
     loadingText: {
     fontSize: 16,
     color: '#666',
     textAlign: 'center',
   },
   attendanceButton: {
     backgroundColor: '#28a745',
     borderRadius: 8,
     padding: 16,
     alignItems: 'center',
     marginTop: 8,
   },
   attendanceButtonText: {
     fontSize: 16,
     fontWeight: 'bold',
     color: '#fff',
     marginBottom: 4,
   },
   attendanceButtonSubtext: {
     fontSize: 14,
     color: '#e8f5e8',
   },
 }); 
