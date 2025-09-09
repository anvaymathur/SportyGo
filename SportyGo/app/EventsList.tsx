/**
 * @fileoverview EventsList Component
 * 
 * Displays and manages badminton events with real-time voting functionality.
 * Features search, filtering, and navigation to event details and creation.
 */

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView, TextInput } from 'react-native';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { listenGroupEvents, listenUserGroupEvents, listenAllEvents, getVoteCounts, getUserVote, getUserGroups, hasEventStarted } from '../firebase/services_firestore2';
import { VoteStatus } from '../firebase/types_index';
import { useAuth0 } from 'react-native-auth0';

/**
 * Interface for mapped event data used in the UI
 */
interface MappedEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  totalCost?: number;
  group: string;
  individualParticipants: number;
  description: string;
  attendeeCount: number;
  votingCutoff: string;
  isVotingOpen: boolean;
  userVote: VoteStatus | null;
  eventDate: Date;
  votingEnabled: boolean;
  eventStarted: boolean;
  isAdmin: boolean;
}

/**
 * Filter options for the events list
 */
type FilterType = 'all' | 'voting-open' | 'voting-closed' | 'my-events';

/**
 * Main EventsList component that displays and manages badminton events
 * 
 * @returns {JSX.Element} The rendered events list component
 */
