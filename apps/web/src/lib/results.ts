import type { RecapItem, RoomView } from '@snaphunt/contracts';

type Ranking = NonNullable<RoomView['ranking']>;

/** True when two players finished on the same score but were separated by who made their last find first. */
export function hasTieBreak(ranking: Ranking): boolean {
  return ranking.some((entry, i) => i > 0 && ranking[i - 1]!.score === entry.score && ranking[i - 1]!.rank !== entry.rank);
}

export function winnerLine(ranking: Ranking, meId: string): { state: 'celebrating' | 'trophy'; line: string } {
  const top = ranking[0];
  if (!top || top.score === 0) return { state: 'trophy', line: 'Game over! Nobody found anything this time.' };
  return top.playerId === meId ? { state: 'celebrating', line: 'You won! What a hunt!' } : { state: 'trophy', line: `${top.nickname} wins the hunt!` };
}

export function recapSummary(item: Pick<RecapItem, 'finderNickname' | 'points'>): string {
  return item.finderNickname ? `Found by ${item.finderNickname}${item.points ? ` for ${item.points} points` : ''}` : 'Nobody found this one';
}

export function sortedPlayers(players: RoomView['players']): RoomView['players'] {
  return [...players].sort((a, b) => b.score - a.score || b.finds - a.finds || a.nickname.localeCompare(b.nickname));
}

export function spectatorReason(status: RoomView['me']['status']): { state: 'shocked' | 'sad'; title: string; line: string } {
  return status === 'eliminated'
    ? { state: 'shocked', title: "You're out!", line: 'You were knocked out by a picture clue. Stay and watch the rest of the hunt!' }
    : { state: 'sad', title: "You're out of attempts", line: 'You used all 5 tries. Stay and cheer on the others!' };
}
