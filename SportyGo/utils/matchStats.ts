import { newMatchHistory } from '@/firebase/types_index';

export type MatchResult = 'W' | 'L' | 'D';

export interface MatchOutcome {
  result: MatchResult;
  /** The user's own team's score, then the other team's */
  myScore: number;
  theirScore: number;
}

/** How a match went for `userId`, or null if they didn't play in it. */
export function matchOutcomeFor(match: newMatchHistory, userId: string): MatchOutcome | null {
  if (!userId) return null;
  const [t1p1, t1p2, t1Score] = match.team1;
  const [t2p1, t2p2, t2Score] = match.team2;
  const inTeam1 = userId === t1p1 || userId === t1p2;
  const inTeam2 = userId === t2p1 || userId === t2p2;
  if (!inTeam1 && !inTeam2) return null;
  const myScore = inTeam1 ? t1Score : t2Score;
  const theirScore = inTeam1 ? t2Score : t1Score;
  return { result: myScore > theirScore ? 'W' : myScore < theirScore ? 'L' : 'D', myScore, theirScore };
}

export interface MatchSummary {
  played: number;
  wins: number;
  losses: number;
  draws: number;
  /** Wins as a percentage of matches played, to one decimal place (0 when none played) */
  winRate: number;
}

export function summarizeMatches(matches: newMatchHistory[], userId: string): MatchSummary {
  const summary: MatchSummary = { played: 0, wins: 0, losses: 0, draws: 0, winRate: 0 };
  for (const match of matches ?? []) {
    const outcome = matchOutcomeFor(match, userId);
    if (!outcome) continue;
    summary.played += 1;
    if (outcome.result === 'W') summary.wins += 1;
    else if (outcome.result === 'L') summary.losses += 1;
    else summary.draws += 1;
  }
  summary.winRate = summary.played === 0 ? 0 : Math.round((summary.wins / summary.played) * 1000) / 10;
  return summary;
}