export default function EventsList() {
  // State management for events and UI
  const [events, setEvents] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
  const [mappedEvents, setMappedEvents] = useState<MappedEvent[]>([]);
  const [userGroups, setUserGroups] = useState<string[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingVoteData, setLoadingVoteData] = useState(false);
  
  // Auth and routing
  const { user } = useAuth0();
  const userId = user?.sub || 'default-user';
  const params = useLocalSearchParams();
  const GROUP_ID = params.groupId as string;

  /**
   * Parses Firestore date objects to JavaScript Date objects
   * @param {any} date - The date to parse
   * @returns {Date} The parsed JavaScript Date object
   */
  const parseFirestoreDate = (date: any): Date => {
    if (date instanceof Date) return date;
    return new Date(date.seconds ? date.seconds * 1000 : date);
  };


  /**
   * Formats a date to a readable string format
   * @param {any} date - The date to format
   * @returns {string} Formatted date string
   */
  const formatDate = (date: any): string => parseFirestoreDate(date).toDateString();

  /**
   * Formats a date to a readable time format
   * @param {any} date - The date to format
   * @returns {string} Formatted time string (HH:MM)
   */
  const formatTime = (date: any): string => parseFirestoreDate(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  /**
   * Formats location data to a readable string
   * @param {any} location - The location data (string or coordinate object)
   * @returns {string} Formatted location string
   */
  const formatLocation = (location: any): string => {

    if (typeof location === 'string') return location;
    if (location?._lat && location?._long) return `${location._lat.toFixed(6)}, ${location._long.toFixed(6)}`;
    return 'Location not specified';
  };



  /**
   * Maps raw event data to UI-friendly format with vote counts and user status
   * @param {any} event - Raw event data from Firestore
   * @param {any} voteCounts - Vote count data for the event
   * @param {any} userVote - User's vote for this event
   * @returns {MappedEvent} Formatted event data for UI display
   */
  const mapEventToUI = (event: any, voteCounts: any, userVote: any): MappedEvent => ({

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
    eventStarted: hasEventStarted(event.EventDate),
    isAdmin: event.CreatorID === userId,
  });

  /**
   * Fetches user's groups on component mount
   * Sets up real-time listener for user's group events
   */
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
  /**
   * Sets up real-time listeners for events based on user's groups
   * Falls back to single group or all events if no user groups found
   */
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

  /**
   * Fetches vote counts and user votes for all events
   * Optimized with parallel API calls for better performance
   */
  useEffect(() => {
    const fetchEventsWithVoteCounts = async () => {
      if (events.length === 0) {
        setMappedEvents([]);
        return;
      }

      setLoadingVoteData(true);
      
      try {
        const eventsWithCounts = await Promise.all(
          events.map(async (event) => {
            try {
              let voteCounts = { going: 0, maybe: 0, not: 0 };
              let userVote = null;
              
              if (event.VotingEnabled !== false) {
                const [voteCountsResult, userVoteResult] = await Promise.all([
                  getVoteCounts(event.id),
                  getUserVote(event.id, userId)
                ]);
                voteCounts = voteCountsResult;
                userVote = userVoteResult;
              }
              
              const totalAttendees = event.VotingEnabled !== false ? (voteCounts.going + voteCounts.maybe + voteCounts.not) : 0;
            
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

  /**
   * Filters events based on search query and selected filter
   * 
   * @returns {MappedEvent[]} Filtered array of events
   */
  const filteredEvents = mappedEvents.filter((event: MappedEvent) => {
    const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (event.group && event.group.toLowerCase().includes(searchQuery.toLowerCase())) ||
                         (typeof event.location === 'string' && event.location.toLowerCase().includes(searchQuery.toLowerCase()));
    

    const matchesFilter = selectedFilter === 'all' ||
                         (selectedFilter === 'voting-open' && event.isVotingOpen) ||
                         (selectedFilter === 'voting-closed' && !event.isVotingOpen) ||
                         (selectedFilter === 'my-events' && event.userVote === 'going');
    return matchesSearch && matchesFilter;
  });

  /**
   * Calculates and formats the time until an event
   * 
   * @param {string} eventDate - The event date string
   * @returns {string} Human-readable time until event (e.g., "Tomorrow", "In 3 days")
   */
  const getTimeUntilEvent = (eventDate: string): string => {
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

  /**
   * Handles navigation to event details when an event card is pressed
   * 
   * @param {MappedEvent} event - The event to navigate to
   */
  const handleEventPress = (event: MappedEvent): void => {

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
          filteredEvents.map((event: MappedEvent) => (
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

 {/* const FilterButton = ({
    label,
    active,
    onPress,
  }: {
    label: string;
    active: boolean;
    onPress: () => void;
  }) => (
    <Button
      flex={1}
      p={2}
      style={{ borderRadius: 6 }}
      borderWidth={1}
      mx={4}
      background={active ? ('$color9' as any) : ('$color2' as any)}
      borderColor={active ? ('$color9' as any) : ('$borderColor' as any)}
      onPress={onPress}
    >
      <Text style={{ fontSize: 12, fontWeight: '600' }} color={active ? ('$color12' as any) : ('$color' as any)}>
        {label}
      </Text>
    </Button>
  );

  return (
    <Theme name="earthy-sport-light">
      <SafeAreaWrapper backgroundColor="#FAF7F2">
        <YStack flex={1} background="$background">
          {/* Header 
          <YStack background="$color1" px={16} py={20} borderBottomWidth={1} borderColor="$borderColor">
            <H2 style={{ fontSize: 28, fontWeight: 'bold' }} color="$color" mb={4}>
              Upcoming Events
            </H2>
            <Paragraph color="$color10" style={{ fontSize: 16 }}>
              {loadingGroups ? 'Loading your groups...' : `${filteredEvents.length} events found`}
            </Paragraph>
          </YStack>

          {/* Search and Filter 
          <YStack background="$color1" px={16} py={12} borderBottomWidth={1} borderColor="$borderColor">
            <Input
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search events..."
              placeholderTextColor="#999"
              background="$color1"
              borderWidth={1}
              borderColor="$borderColor"
              style={{ borderRadius: 8 }}
              px={16}
              py={12}
              mb={12}
            />

            <XStack>
              <FilterButton label="All" active={selectedFilter === 'all'} onPress={() => setSelectedFilter('all')} />
              <FilterButton label="My Events"  active={selectedFilter === 'my-events'} onPress={() => setSelectedFilter('my-events')} />
              <FilterButton label="Voting Open" active={selectedFilter === 'voting-open'} onPress={() => setSelectedFilter('voting-open')} />
              <FilterButton label="Voting Closed" active={selectedFilter === 'voting-closed'} onPress={() => setSelectedFilter('voting-closed')} />
            </XStack>
          </YStack>

          {/* Events List 
          <ScrollView px={12} pt={12} showsVerticalScrollIndicator={false}>
            {filteredEvents.length === 0 ? (
              <YStack flex={1} verticalAlign="center" justify="center" py={60}>
                <Text fontSize="$10"  style={{ textAlign: 'center' }} color="$color"mb="$3">
                  📅
                </Text>
                <Text fontSize="$4" fontWeight="bold" style={{ textAlign: 'center' }} color="$color" mb="$3" >
                  No events found
                </Text>
                <Paragraph color="$color10" fontSize="$4" mb="$3" style={{ textAlign: 'center' }}>
                   {loadingGroups ? 'Please wait while we load your events' : 'Try adjusting your search or filters'}
                </Paragraph>
              </YStack>
            ) : (
              filteredEvents.map((event: any) => (
                <Card key={event.id} background="$color2" style={{ borderRadius: 12 }} p={16} mb={12} elevation={2}>
                  <YStack>
                    {/* Card Header 
                    <XStack justify="space-between" verticalAlign="start" mb={12}>
                      <XStack verticalAlign="center">
                        <YStack px={8} py={4} style={{ borderRadius: 12 }} background={event.isVotingOpen ? ('$color3' as any) : ('$color2' as any)}>
                          <Text style={{ fontSize: 10, fontWeight: '600' }}>
                            {event.isVotingOpen ? 'Voting Open' : 'Voting Closed'}
                          </Text>
                        </YStack>
                        {event.userVote === 'going' && (
                          <YStack ml={8} px={6} py={2} style={{ borderRadius: 8 }} background="$color9">
                            <Text style={{ fontSize: 10, fontWeight: '600' }} color="$color12">
                              Going
                            </Text>
                          </YStack>
                        )}
                      </XStack>
                    </XStack>
                    <Text style={{ fontSize: 10, fontWeight: 600 }} color="$color" mb={8}>{event.group}</Text>
                    {/* Title 
                    <Text style={{ fontSize: 18, fontWeight: 'bold' }} color="$color" mb={8}>
                      {event.title}
                    </Text>

                    {/* Details 
                    <YStack gap={12} mb={16}>
                      <XStack verticalAlign="start">
                        <Text style={{ fontSize: 16, marginRight: 8, marginTop: 2 }}>📅</Text>
                        <YStack flex={1}>
                          <Text style={{ fontSize: 12 }} color="$color10" mb={2}>
                            Date & Time
                          </Text>
                          <Text style={{ fontSize: 14, fontWeight: '600' }} color="$color">
                            {event.date}
                          </Text>
                          <Text style={{ fontSize: 12 }} color="$color10" mt={2}>
                            {event.time}
                          </Text>
                        </YStack>
                      </XStack>

                      <XStack verticalAlign="start">
                        <Text style={{ fontSize: 16, marginRight: 8, marginTop: 2 }}>📍</Text>
                        <YStack flex={1}>
                          <Text style={{ fontSize: 12 }} color="$color10" mb={2}>
                            Location
                          </Text>
                          <Text style={{ fontSize: 14, fontWeight: '600' }} color="$color">
                            {event.location}
                          </Text>
                        </YStack>
                      </XStack>
                    </YStack>

                    {/* Footer 
                    <XStack justify="space-between" verticalAlign="center" pt={12} borderTopWidth={1} borderColor="$borderColor">
                      <XStack verticalAlign="center">
                        <Text style={{ fontSize: 14, marginRight: 4 }}>👥</Text>
                        <Text style={{ fontSize: 12 }} color="$color10">
                          {event.attendeeCount} attending
                        </Text>
                      </XStack>
                      <Text style={{ fontSize: 12, fontWeight: '600' }} color="$color9">
                        {getTimeUntilEvent(event.date)}
                      </Text>
                    </XStack>

                    {/* Overlay button 
                    <Button
                      position="absolute"
                      t={0}
                      l={0}
                      r={0}
                      b={0}
                      opacity={0}
                      onPress={() => handleEventPress(event)}
                    />
                  </YStack>
                </Card>
                
              ))
            )}
          </ScrollView>
          {/* Floating Action Button 
          <Button
            position="absolute"
            b={24}
            l={24}
            width={56}
            height={56}
            style={{ borderRadius: 28 }}
            bg="$color9"
            onPress={() => router.push('/CreateGameSession')}
          >
            <Text fontSize="$8" fontWeight="bold" color="$color1">+</Text>
          </Button>
        </YStack>
      </SafeAreaWrapper>
    </Theme>
  );
} */}
