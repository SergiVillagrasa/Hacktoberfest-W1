import type { DomainEvent, Game } from '../domain/types';

export type SubmissionOutcome = 'match' | 'no_match' | 'judge_busy' | 'already_found';

export interface StoredSubmission {
  id: string;
  roomId: string;
  clueId: string;
  playerId: string;
  idempotencyKey: string;
  imagePath: string;
  outcome: SubmissionOutcome;
  points: number | null;
  evidence: unknown;
  createdAt: Date;
}

export type StoredEvent = DomainEvent & { id: number };

export interface GameRepository {
  /** Inserts a new room. Resolves false, writing nothing, if the room code is already taken. */
  create(game: Game, tokenHashes: Record<string, string>): Promise<boolean>;
  loadByCode(code: string): Promise<Game | null>;
  findPlayerByTokenHash(hash: string): Promise<{ roomCode: string; playerId: string } | null>;
  /** Persists game if stored version === game.version, then increments version; appends events. Throws GameError('version_conflict'). */
  save(game: Game, events: DomainEvent[], tokenHashes?: Record<string, string>): Promise<Game>;
  version(code: string): Promise<number | null>;
  recentEvents(roomId: string, limit: number): Promise<StoredEvent[]>;
}

export interface SubmissionRepository {
  findByKey(key: string): Promise<StoredSubmission | null>;
  record(submission: StoredSubmission): Promise<void>;
  /** Submissions that scored a find in this room. */
  listMatches(roomId: string): Promise<StoredSubmission[]>;
}
export * from './image-store';
export * from './vision';
export * from './media';
