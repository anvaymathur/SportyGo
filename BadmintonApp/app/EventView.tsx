import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Animated, SafeAreaView, Dimensions } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useLocalSearchParams, router } from 'expo-router';

type Attendee = {
  id: number;
  name: string;
  response: 'Going' | 'Maybe' | 'Not Going';
  avatar: string;
};

type EventData = {
  event: {
    title: string;
    date: string;
    time: string;
    location: string;
    description: string;
    votingCutoff: string;
    group: string;
  };
  attendees: Attendee[];
  currentUser: {
    id: number;
    name: string;
    response: 'Going' | 'Maybe' | 'Not Going' | null;
  };
};

// Mock data for different events
const MOCK_EVENTS_DATA: { [key: number]: EventData } = {
  1: {
    event: {
      title: "Weekly Basketball Game",
      date: "Saturday, July 12, 2025",
      time: "3:00 PM - 5:00 PM",
      location: "Community Sports Center",
      description: "Join us for our weekly basketball game! All skill levels welcome. Bring your own water bottle and wear comfortable athletic shoes.",
      votingCutoff: "Friday, July 11, 2025 at 6:00 PM",
      group: "Basketball Club"
    },
    attendees: [
      { id: 1, name: "Alex Johnson", response: "Going", avatar: "AJ" },
      { id: 2, name: "Sarah Chen", response: "Going", avatar: "SC" },
      { id: 3, name: "Mike Rodriguez", response: "Maybe", avatar: "MR" },
      { id: 4, name: "Emily Davis", response: "Going", avatar: "ED" },
      { id: 5, name: "James Wilson", response: "Not Going", avatar: "JW" },
      { id: 6, name: "Lisa Anderson", response: "Going", avatar: "LA" },
      { id: 7, name: "David Brown", response: "Maybe", avatar: "DB" },
      { id: 8, name: "Jennifer Lee", response: "Going", avatar: "JL" },
      { id: 9, name: "Robert Taylor", response: "Not Going", avatar: "RT" },
      { id: 10, name: "Amanda White", response: "Going", avatar: "AW" }
    ],
    currentUser: {
      id: 11,
      name: "You",
      response: null
    }
  },
  2: {
    event: {
      title: "Chess Tournament",
      date: "Sunday, July 13, 2025",
      time: "2:00 PM - 6:00 PM",
      location: "Library Conference Room",
      description: "Monthly chess tournament with prizes for top players. All skill levels welcome!",
      votingCutoff: "Saturday, July 12, 2025 at 8:00 PM",
      group: "Chess Club"
    },
    attendees: [
      { id: 1, name: "Michael Chen", response: "Going", avatar: "MC" },
      { id: 2, name: "Emma Wilson", response: "Going", avatar: "EW" },
      { id: 3, name: "David Kim", response: "Maybe", avatar: "DK" },
      { id: 4, name: "Sophie Brown", response: "Going", avatar: "SB" },
      { id: 5, name: "Alex Rodriguez", response: "Not Going", avatar: "AR" },
      { id: 6, name: "Maria Garcia", response: "Going", avatar: "MG" }
    ],
    currentUser: {
      id: 7,
      name: "You",
      response: null
    }
  },
  3: {
    event: {
      title: "Gaming Night",
      date: "Friday, July 18, 2025",
      time: "7:00 PM - 11:00 PM",
      location: "Student Union",
      description: "Multiplayer gaming night featuring popular games. Bring your own controllers!",
      votingCutoff: "Thursday, July 17, 2025 at 9:00 PM",
      group: "Gaming Group"
    },
    attendees: [
      { id: 1, name: "Jake Smith", response: "Going", avatar: "JS" },
      { id: 2, name: "Rachel Green", response: "Going", avatar: "RG" },
      { id: 3, name: "Tom Anderson", response: "Maybe", avatar: "TA" },
      { id: 4, name: "Lisa Park", response: "Going", avatar: "LP" },
      { id: 5, name: "Chris Johnson", response: "Going", avatar: "CJ" },
      { id: 6, name: "Sarah Miller", response: "Maybe", avatar: "SM" },
      { id: 7, name: "Mike Davis", response: "Going", avatar: "MD" },
      { id: 8, name: "Emma Taylor", response: "Going", avatar: "ET" },
      { id: 9, name: "David Wilson", response: "Going", avatar: "DW" },
      { id: 10, name: "Anna Lee", response: "Maybe", avatar: "AL" },
      { id: 11, name: "James Brown", response: "Going", avatar: "JB" },
      { id: 12, name: "Sophie Chen", response: "Going", avatar: "SC" },
      { id: 13, name: "Alex Kim", response: "Maybe", avatar: "AK" },
      { id: 14, name: "Maria Rodriguez", response: "Going", avatar: "MR" },
      { id: 15, name: "Chris Garcia", response: "Going", avatar: "CG" }
    ],
    currentUser: {
      id: 16,
      name: "You",
      response: null
    }
  },
  4: {
    event: {
      title: "Soccer Practice",
      date: "Tuesday, July 15, 2025",
      time: "6:00 PM - 8:00 PM",
      location: "University Soccer Field",
      description: "Regular team practice session. Focus on drills and team coordination.",
      votingCutoff: "Monday, July 14, 2025 at 6:00 PM",
      group: "Soccer Team"
    },
    attendees: [
      { id: 1, name: "Carlos Mendez", response: "Going", avatar: "CM" },
      { id: 2, name: "Isabella Silva", response: "Going", avatar: "IS" },
      { id: 3, name: "Lucas Santos", response: "Going", avatar: "LS" },
      { id: 4, name: "Sofia Costa", response: "Maybe", avatar: "SC" },
      { id: 5, name: "Diego Oliveira", response: "Going", avatar: "DO" },
      { id: 6, name: "Ana Pereira", response: "Going", avatar: "AP" },
      { id: 7, name: "Rafael Lima", response: "Going", avatar: "RL" },
      { id: 8, name: "Camila Ferreira", response: "Maybe", avatar: "CF" },
      { id: 9, name: "Thiago Alves", response: "Going", avatar: "TA" },
      { id: 10, name: "Julia Martins", response: "Going", avatar: "JM" },
      { id: 11, name: "Gabriel Silva", response: "Going", avatar: "GS" },
      { id: 12, name: "Mariana Costa", response: "Going", avatar: "MC" }
    ],
    currentUser: {
      id: 13,
      name: "You",
      response: null
    }
  },
  5: {
    event: {
      title: "Board Game Night",
      date: "Wednesday, July 16, 2025",
      time: "6:30 PM - 10:30 PM",
      location: "Campus Center",
      description: "Strategy and party games for all skill levels. Snacks provided!",
      votingCutoff: "Tuesday, July 15, 2025 at 8:00 PM",
      group: "Board Game Society"
    },
    attendees: [
      { id: 1, name: "Kevin Zhang", response: "Going", avatar: "KZ" },
      { id: 2, name: "Nina Patel", response: "Maybe", avatar: "NP" },
      { id: 3, name: "Ryan Thompson", response: "Going", avatar: "RT" },
      { id: 4, name: "Zoe Williams", response: "Maybe", avatar: "ZW" },
      { id: 5, name: "Marcus Johnson", response: "Going", avatar: "MJ" },
      { id: 6, name: "Aisha Khan", response: "Going", avatar: "AK" }
    ],
    currentUser: {
      id: 7,
      name: "You",
      response: null
    }
  }
};

