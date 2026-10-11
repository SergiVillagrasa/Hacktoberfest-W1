import type { Game } from './types';

export interface Ranked {
  playerId: string;
  nickname: string;
  score: number;
  finds: number;
  lastFindAt: Date | null;
  rank: number;
}

export function rankPlayers(game: Game): Ranked[] {
  const rows = game.players.map((p) => {
    const found = game.targets.filter((t) => t.foundBy === p.id);
    const times = found.map((t) => t.foundAt?.getTime() ?? 0);
    return {
      playerId: p.id,
      nickname: p.nickname,
      score: found.reduce((sum, t) => sum + (t.points ?? 0), 0),
      finds: found.length,
      lastFindAt: times.length ? new Date(Math.max(...times)) : null,
      joinedAt: p.joinedAt.getTime(),
    };
  });
  rows.sort(
    (a, b) =>
      b.score - a.score ||
      (a.lastFindAt?.getTime() ?? Infinity) - (b.lastFindAt?.getTime() ?? Infinity) ||
      a.joinedAt - b.joinedAt,
  );
  const ranked: Ranked[] = [];
  rows.forEach(({ joinedAt: _joinedAt, ...row }, i) => {
    const prev = ranked[i - 1];
    const tied = prev && prev.score === row.score && prev.lastFindAt?.getTime() === row.lastFindAt?.getTime();
    ranked.push({ ...row, rank: tied ? prev.rank : i + 1 });
  });
  return ranked;
}
