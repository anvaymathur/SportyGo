import { buildEventParticipants, countEventParticipants } from '../utils/eventParticipants';

const group = ['me', 'a', 'b', 'c'];

describe('buildEventParticipants', () => {
  it('without a group, invites the selected people plus the creator', () => {
    expect(buildEventParticipants({ groupId: null, groupMemberIds: [], selectedIds: ['x', 'y'], excludedIds: [], creatorId: 'me' }))
      .toEqual({ GroupIDs: [], IndividualParticipantIDs: ['x', 'y', 'me'] });
  });

  it('shares with the whole group when nobody was deselected', () => {
    expect(buildEventParticipants({ groupId: 'g1', groupMemberIds: group, selectedIds: [], excludedIds: [], creatorId: 'me' }))
      .toEqual({ GroupIDs: ['g1'], IndividualParticipantIDs: [] });
  });

  it('invites the remaining members individually when some were deselected', () => {
    // Before, the event still went to the whole group, so deselected members saw it anyway
    expect(buildEventParticipants({ groupId: 'g1', groupMemberIds: group, selectedIds: [], excludedIds: ['b'], creatorId: 'me' }))
      .toEqual({ GroupIDs: [], IndividualParticipantIDs: ['me', 'a', 'c'] });
  });

  it('respects the creator deselecting themselves from a group event', () => {
    expect(buildEventParticipants({ groupId: 'g1', groupMemberIds: group, selectedIds: [], excludedIds: ['me'], creatorId: 'me' }))
      .toEqual({ GroupIDs: [], IndividualParticipantIDs: ['a', 'b', 'c'] });
  });

  it('ignores exclusions of people who are not in the group', () => {
    expect(buildEventParticipants({ groupId: 'g1', groupMemberIds: group, selectedIds: [], excludedIds: ['stranger'], creatorId: 'me' }))
      .toEqual({ GroupIDs: ['g1'], IndividualParticipantIDs: [] });
  });

  it('never lists anyone twice', () => {
    const result = buildEventParticipants({ groupId: 'g1', groupMemberIds: group, selectedIds: ['a', 'a'], excludedIds: ['b'], creatorId: 'me' });
    expect(new Set(result.IndividualParticipantIDs).size).toBe(result.IndividualParticipantIDs.length);
  });
});

describe('countEventParticipants', () => {
  it('counts group members once, plus extra individuals', () => {
    expect(countEventParticipants({ GroupIDs: ['g1'], IndividualParticipantIDs: ['a', 'outsider'] }, group)).toBe(5);
  });

  it('counts individual invitations', () => {
    expect(countEventParticipants({ GroupIDs: [], IndividualParticipantIDs: ['me', 'a'] }, group)).toBe(2);
  });
});
