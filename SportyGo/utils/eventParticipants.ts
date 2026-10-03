/**
 * Decides who an event is shared with, from the Create Event form's selections.
 *
 * - No group: the selected people, plus the creator.
 * - A whole group: the group (so members who join later see it too), plus anyone selected.
 * - A group with some members deselected: sharing with the group would still show the event
 *   to the deselected members, so it's shared with the remaining people individually instead.
 */
export function buildEventParticipants(options: {
  groupId: string | null;
  groupMemberIds: string[];
  selectedIds: string[];
  excludedIds: string[];
  creatorId: string;
}): { GroupIDs: string[]; IndividualParticipantIDs: string[] } {
  const { groupId, groupMemberIds, selectedIds, excludedIds, creatorId } = options;
  const unique = (ids: string[]) => Array.from(new Set(ids.filter(Boolean)));

  if (!groupId) {
    return { GroupIDs: [], IndividualParticipantIDs: unique([...selectedIds, creatorId]) };
  }

  const excluded = new Set(excludedIds);
  const groupHasExclusions = groupMemberIds.some((id) => excluded.has(id));
  if (!groupHasExclusions) {
    return { GroupIDs: [groupId], IndividualParticipantIDs: unique(selectedIds) };
  }

  const remainingMembers = groupMemberIds.filter((id) => !excluded.has(id));
  return { GroupIDs: [], IndividualParticipantIDs: unique([...remainingMembers, ...selectedIds]) };
}

/** Number of people an event built by buildEventParticipants is shared with. */
export function countEventParticipants(
  participants: { GroupIDs: string[]; IndividualParticipantIDs: string[] },
  groupMemberIds: string[]
): number {
  const people = new Set(participants.IndividualParticipantIDs);
  if (participants.GroupIDs.length > 0) groupMemberIds.forEach((id) => people.add(id));
  return people.size;
}