export default function EventView() {
  const params = useLocalSearchParams();
  const eventId = parseInt(params.eventId as string) || 1;
  
  const [eventData, setEventData] = useState<EventData>(MOCK_EVENTS_DATA[eventId] || MOCK_EVENTS_DATA[1]);
  const [currentFilter, setCurrentFilter] = useState<'all' | 'Going' | 'Maybe' | 'Not Going'>('all');
  const [isVotingOpen, setIsVotingOpen] = useState(true);
  const [countdown, setCountdown] = useState('');
  const [userVoteStatus, setUserVoteStatus] = useState('Select your response above');
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Countdown timer effect
  useEffect(() => {
    const votingCutoff = new Date('2025-07-11T18:00:00');
    
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
  }, []);

  const getVoteCounts = () => {
    const counts = { 'Going': 0, 'Maybe': 0, 'Not Going': 0 };
    eventData.attendees.forEach((attendee: Attendee) => {
      counts[attendee.response]++;
    });
    return counts;
  };

  const handleVote = (vote: 'Going' | 'Maybe' | 'Not Going') => {
    if (!isVotingOpen) {
      Alert.alert('Voting Closed', 'Voting has closed for this event.');
      return;
    }

    const previousVote = eventData.currentUser.response;
    const newEventData = { ...eventData };
    
    // Update current user's vote
    newEventData.currentUser.response = vote;
    
    // Add or update user in attendees list
    const userIndex = newEventData.attendees.findIndex((a: Attendee) => a.id === newEventData.currentUser.id);
    if (userIndex === -1) {
      newEventData.attendees.push({
        id: newEventData.currentUser.id,
        name: newEventData.currentUser.name,
        response: vote,
        avatar: "YU"
      });
    } else {
      newEventData.attendees[userIndex].response = vote;
    }
    
    setEventData(newEventData);
    setUserVoteStatus(`You voted: ${vote}`);
    
    // Animate the vote count
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.2, duration: 150, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true })
    ]).start();
  };

  const getResponseIcon = (response: string) => {
    const icons = { 'Going': '✓', 'Maybe': '?', 'Not Going': '✗' };
    return icons[response as keyof typeof icons] || '';
  };

  const getFilteredAttendees = () => {
    let filtered = eventData.attendees;
    if (currentFilter !== 'all') {
      filtered = eventData.attendees.filter((attendee: Attendee) => attendee.response === currentFilter);
    }
    
    // Sort: Going first, then Maybe, then Not Going
    const sortOrder = { 'Going': 1, 'Maybe': 2, 'Not Going': 3 };
    return filtered.sort((a: Attendee, b: Attendee) => sortOrder[a.response] - sortOrder[b.response]);
  };

  const counts = getVoteCounts();
  const filteredAttendees = getFilteredAttendees();

  const { width } = Dimensions.get('window');
  const isSmallScreen = width < 375;

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
        <View style={styles.eventBadge}>
          <Text style={styles.eventBadgeText}>{eventData.event.group}</Text>
        </View>
        <Text style={styles.eventTitle}>{eventData.event.title}</Text>
        <Text style={styles.eventDescription}>{eventData.event.description}</Text>
        
        <View style={styles.eventDetails}>
          <View style={styles.eventDetail}>
            <Text style={styles.eventDetailIcon}>📅</Text>
            <View style={styles.eventDetailContent}>
              <Text style={styles.eventDetailLabel}>Date & Time</Text>
              <Text style={styles.eventDetailValue}>{eventData.event.date}</Text>
              <Text style={styles.eventDetailSub}>{eventData.event.time}</Text>
            </View>
          </View>
          
          <View style={styles.eventDetail}>
            <Text style={styles.eventDetailIcon}>📍</Text>
            <View style={styles.eventDetailContent}>
              <Text style={styles.eventDetailLabel}>Location</Text>
              <Text style={styles.eventDetailValue}>{eventData.event.location}</Text>
            </View>
          </View>
          
          <View style={styles.eventDetail}>
            <Text style={styles.eventDetailIcon}>⏰</Text>
            <View style={styles.eventDetailContent}>
              <Text style={styles.eventDetailLabel}>Voting Closes</Text>
              <Text style={styles.eventDetailValue}>{eventData.event.votingCutoff}</Text>
              <Text style={[styles.eventDetailCountdown, !isVotingOpen && styles.countdownClosed]}>
                {countdown}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Voting Section */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Will you be attending?</Text>
        <View style={styles.votingStatus}>
          <Text style={[styles.status, isVotingOpen ? styles.statusSuccess : styles.statusError]}>
            {isVotingOpen ? 'Voting Open' : 'Voting Closed'}
          </Text>
        </View>
        
        <View style={styles.votingButtons}>
          <TouchableOpacity 
            style={[styles.voteBtn, styles.voteBtnGoing, eventData.currentUser.response === 'Going' && styles.voteBtnActive]}
            onPress={() => handleVote('Going')}
            disabled={!isVotingOpen}
          >
            <Text style={styles.voteBtnIcon}>✓</Text>
            <Text style={styles.voteBtnLabel}>Going</Text>
            <Animated.Text style={[styles.voteBtnCount, { transform: [{ scale: scaleAnim }] }]}>
              {counts.Going}
            </Animated.Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.voteBtn, styles.voteBtnMaybe, eventData.currentUser.response === 'Maybe' && styles.voteBtnActive]}
            onPress={() => handleVote('Maybe')}
            disabled={!isVotingOpen}
          >
            <Text style={styles.voteBtnIcon}>?</Text>
            <Text style={styles.voteBtnLabel}>Maybe</Text>
            <Animated.Text style={[styles.voteBtnCount, { transform: [{ scale: scaleAnim }] }]}>
              {counts.Maybe}
            </Animated.Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.voteBtn, styles.voteBtnNotGoing, eventData.currentUser.response === 'Not Going' && styles.voteBtnActive]}
            onPress={() => handleVote('Not Going')}
            disabled={!isVotingOpen}
          >
            <Text style={styles.voteBtnIcon}>✗</Text>
            <Text style={styles.voteBtnLabel}>Not Going</Text>
            <Animated.Text style={[styles.voteBtnCount, { transform: [{ scale: scaleAnim }] }]}>
              {counts['Not Going']}
            </Animated.Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.userVoteStatus}>
          <Text style={styles.userVoteText}>{userVoteStatus}</Text>
        </View>
      </View>

      {/* Attendees Section */}
      <View style={styles.card}>
        <View style={styles.attendeesHeader}>
          <Text style={styles.sectionTitle}>Attendees</Text>
          <Text style={styles.attendeeCount}>{eventData.attendees.length} responses</Text>
        </View>
        
        <View style={styles.attendeeFilters}>
          <TouchableOpacity 
            style={[styles.filterBtn, currentFilter === 'all' && styles.filterBtnActive]}
            onPress={() => setCurrentFilter('all')}
          >
            <Text style={styles.filterBtnText}>All</Text>
            <Text style={styles.filterCount}>{eventData.attendees.length}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.filterBtn, currentFilter === 'Going' && styles.filterBtnActive]}
            onPress={() => setCurrentFilter('Going')}
          >
            <Text style={styles.filterBtnText}>Going</Text>
            <Text style={styles.filterCount}>{counts.Going}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.filterBtn, currentFilter === 'Maybe' && styles.filterBtnActive]}
            onPress={() => setCurrentFilter('Maybe')}
          >
            <Text style={styles.filterBtnText}>Maybe</Text>
            <Text style={styles.filterCount}>{counts.Maybe}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.filterBtn, currentFilter === 'Not Going' && styles.filterBtnActive]}
            onPress={() => setCurrentFilter('Not Going')}
          >
            <Text style={styles.filterBtnText}>Not Going</Text>
            <Text style={styles.filterCount}>{counts['Not Going']}</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.attendeesList}>
          {filteredAttendees.map((attendee: Attendee) => (
            <View style={styles.attendeeItem}>
              <View style={styles.attendeeAvatar}>
                <Text style={styles.attendeeAvatarText}>{attendee.avatar}</Text>
              </View>
              <View style={styles.attendeeInfo}>
                <Text style={styles.attendeeName}>{attendee.name}</Text>
              </View>
              <View style={[styles.attendeeResponse, styles[`attendeeResponse${attendee.response.replace(' ', '')}` as keyof typeof styles] as any]}>
                <Text style={styles.attendeeResponseIcon}>{getResponseIcon(attendee.response)}</Text>
                <Text style={styles.attendeeResponseText}>{attendee.response}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
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
}); 