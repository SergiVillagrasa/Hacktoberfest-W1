import type { Clue, Game, Player, Target } from '../src/domain/types';

export const T0 = new Date('2026-10-11T10:00:00Z');

export function makePlayer(id: string, overrides: Partial<Player> = {}): Player {
  return { id, nickname: id.toUpperCase(), isCreator: false, status: 'active', failedAttempts: 0, joinedAt: T0, ...overrides };
}

export function makeTarget(id: string, ownerId: string, overrides: Partial<Target> = {}): Target {
  return {
    id,
    ownerId,
    imagePath: `${id}.jpg`,
    validation: 'accepted',
    rejectReason: null,
    foundBy: null,
    foundAt: null,
    points: null,
    assets: { prep: 'ready', clues: null, audio: { first: null, second: null, visual: null, judgeBusy: null }, hintPath: null },
    ...overrides,
  };
}

export function makeClue(id: string, targetId: string, hunterId: string, overrides: Partial<Clue> = {}): Clue {
  return { id, targetId, hunterId, kind: 'voice', issuedAt: T0, secondClueUsed: false, judgeBusyServed: false, status: 'active', ...overrides };
}

export function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    roomId: 'room-1',
    code: 'ABCDE',
    status: 'active',
    phase: 'races',
    timeLimitMs: 600_000,
    countdownEndsAt: T0,
    endsAt: new Date(T0.getTime() + 600_000),
    finishedAt: null,
    players: [],
    targets: [],
    clues: [],
    version: 1,
    ...overrides,
  };
}
