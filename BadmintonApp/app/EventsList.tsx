import { View, Text, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView, Dimensions, TextInput } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';

type Event = {
  id: number;
  title: string;
  date: string;
  time: string;
  location: string;
  group: string;
  description: string;
  attendeeCount: number;
  votingCutoff: string;
  isVotingOpen: boolean;
};

const MOCK_EVENTS: Event[] = [
  {
    id: 1,
    title: "Weekly Basketball Game",
    date: "Saturday, July 12, 2025",
    time: "3:00 PM - 5:00 PM",
    location: "Community Sports Center",
    group: "Basketball Club",
    description: "Join us for our weekly basketball game! All skill levels welcome.",
    attendeeCount: 10,
    votingCutoff: "Friday, July 11, 2025 at 6:00 PM",
    isVotingOpen: true
  },
  {
    id: 2,
    title: "Chess Tournament",
    date: "Sunday, July 13, 2025",
    time: "2:00 PM - 6:00 PM",
    location: "Library Conference Room",
    group: "Chess Club",
    description: "Monthly chess tournament with prizes for top players.",
    attendeeCount: 8,
    votingCutoff: "Saturday, July 12, 2025 at 8:00 PM",
    isVotingOpen: true
  },
  {
    id: 3,
    title: "Gaming Night",
    date: "Friday, July 18, 2025",
    time: "7:00 PM - 11:00 PM",
    location: "Student Union",
    group: "Gaming Group",
    description: "Multiplayer gaming night featuring popular games.",
    attendeeCount: 15,
    votingCutoff: "Thursday, July 17, 2025 at 9:00 PM",
    isVotingOpen: true
  },
  {
    id: 4,
    title: "Soccer Practice",
    date: "Tuesday, July 15, 2025",
    time: "6:00 PM - 8:00 PM",
    location: "University Soccer Field",
    group: "Soccer Team",
    description: "Regular team practice session.",
    attendeeCount: 12,
    votingCutoff: "Monday, July 14, 2025 at 6:00 PM",
    isVotingOpen: false
  },
  {
    id: 5,
    title: "Board Game Night",
    date: "Wednesday, July 16, 2025",
    time: "6:30 PM - 10:30 PM",
    location: "Campus Center",
    group: "Board Game Society",
    description: "Strategy and party games for all skill levels.",
    attendeeCount: 6,
    votingCutoff: "Tuesday, July 15, 2025 at 8:00 PM",
    isVotingOpen: true
  }
];

export default function EventsList() {
  const [events, setEvents] = useState<Event[]>(MOCK_EVENTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'voting-open' | 'voting-closed'>('all');

  const { width } = Dimensions.get('window');
  const isSmallScreen = width < 375;

  const filteredEvents = events.filter((event: Event) => {
    const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         event.group.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         event.location.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = selectedFilter === 'all' ||
                         (selectedFilter === 'voting-open' && event.isVotingOpen) ||
                         (selectedFilter === 'voting-closed' && !event.isVotingOpen);
    
    return matchesSearch && matchesFilter;
  });

  const getTimeUntilEvent = (eventDate: string) => {
    const eventDateObj = new Date(eventDate);
    const now = new Date();
    const timeDiff = eventDateObj.getTime() - now.getTime();
    
    if (timeDiff <= 0) return 'Today';
    
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Tomorrow';
    if (days === 1) return 'In 1 day';
    if (days < 7) return `In ${days} days`;
    
    const weeks = Math.floor(days / 7);
    return `In ${weeks} week${weeks > 1 ? 's' : ''}`;
  };

  const handleEventPress = (event: Event) => {
    // Navigate to the EventView with the event data
    router.push({
      pathname: '/EventView',
      params: { eventId: event.id.toString() }
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Upcoming Events</Text>
        <Text style={styles.headerSubtitle}>{filteredEvents.length} events found</Text>
      </View>

      {/* Search and Filter */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search events..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
        
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterButton, selectedFilter === 'all' && styles.filterButtonActive]}
            onPress={() => setSelectedFilter('all')}
          >
            <Text style={[styles.filterButtonText, selectedFilter === 'all' && styles.filterButtonTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.filterButton, selectedFilter === 'voting-open' && styles.filterButtonActive]}
            onPress={() => setSelectedFilter('voting-open')}
          >
            <Text style={[styles.filterButtonText, selectedFilter === 'voting-open' && styles.filterButtonTextActive]}>
              Voting Open
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.filterButton, selectedFilter === 'voting-closed' && styles.filterButtonActive]}
            onPress={() => setSelectedFilter('voting-closed')}
          >
            <Text style={[styles.filterButtonText, selectedFilter === 'voting-closed' && styles.filterButtonTextActive]}>
              Voting Closed
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {filteredEvents.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>📅</Text>
            <Text style={styles.emptyStateTitle}>No events found</Text>
            <Text style={styles.emptyStateSubtitle}>
              Try adjusting your search or filters
            </Text>
          </View>
        ) : (
          filteredEvents.map((event: Event) => (
            <TouchableOpacity
              key={event.id}
              style={styles.eventCard}
              onPress={() => handleEventPress(event)}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <View style={styles.groupBadge}>
                  <Text style={styles.groupBadgeText}>{event.group}</Text>
                </View>
                <View style={[styles.votingStatus, event.isVotingOpen ? styles.votingOpen : styles.votingClosed]}>
                  <Text style={styles.votingStatusText}>
                    {event.isVotingOpen ? 'Voting Open' : 'Voting Closed'}
                  </Text>
                </View>
              </View>

              <Text style={styles.eventTitle}>{event.title}</Text>
              <Text style={styles.eventDescription}>{event.description}</Text>

              <View style={styles.eventDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailIcon}>📅</Text>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Date & Time</Text>
                    <Text style={styles.detailValue}>{event.date}</Text>
                    <Text style={styles.detailSub}>{event.time}</Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailIcon}>📍</Text>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Location</Text>
                    <Text style={styles.detailValue}>{event.location}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <View style={styles.attendeeInfo}>
                  <Text style={styles.attendeeIcon}>👥</Text>
                  <Text style={styles.attendeeCount}>{event.attendeeCount} attending</Text>
                </View>
                <Text style={styles.timeUntilEvent}>{getTimeUntilEvent(event.date)}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
      
      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/CreateGameSession')}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
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
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  searchContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterButtonActive: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  container: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  eventCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  groupBadge: {
    backgroundColor: '#007bff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  groupBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  votingStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  votingOpen: {
    backgroundColor: '#d4edda',
  },
  votingClosed: {
    backgroundColor: '#f8d7da',
  },
  votingStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  eventDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  eventDetails: {
    gap: 12,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailIcon: {
    fontSize: 16,
    marginRight: 8,
    marginTop: 2,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  detailSub: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  attendeeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attendeeIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  attendeeCount: {
    fontSize: 12,
    color: '#666',
  },
  timeUntilEvent: {
    fontSize: 12,
    color: '#007bff',
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007bff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    fontSize: 32,
    color: '#fff',
    fontWeight: 'bold',
  },
}); 