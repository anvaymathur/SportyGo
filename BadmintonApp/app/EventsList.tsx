import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView, Dimensions, TextInput } from 'react-native';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { listenGroupEvents, listenUserGroupEvents, listenAllEvents, getVoteCounts, getUserVote, getUserGroups, hasEventStarted } from '../firebase/services_firestore2';
import { EventDoc, VoteStatus } from '../firebase/types_index';
import { useAuth0 } from 'react-native-auth0';

export default function EventsList() {
  const [events, setEvents] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'voting-open' | 'voting-closed' | 'my-events'>('all');
  const [mappedEvents, setMappedEvents] = useState<any[]>([]);
  const [userGroups, setUserGroups] = useState<string[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingVoteData, setLoadingVoteData] = useState(false);
  
  const { user } = useAuth0();
  const userId = user?.sub || 'default-user';
  const params = useLocalSearchParams();
  const GROUP_ID = params.groupId as string;

  // Helper functions
  const parseFirestoreDate = (date: any) => {
    if (date instanceof Date) return date;
    return new Date(date.seconds ? date.seconds * 1000 : date);
  };

  const formatDate = (date: any) => parseFirestoreDate(date).toDateString();
  const formatTime = (date: any) => parseFirestoreDate(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatLocation = (location: any) => {
    if (typeof location === 'string') return location;
    if (location?._lat && location?._long) return `${location._lat.toFixed(6)}, ${location._long.toFixed(6)}`;
    return 'Location not specified';
  };

  // Check if two events overlap in time
  const eventsOverlap = (event1: any, event2: any) => {
    const start1 = new Date(event1.EventDate);
    const start2 = new Date(event2.EventDate);
    
    // Assume events last 2 hours by default
    const duration = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
    const end1 = new Date(start1.getTime() + duration);
    const end2 = new Date(start2.getTime() + duration);
    
    // Check if events overlap
    return start1 < end2 && start2 < end1;
  };

  // Check if an event conflicts with user's existing 'going' votes
  const checkEventConflict = (event: any, userGoingEvents: any[]) => {
    for (const userEvent of userGoingEvents) {
      if (userEvent.id !== event.id && eventsOverlap(event, userEvent)) {
        return {
          hasConflict: true,
          conflictingEvent: userEvent
        };
      }
    }
    return { hasConflict: false };
  };

  const mapEventToUI = (event: any, voteCounts: any, userVote: any) => ({
    id: event.id || event.docId || event._id,
    title: event.Title,
    date: formatDate(event.EventDate),
    time: formatTime(event.EventDate),
    location: formatLocation(event.Location),
    group: event.GroupIDs && event.GroupIDs.length > 0 ? 'Group selected' : 'No group',
    individualParticipants: event.IndividualParticipantIDs ? event.IndividualParticipantIDs.length : 0,
    description: event.Title,
    attendeeCount: event.VotingEnabled !== false ? (voteCounts.going + voteCounts.maybe + voteCounts.not) : 0,
    votingCutoff: event.CutoffDate ? formatDate(event.CutoffDate) : 'No voting',
    isVotingOpen: event.VotingEnabled !== false && event.CutoffDate ? 
      new Date() < parseFirestoreDate(event.CutoffDate) &&
      !hasEventStarted(event.EventDate) && !event.StartedEarly : false,
    userVote: event.VotingEnabled !== false ? userVote : null,
    eventDate: parseFirestoreDate(event.EventDate),
    votingEnabled: event.VotingEnabled !== false,
  });

  // Fetch user's groups
  useEffect(() => {
    const fetchUserGroups = async () => {
      if (user && user.sub) {
        try {
          setLoadingGroups(true);
          const groups = await getUserGroups(user.sub);
          const groupIds = groups.map(group => group.id);
          setUserGroups(groupIds);
        } catch (error) {
          console.error('Error fetching user groups:', error);
          setUserGroups([]);
        } finally {
          setLoadingGroups(false);
        }
      } else {
        setUserGroups([]);
        setLoadingGroups(false);
      }
    };

    fetchUserGroups();
  }, [user]);

  // Listen to events from user's groups
  useEffect(() => {
    if (loadingGroups) return; // Wait for groups to load first
    
    setLoadingEvents(true);
    
    if (userGroups.length > 0) {
      const unsubscribe = listenUserGroupEvents(userGroups, userId, (eventsList) => {
        setEvents(eventsList);
        setLoadingEvents(false);
      });
      return () => unsubscribe();
    } else if (GROUP_ID) {
      // Fallback to single group if no user groups found
      const unsubscribe = listenGroupEvents(GROUP_ID, (eventsList) => {
        setEvents(eventsList);
        setLoadingEvents(false);
      });
      return () => unsubscribe();
    } else {
      // Fallback to show events where user is an individual participant
      const unsubscribe = listenAllEvents(userId, (eventsList) => {
        setEvents(eventsList);
        setLoadingEvents(false);
      });
      return () => unsubscribe();
    }
  }, [userGroups, GROUP_ID, userId, loadingGroups]);

  useEffect(() => {
    const fetchEventsWithVoteCounts = async () => {
      if (events.length === 0) {
        setMappedEvents([]);
        return;
      }

      setLoadingVoteData(true);
      
      try {

        
        // OPTIMIZATION: Batch all vote-related API calls using Promise.all
        // This makes all API calls in parallel instead of sequentially
        const eventsWithCounts = await Promise.all(
          events.map(async (event) => {
            try {
              let voteCounts = { going: 0, maybe: 0, not: 0 };
              let userVote = null;
              
              // Only fetch vote data if voting is enabled
              if (event.VotingEnabled !== false) {
                // Parallel fetch instead of sequential
                const [voteCountsResult, userVoteResult] = await Promise.all([
                  getVoteCounts(event.id),
                  getUserVote(event.id, userId)
                ]);
                voteCounts = voteCountsResult;
                userVote = userVoteResult;
              }
              
              const totalAttendees = event.VotingEnabled !== false ? (voteCounts.going + voteCounts.maybe + voteCounts.not) : 0;
              
              // OPTIMIZATION: Disable expensive conflict checking for performance
              // const conflictCheck = userVote !== 'going' ? checkEventConflict(event, userGoingEvents) : { hasConflict: false };
              const conflictCheck = { hasConflict: false }; // Temporarily disabled for performance
            
            return {
              id: event.id || event.docId || event._id,
              title: event.Title,
              date: event.EventDate instanceof Date ? event.EventDate.toDateString() : new Date(event.EventDate.seconds ? event.EventDate.seconds * 1000 : event.EventDate).toDateString(),
              time: event.EventDate instanceof Date ? event.EventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(event.EventDate.seconds ? event.EventDate.seconds * 1000 : event.EventDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              location: typeof event.Location === 'string' ? event.Location : 
                        (event.Location && typeof event.Location === 'object' && event.Location._lat && event.Location._long) 
                          ? `${event.Location._lat.toFixed(6)}, ${event.Location._long.toFixed(6)}` 
                          : 'Location not specified',
              totalCost: event.TotalCost,
              group: event.GroupIDs && event.GroupIDs.length > 0 ? 'Group selected' : 'No group',
              individualParticipants: event.IndividualParticipantIDs ? event.IndividualParticipantIDs.length : 0,
              description: event.Title,
              attendeeCount: totalAttendees,
              votingCutoff: event.CutoffDate ? (event.CutoffDate instanceof Date ? event.CutoffDate.toDateString() : new Date(event.CutoffDate.seconds ? event.CutoffDate.seconds * 1000 : event.CutoffDate).toDateString()) : 'No voting',
              isVotingOpen: event.VotingEnabled !== false && event.CutoffDate ? 
                new Date() < (event.CutoffDate instanceof Date ? event.CutoffDate : new Date(event.CutoffDate.seconds ? event.CutoffDate.seconds * 1000 : event.CutoffDate)) &&
                !hasEventStarted(event.EventDate) && !event.StartedEarly : false,
              userVote: event.VotingEnabled !== false ? userVote : null,
              eventDate: event.EventDate instanceof Date ? event.EventDate : new Date(event.EventDate.seconds ? event.EventDate.seconds * 1000 : event.EventDate),
              votingEnabled: event.VotingEnabled !== false,
                             hasTimeConflict: false, // Temporarily disabled for performance
               conflictingEvent: null, // Temporarily disabled for performance
               eventStarted: hasEventStarted(event.EventDate),
               isAdmin: event.CreatorID === userId,
             };
          } catch (error) {
            console.error('Error fetching vote counts for event:', event.id, error);
            return {
              id: event.id || event.docId || event._id,
              title: event.Title,
              date: event.EventDate instanceof Date ? event.EventDate.toDateString() : new Date(event.EventDate.seconds ? event.EventDate.seconds * 1000 : event.EventDate).toDateString(),
              time: event.EventDate instanceof Date ? event.EventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(event.EventDate.seconds ? event.EventDate.seconds * 1000 : event.EventDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              location: typeof event.Location === 'string' ? event.Location : 
                        (event.Location && typeof event.Location === 'object' && event.Location._lat && event.Location._long) 
                          ? `${event.Location._lat.toFixed(6)}, ${event.Location._long.toFixed(6)}` 
                          : 'Location not specified',
              totalCost: event.TotalCost,
              group: event.GroupIDs && event.GroupIDs.length > 0 ? 'Group selected' : 'No group',
              individualParticipants: event.IndividualParticipantIDs ? event.IndividualParticipantIDs.length : 0,
              description: event.Title,
              attendeeCount: 0, // Fallback if vote counts fail
              votingCutoff: event.CutoffDate ? (event.CutoffDate instanceof Date ? event.CutoffDate.toDateString() : new Date(event.CutoffDate.seconds ? event.CutoffDate.seconds * 1000 : event.CutoffDate).toDateString()) : 'No voting',
              isVotingOpen: event.VotingEnabled !== false && event.CutoffDate ? 
                new Date() < (event.CutoffDate instanceof Date ? event.CutoffDate : new Date(event.CutoffDate.seconds ? event.CutoffDate.seconds * 1000 : event.CutoffDate)) &&
                !hasEventStarted(event.EventDate) && !event.StartedEarly : false,
              userVote: null,
              eventDate: event.EventDate instanceof Date ? event.EventDate : new Date(event.EventDate.seconds ? event.EventDate.seconds * 1000 : event.EventDate),
                             votingEnabled: event.VotingEnabled !== false,
               hasTimeConflict: false, // Temporarily disabled for performance
               conflictingEvent: null, // Temporarily disabled for performance
               eventStarted: hasEventStarted(event.EventDate),
               isAdmin: event.CreatorID === userId,
             };
          }
        })
      );
      
        // Sort events by date (earliest first)
        const sortedEvents = eventsWithCounts.sort((a, b) => {
          return a.eventDate.getTime() - b.eventDate.getTime();
        });
        
        setMappedEvents(sortedEvents);
      } catch (error) {
        console.error('Error fetching vote data:', error);
        // Fallback: show events without vote data
        const fallbackEvents = events.map(event => ({
          id: event.id || event.docId || event._id,
          title: event.Title,
          date: formatDate(event.EventDate),
          time: formatTime(event.EventDate),
          location: formatLocation(event.Location),
          totalCost: event.TotalCost,
          group: event.GroupIDs && event.GroupIDs.length > 0 ? 'Group selected' : 'No group',
          individualParticipants: event.IndividualParticipantIDs ? event.IndividualParticipantIDs.length : 0,
          description: event.Title,
          attendeeCount: 0,
          votingCutoff: event.CutoffDate ? formatDate(event.CutoffDate) : 'No voting',
          isVotingOpen: event.VotingEnabled !== false && event.CutoffDate ? 
            new Date() < parseFirestoreDate(event.CutoffDate) &&
            !hasEventStarted(event.EventDate) && !event.StartedEarly : false,
          userVote: null,
          eventDate: parseFirestoreDate(event.EventDate),
          votingEnabled: event.VotingEnabled !== false,
          hasTimeConflict: false,
          conflictingEvent: null,
          eventStarted: hasEventStarted(event.EventDate),
          isAdmin: event.CreatorID === userId,
        }));
        setMappedEvents(fallbackEvents);
      } finally {
        setLoadingVoteData(false);
      }
    };

    fetchEventsWithVoteCounts();
  }, [events, userId]);

  const { width } = Dimensions.get('window');
  const isSmallScreen = width < 375;

  const filteredEvents = mappedEvents.filter((event: any) => {
    const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (event.group && event.group.toLowerCase().includes(searchQuery.toLowerCase())) ||
                         (typeof event.location === 'string' && event.location.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesFilter = selectedFilter === 'all' ||
                         (selectedFilter === 'voting-open' && event.isVotingOpen) ||
                         (selectedFilter === 'voting-closed' && !event.isVotingOpen) ||
                         (selectedFilter === 'my-events' && event.userVote === 'going');
    
    return matchesSearch && matchesFilter;
  });

  const getTimeUntilEvent = (eventDate: string) => {
    const eventDateObj = new Date(eventDate);
    const now = new Date();
    const timeDiff = eventDateObj.getTime() - now.getTime();
    
    // Check if event is in the past
    if (timeDiff < 0) {
      const daysAgo = Math.floor(Math.abs(timeDiff) / (1000 * 60 * 60 * 24));
      if (daysAgo === 0) return 'Today';
      if (daysAgo === 1) return 'Yesterday';
      if (daysAgo < 7) return `${daysAgo} days ago`;
      const weeksAgo = Math.floor(daysAgo / 7);
      return `${weeksAgo} week${weeksAgo > 1 ? 's' : ''} ago`;
    }
    
    // Event is in the future
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days < 7) return `In ${days} days`;
    
    const weeks = Math.floor(days / 7);
    return `In ${weeks} week${weeks > 1 ? 's' : ''}`;
  };

  const handleEventPress = (event: any) => {
    // Navigate to the EventView with the event data
    if (!event.id) {
      console.error('Event ID is missing:', event);
      return;
    }
    router.push({
      pathname: '/EventView',
      params: { eventId: event.id.toString() }
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Upcoming Events</Text>
        <Text style={styles.headerSubtitle}>
          {loadingGroups ? 'Loading your groups...' : 
           loadingEvents ? 'Loading events...' :
           loadingVoteData ? 'Loading event details...' :
           `${filteredEvents.length} events found`}
        </Text>
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
            style={[styles.filterButton, selectedFilter === 'my-events' && styles.filterButtonActive]}
            onPress={() => setSelectedFilter('my-events')}
          >
            <Text style={[styles.filterButtonText, selectedFilter === 'my-events' && styles.filterButtonTextActive]}>
              My Events
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
            <Text style={styles.emptyStateTitle}>
              {loadingGroups ? 'Loading groups...' :
               loadingEvents ? 'Loading events...' :
               loadingVoteData ? 'Loading event details...' :
               'No events found'}
            </Text>
            <Text style={styles.emptyStateSubtitle}>
              {loadingGroups || loadingEvents || loadingVoteData ? 
               'Please wait while we load your events' : 
               'Try adjusting your search or filters'}
            </Text>
          </View>
        ) : (
          filteredEvents.map((event: any) => (
            <TouchableOpacity
              key={event.id}
              style={[
                styles.eventCard,
                event.totalCost !== undefined && event.totalCost !== null && { minHeight: 240 }
              ]}
              onPress={() => handleEventPress(event)}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <View style={styles.headerLeft}>
                  <View style={[
                    styles.votingStatus, 
                    !event.votingEnabled ? styles.votingDisabled :
                    event.isVotingOpen ? styles.votingOpen : styles.votingClosed
                  ]}>
                    <Text style={styles.votingStatusText}>
                      {!event.votingEnabled ? 'No Voting' :
                       event.isVotingOpen ? 'Voting Open' : 'Voting Closed'}
                    </Text>
                  </View>
                  {event.userVote === 'going' && event.votingEnabled && (
                    <View style={styles.goingBadge}>
                      <Text style={styles.goingBadgeText}>Going</Text>
                    </View>
                  )}
                                                       {/* COMMENTED OUT FOR PERFORMANCE - Re-enable if needed */}
                  {/* {event.hasTimeConflict && event.votingEnabled && event.userVote !== 'going' && (
                    <View style={styles.conflictBadge}>
                      <Text style={styles.conflictBadgeText}>⚠️ Time Conflict</Text>
                    </View>
                  )} */}
                  {event.isAdmin && event.eventStarted && (
                    <View style={styles.adminBadge}>
                      <Text style={styles.adminBadgeText}>📋 Manage</Text>
                    </View>
                  )}
                </View>
                <View style={styles.groupBadge}>
                  <Text style={styles.groupBadgeText}>{event.group}</Text>
                </View>
              </View>

              <Text style={styles.eventTitle}>{event.title}</Text>

              <View style={styles.eventDetails}>
                <View style={styles.detailRow}>
                  <View style={styles.detailLeft}>
                    <Text style={styles.detailIcon}>📅</Text>
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Date & Time</Text>
                      <Text style={styles.detailValue}>{event.date}</Text>
                      <Text style={styles.detailSub}>{event.time}</Text>
                    </View>
                  </View>
                  <View style={styles.detailRight}>
                    <Text style={styles.detailIcon}>📍</Text>
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Location</Text>
                      <Text style={styles.detailValue}>{event.location}</Text>
                    </View>
                  </View>
                </View>
                {event.totalCost !== undefined && event.totalCost !== null && (
                  <View style={[styles.detailRow, { marginTop: 8, justifyContent: 'flex-start' }]}>
                    <Text style={styles.detailIcon}>💰</Text>
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Total Cost</Text>
                      <Text style={styles.detailValue}>${event.totalCost.toFixed(2)}</Text>
                    </View>
                  </View>
                )}

              </View>

              {/* COMMENTED OUT FOR PERFORMANCE - Re-enable if needed */}
              {/* {event.hasTimeConflict && event.votingEnabled && event.userVote !== 'going' && (
                <View style={styles.conflictInfo}>
                  <Text style={styles.conflictInfoText}>
                    ⚠️ This event conflicts with another event you're attending
                  </Text>
                </View>
              )} */}

              <View style={styles.cardFooter}>
                <View style={styles.attendeeInfo}>
                  <Text style={styles.attendeeIcon}>👥</Text>
                  <Text style={styles.attendeeCount}>
                    {event.votingEnabled ? `${event.attendeeCount} attending` : 'No attendance tracking'}
                  </Text>
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
    padding: 20,
    marginBottom: 16,
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  goingBadge: {
    backgroundColor: '#28a745',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  goingBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  conflictBadge: {
    backgroundColor: '#ffc107',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
     conflictBadgeText: {
     color: '#000',
     fontSize: 10,
     fontWeight: '600',
   },
   adminBadge: {
     backgroundColor: '#28a745',
     paddingHorizontal: 6,
     paddingVertical: 2,
     borderRadius: 8,
   },
   adminBadgeText: {
     color: '#fff',
     fontSize: 10,
     fontWeight: '600',
   },
   conflictInfo: {
    backgroundColor: '#fff3cd',
    borderWidth: 1,
    borderColor: '#ffeaa7',
    borderRadius: 6,
    padding: 8,
    marginBottom: 12,
  },
  conflictInfoText: {
    fontSize: 12,
    color: '#856404',
    textAlign: 'center',
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
  votingDisabled: {
    backgroundColor: '#e0e0e0',
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
    justifyContent: 'space-between',
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  detailRight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    justifyContent: 'flex-end',
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
