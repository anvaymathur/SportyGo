import React, { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { listenGroupEvents, listenUserGroupEvents, getVoteCounts, getUserVote, getUserGroups } from '../firebase/services_firestore2';
import { EventDoc, VoteStatus } from '../firebase/types_index';
import { sharedState } from './shared';
import { Theme, YStack, XStack, ScrollView, Button, Input, Paragraph, H2, Text, Card } from 'tamagui';
import { useAuth0 } from 'react-native-auth0';
import { SafeAreaWrapper } from './components/SafeAreaWrapper';

export default function EventsList() {
  const [events, setEvents] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'voting-open' | 'voting-closed' | 'my-events'>('all');
  const [mappedEvents, setMappedEvents] = useState<any[]>([]);
  const [userGroups, setUserGroups] = useState<string[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  const { user } = useAuth0();
  const userId = user?.sub || 'default-user';
  const GROUP_ID = sharedState.groupPressedId;

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

  const mapEventToUI = (event: any, voteCounts: any, userVote: any) => ({
    id: event.id || event.docId || event._id,
    title: event.Title,
    date: formatDate(event.EventDate),
    time: formatTime(event.EventDate),
    location: formatLocation(event.Location),
    group: event.GroupID || 'Unknown Group',
    description: event.Title,
    attendeeCount: voteCounts.going + voteCounts.maybe + voteCounts.not,
    votingCutoff: formatDate(event.CutoffDate),
    isVotingOpen: new Date() < parseFirestoreDate(event.CutoffDate),
    userVote,
    eventDate: parseFirestoreDate(event.EventDate),
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
    if (userGroups.length > 0) {
      const unsubscribe = listenUserGroupEvents(userGroups, setEvents);
      return () => unsubscribe();
    } else if (GROUP_ID) {
      // Fallback to single group if no user groups found
      const unsubscribe = listenGroupEvents(GROUP_ID, setEvents);
      return () => unsubscribe();
    }
  }, [userGroups, GROUP_ID]);

  useEffect(() => {
    const fetchEventsWithVoteCounts = async () => {
      const eventsWithCounts = await Promise.all(
        events.map(async (event) => {
          try {
            const voteCounts = await getVoteCounts(event.id);
            const userVote = await getUserVote(event.id, userId);
            const totalAttendees = voteCounts.going + voteCounts.maybe + voteCounts.not;

            return {
              id: event.id || event.docId || event._id,
              title: event.Title,
              date: event.EventDate instanceof Date ? event.EventDate.toDateString() : new Date(event.EventDate.seconds ? event.EventDate.seconds * 1000 : event.EventDate).toDateString(),
              time: event.EventDate instanceof Date ? event.EventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(event.EventDate.seconds ? event.EventDate.seconds * 1000 : event.EventDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              location: typeof event.Location === 'string' ? event.Location :
                        (event.Location && typeof event.Location === 'object' && event.Location._lat && event.Location._long)
                          ? `${event.Location._lat.toFixed(6)}, ${event.Location._long.toFixed(6)}`
                          : 'Location not specified',
              group: event.GroupID || 'Unknown Group',
              description: event.Title,
              attendeeCount: totalAttendees,
              votingCutoff: event.CutoffDate instanceof Date ? event.CutoffDate.toDateString() : new Date(event.CutoffDate.seconds ? event.CutoffDate.seconds * 1000 : event.CutoffDate).toDateString(),
              isVotingOpen: new Date() < (event.CutoffDate instanceof Date ? event.CutoffDate : new Date(event.CutoffDate.seconds ? event.CutoffDate.seconds * 1000 : event.CutoffDate)),
              userVote: userVote,
              eventDate: event.EventDate instanceof Date ? event.EventDate : new Date(event.EventDate.seconds ? event.EventDate.seconds * 1000 : event.EventDate),
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
              group: event.GroupID || 'Unknown Group',
              description: event.Title,
              attendeeCount: 0,
              votingCutoff: event.CutoffDate instanceof Date ? event.CutoffDate.toDateString() : new Date(event.CutoffDate.seconds ? event.CutoffDate.seconds * 1000 : event.CutoffDate).toDateString(),
              isVotingOpen: new Date() < (event.CutoffDate instanceof Date ? event.CutoffDate : new Date(event.CutoffDate.seconds ? event.CutoffDate.seconds * 1000 : event.CutoffDate)),
              userVote: null,
              eventDate: event.EventDate instanceof Date ? event.EventDate : new Date(event.EventDate.seconds ? event.EventDate.seconds * 1000 : event.EventDate),
            };
          }
        })
      );

      const sortedEvents = eventsWithCounts.sort((a, b) => {
        return a.eventDate.getTime() - b.eventDate.getTime();
      });

      setMappedEvents(sortedEvents);
    };

    if (events.length > 0) {
      fetchEventsWithVoteCounts();
    } else {
      setMappedEvents([]);
    }
  }, [events, userId]);

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

    if (timeDiff < 0) {
      const daysAgo = Math.floor(Math.abs(timeDiff) / (1000 * 60 * 60 * 24));
      if (daysAgo === 0) return 'Today';
      if (daysAgo === 1) return 'Yesterday';
      if (daysAgo < 7) return `${daysAgo} days ago`;
      const weeksAgo = Math.floor(daysAgo / 7);
      return `${weeksAgo} week${weeksAgo > 1 ? 's' : ''} ago`;
    }

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

  const FilterButton = ({
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
          {/* Header */}
          <YStack background="$color1" px={16} py={20} borderBottomWidth={1} borderColor="$borderColor">
            <H2 style={{ fontSize: 28, fontWeight: 'bold' }} color="$color" mb={4}>
              Upcoming Events
            </H2>
            <Paragraph color="$color10" style={{ fontSize: 16 }}>
              {loadingGroups ? 'Loading your groups...' : `${filteredEvents.length} events found`}
            </Paragraph>
          </YStack>

          {/* Search and Filter */}
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

          {/* Events List */}
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
                    {/* Card Header */}
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
                    {/* Title */}
                    <Text style={{ fontSize: 18, fontWeight: 'bold' }} color="$color" mb={8}>
                      {event.title}
                    </Text>

                    {/* Details */}
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

                    {/* Footer */}
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

                    {/* Overlay button */}
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
          {/* Floating Action Button */}
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
} 