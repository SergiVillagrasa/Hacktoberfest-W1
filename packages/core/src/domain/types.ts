import type { SubmitResult } from '@snaphunt/contracts';

export type RoomStatus = 'lobby' | 'countdown' | 'active' | 'finished';
export type Phase = 'races' | 'solo';
export type PlayerStatus = 'active' | 'eliminated' | 'out_of_attempts';
export type ClueKind = 'voice' | 'visual';
export type ClueStatus = 'active' | 'won' | 'lost' | 'cancelled';
export type Validation = 'pending' | 'accepted' | 'rejected';
export type PrepStatus = 'pending' | 'ready' | 'failed';

export interface Player {
  id: string;
  nickname: string;
  isCreator: boolean;
  status: PlayerStatus;
  failedAttempts: number;
  joinedAt: Date;
}

export interface TargetAssets {
  prep: PrepStatus;
  clues: { first: string; second: string; visual: string; judgeBusy: string } | null;
  audio: { first: string | null; second: string | null; visual: string | null; judgeBusy: string | null };
  hintPath: string | null;
}

export interface Target {
  id: string;
  ownerId: string;
  imagePath: string;
  validation: Validation;
  rejectReason: string | null;
  foundBy: string | null;
  foundAt: Date | null;
  points: number | null;
  assets: TargetAssets;
}

export interface Judgement {
  id: string;
  idempotencyKey: string;
  imagePath: string;
  startedAt: number;
  expiresAt: number;
  result: SubmitResult | null;
}

export interface Clue {
  id: string;
  targetId: string;
  hunterId: string;
  kind: ClueKind;
  issuedAt: Date;
  secondClueUsed: boolean;
  judgeBusyServed: boolean;
  status: ClueStatus;
  judgement?: Judgement | null;
}

export interface Game {
  roomId: string;
  code: string;
  status: RoomStatus;
  phase: Phase;
  timeLimitMs: number;
  countdownEndsAt: Date | null;
  endsAt: Date | null;
  finishedAt: Date | null;
  players: Player[];
  targets: Target[];
  clues: Clue[];
  version: number;
}

export type DomainEvent =
  | { type: 'game_started'; at: Date }
  | { type: 'target_found'; at: Date; targetId: string; hunterId: string; points: number; kind: ClueKind }
  | { type: 'player_eliminated'; at: Date; playerId: string; byPlayerId: string }
  | { type: 'visual_clue_issued'; at: Date; clueId: string; hunterId: string; targetId: string }
  | { type: 'player_out_of_attempts'; at: Date; playerId: string }
  | { type: 'solo_mode'; at: Date }
  | { type: 'game_finished'; at: Date; reason: 'all_found' | 'time_up' | 'no_pursuers' };

export interface Transition {
  game: Game;
  events: DomainEvent[];
}

export type Rng = () => number;
export type IdGen = () => string;
