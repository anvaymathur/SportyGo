import { useState, useEffect } from 'react';
import { getUserEvents, getUserGroups, getUserProfilesByIds } from '@/firebase/services_firestore2';
import { UserDoc } from '@/firebase/types_index';

/**
 * Custom hook to fetch users connected to the current user.
 * 
 * This hook retrieves a list of users who are "connected" to the provided `userId`.
 * A connected user is defined as:
 * - A member of any group the current user belongs to.
 * - A participant in any event the current user is involved in (as a creator, individual participant, or group member).
 * 
 * The hook aggregates unique users from these sources and fetches their profiles.
 * 
 * @param userId - The ID of the current user. If undefined, the hook does nothing.
 * @returns An object containing:
 * - `connectedUsers`: An array of `UserDoc` objects representing the connected users, sorted by name.
 * - `loading`: A boolean indicating whether the data is currently being fetched.
 */
export function useConnectedUsers(userId: string | undefined) {
    const [connectedUsers, setConnectedUsers] = useState<UserDoc[]>([]);
    const [loading, setLoading] = useState(true);

    const [refreshKey, setRefreshKey] = useState(0);

    const refresh = () => {
        setRefreshKey(prev => prev + 1);
    };

    useEffect(() => {
        if (!userId) {
            setLoading(false);
            return;
        }

        const fetchConnectedUsers = async () => {
            setLoading(true);
            try {
                const connectedUserIds = new Set<string>();
                // Add self
                connectedUserIds.add(userId);

                // 1. Get Groups
                const groups = await getUserGroups(userId);

                groups.forEach(group => {
                    group.MemberIds?.forEach(memberId => connectedUserIds.add(memberId));
                });

                // 2. Get Events the user is involved in (queried directly, not the whole collection)
                const events = await getUserEvents(groups.map(g => g.id), userId);
                events.forEach(evt => {
                    // Add all individual participants of this event. Members of groups the user is
                    // NOT in aren't fetched, even if they share an event, to avoid excessive reads.
                    evt.IndividualParticipantIDs?.forEach(pid => connectedUserIds.add(pid));
                });

                const idsToFetch = Array.from(connectedUserIds);
                const profilesMap = await getUserProfilesByIds(idsToFetch);

                const profiles = Object.values(profilesMap).filter((p): p is UserDoc => !!p);

                // Sort by name for better UX
                profiles.sort((a, b) => (a.Name || "").localeCompare(b.Name || ""));

                setConnectedUsers(profiles);

            } catch (e) {
                console.error("Error fetching connected users:", e);
            } finally {
                setLoading(false);
            }
        };

        fetchConnectedUsers();
    }, [userId, refreshKey]);

    return { connectedUsers, loading, refresh };
}
