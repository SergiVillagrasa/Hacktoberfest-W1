import { z } from 'zod';
import { SubmitResult } from './api';

const iso = z.iso.datetime();
const nullableIso = iso.nullable();
const url = z.string().nullable();

export const ClueView = z.object({
  id: z.string(),
  kind: z.enum(['voice', 'visual']),
  status: z.enum(['active', 'won', 'lost', 'cancelled']),
  targetId: z.string(),
  text: z.string().nullable(),
  secondText: z.string().nullable(),
  judgeBusyText: z.string().nullable(),
  audioUrl: url,
  secondAudioUrl: url,
  judgeBusyAudioUrl: url,
  hintUrl: url,
  /** For picture clues: whether the hint image is ready, still being drawn, or will never come. Null for spoken clues. */
  hintStatus: z.enum(['ready', 'pending', 'unavailable']).nullable(),
  secondClueUsed: z.boolean(),
  issuedAt: iso,
  submission: z.object({ id: z.string(), pending: z.boolean(), result: SubmitResult.nullable() }).nullable().optional(),
});

export const FeedItem = z.object({ at: iso, type: z.string(), text: z.string(), photoUrl: url, hunterId: z.string().optional() });

export const RecapItem = z.object({
  targetId: z.string(),
  ownerNickname: z.string(),
  finderNickname: z.string().nullable(),
  originalUrl: z.string(),
  findPhotoUrl: url,
  clueText: z.string().nullable(),
  clueAudioUrl: url,
  hintUrl: url,
  points: z.number().int().nullable(),
});

export const RankedView = z.object({
  playerId: z.string(),
  nickname: z.string(),
  score: z.number().int(),
  finds: z.number().int(),
  lastFindAt: nullableIso,
  rank: z.number().int().min(1),
});

const PlayerStatus = z.enum(['active', 'eliminated', 'out_of_attempts']);

export const RoomView = z.object({
  code: z.string(),
  status: z.enum(['lobby', 'countdown', 'active', 'finished']),
  phase: z.enum(['races', 'solo']),
  timeLimitMs: z.number().int(),
  countdownEndsAt: nullableIso,
  endsAt: nullableIso,
  serverNow: iso,
  version: z.number().int(),
  me: z.object({
    playerId: z.string(),
    isCreator: z.boolean(),
    status: PlayerStatus,
    failedAttempts: z.number().int(),
    attemptsLeft: z.number().int(),
  }),
  players: z.array(
    z.object({
      id: z.string(),
      nickname: z.string(),
      isCreator: z.boolean(),
      status: PlayerStatus,
      ready: z.boolean(),
      score: z.number().int(),
      finds: z.number().int(),
    }),
  ),
  myClues: z.array(ClueView),
  spectatorClues: z.array(ClueView),
  feed: z.array(FeedItem),
  ranking: z.array(RankedView).nullable(),
  recap: z.array(RecapItem).nullable(),
  myTarget: z
    .object({ validation: z.enum(['pending', 'accepted', 'rejected']), rejectReason: z.string().nullable(), imageUrl: url })
    .nullable(),
});

export type ClueView = z.infer<typeof ClueView>;
export type FeedItem = z.infer<typeof FeedItem>;
export type RecapItem = z.infer<typeof RecapItem>;
export type RankedView = z.infer<typeof RankedView>;
export type RoomView = z.infer<typeof RoomView>;
