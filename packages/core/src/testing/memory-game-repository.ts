import { GameError } from '../domain/errors';
import type { DomainEvent, Game } from '../domain/types';
import type { GameRepository, StoredEvent } from '../ports';

export function createMemoryGameRepository(): GameRepository & { events: StoredEvent[] } {
  const roomOf = new Map<number, string>();
  const games = new Map<string, Game>();
  const tokens = new Map<string, { roomCode: string; playerId: string }>();
  const events: StoredEvent[] = [];
  const indexTokens = (game: Game, hashes: Record<string, string>) => {
    for (const [playerId, hash] of Object.entries(hashes)) tokens.set(hash, { roomCode: game.code, playerId });
    for (const [hash, ref] of tokens) if (ref.roomCode === game.code && !game.players.some((p) => p.id === ref.playerId)) tokens.delete(hash);
  };

  return {
    events,
    async create(game, tokenHashes) {
      if (games.has(game.code)) return false;
      games.set(game.code, structuredClone(game));
      indexTokens(game, tokenHashes);
      return true;
    },
    async loadByCode(code) {
      const game = games.get(code);
      return game ? structuredClone(game) : null;
    },
    async findPlayerByTokenHash(hash) {
      return tokens.get(hash) ?? null;
    },
    async save(game, evs: DomainEvent[], tokenHashes = {}) {
      const stored = games.get(game.code);
      if (!stored || stored.version !== game.version) throw new GameError('version_conflict', 'Game changed, please retry');
      const next = { ...structuredClone(game), version: game.version + 1 };
      games.set(game.code, next);
      indexTokens(next, tokenHashes);
      for (const e of evs) {
        events.push({ ...e, id: events.length + 1 });
        roomOf.set(events.length, game.roomId);
      }
      return structuredClone(next);
    },
    async version(code) {
      return games.get(code)?.version ?? null;
    },
    async recentEvents(roomId, limit) {
      return events.filter((e) => roomOf.get(e.id) === roomId).slice(-limit);
    },
  };
}
