import type { SubmitResult } from '@snaphunt/contracts';
import { JUDGE_BUDGET_MS, MATCH_THRESHOLD, MAX_FAILED_ATTEMPTS } from '../domain/constants';
import { GameError } from '../domain/errors';
import { applyFailedAttempt, applyVerifiedFind } from '../domain/game';
import { sniffImageType } from '../domain/image-type';
import type { DomainEvent, Game, IdGen, Rng } from '../domain/types';
import type { GameRepository, ImageStore, MatchEvidence, SubmissionRepository, VisionModel } from '../ports';
import { storagePaths } from '../ports/image-store';
import { updateGame } from './rooms';
import { tick } from './start-and-tick';

export interface FindDeps {
  games: GameRepository;
  submissions: SubmissionRepository;
  images: ImageStore;
  vision: VisionModel;
  now: () => Date;
  rng: Rng;
  newId: IdGen;
  judgeBudgetMs?: number;
}

export const MESSAGES: Record<SubmitResult['outcome'], string> = {
  match: 'You found it!',
  no_match: "Not quite — that's not the one. Keep looking!",
  judge_busy: 'The judge is on a quick break — here\'s a bonus clue!',
  already_found: 'Too late — someone just found it!',
};

const attemptsLeft = (game: Game, playerId: string) => Math.max(0, MAX_FAILED_ATTEMPTS - (game.players.find((p) => p.id === playerId)?.failedAttempts ?? 0));
const result = (outcome: SubmitResult['outcome'], game: Game, playerId: string, points?: number | null): SubmitResult => ({
  outcome,
  ...(points != null ? { points } : {}),
  attemptsLeft: attemptsLeft(game, playerId),
  message: MESSAGES[outcome],
});

function precheck(game: Game, playerId: string, clueId: string) {
  const player = game.players.find((p) => p.id === playerId);
  if (!player) throw new GameError('not_found', 'Player not found');
  if (player.status !== 'active') throw new GameError('not_active_player', 'You are out of this hunt');
  const clue = game.clues.find((c) => c.id === clueId);
  if (!clue) throw new GameError('not_found', 'Clue not found');
  if (clue.hunterId !== playerId) throw new GameError('forbidden', 'Not your clue');
  const target = game.targets.find((t) => t.id === clue.targetId)!;
  if (target.foundBy !== null) return { clue, target, alreadyFound: true };
  if (game.status !== 'active' || clue.status !== 'active') throw new GameError('clue_not_active', 'This clue is no longer active');
  return { clue, target, alreadyFound: false };
}

async function withDeadline<T>(run: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => (timer = setTimeout(() => (controller.abort(), reject(new Error('Judge deadline exceeded'))), ms)));
  try {
    return await Promise.race([run(controller.signal), deadline]);
  } finally {
    clearTimeout(timer);
  }
}

export async function submitFind(deps: FindDeps, input: { code: string; playerId: string; clueId: string; bytes: Uint8Array; idempotencyKey: string }): Promise<SubmitResult> {
  const { games, submissions, images, vision } = deps;
  const prior = await submissions.findByKey(input.idempotencyKey);
  if (prior) {
    if (prior.playerId !== input.playerId) throw new GameError('forbidden', 'Idempotency key belongs to another player');
    const game = await games.loadByCode(input.code);
    return result(prior.outcome === 'pending' ? 'judge_busy' : prior.outcome, game!, input.playerId, prior.points);
  }

  const game = await tick(deps, input.code);
  const pre = precheck(game, input.playerId, input.clueId);
  if (pre.alreadyFound) return result('already_found', game, input.playerId);

  const contentType = sniffImageType(input.bytes);
  if (!contentType) throw new GameError('invalid_state', 'Please send a JPEG, PNG or WebP photo');
  const submissionId = deps.newId();
  const imagePath = storagePaths.submission(game.roomId, submissionId);
  await images.put(imagePath, input.bytes, contentType);
  let evidence: MatchEvidence | null = null;
  try {
    const reference = await images.get(pre.target.imagePath);
    evidence = await withDeadline((signal) => vision.compare(reference, input.bytes, signal), deps.judgeBudgetMs ?? JUDGE_BUDGET_MS + 3000);
  } catch {
    evidence = null;
  }
  const matched = !!evidence && evidence.sameObject && evidence.confidence >= MATCH_THRESHOLD;

  const outcome = await updateGame(
    games,
    input.code,
    (fresh) => {
      const check = precheck(fresh, input.playerId, input.clueId);
      if (check.alreadyFound) return { game: fresh, events: [] as DomainEvent[], outcome: 'already_found' as const, points: null as number | null };
      if (!evidence) return { game: { ...fresh, clues: fresh.clues.map((c) => (c.id === input.clueId ? { ...c, judgeBusyServed: true } : c)) }, events: [] as DomainEvent[], outcome: 'judge_busy' as const, points: null };
      const t = matched ? applyVerifiedFind(fresh, input.clueId, deps.now(), deps.rng, deps.newId) : applyFailedAttempt(fresh, input.playerId, deps.now());
      return { game: t.game, events: t.events, outcome: matched ? ('match' as const) : ('no_match' as const), points: matched ? t.game.targets.find((x) => x.id === check.target.id)!.points : null };
    },
    async (fresh, r) => (r.outcome === 'already_found' ? fresh : games.save(r.game, r.events)),
  );

  if (outcome.outcome !== 'already_found')
    await submissions.record({ id: submissionId, roomId: game.roomId, clueId: input.clueId, playerId: input.playerId, idempotencyKey: input.idempotencyKey, imagePath, outcome: outcome.outcome, points: outcome.points, evidence, createdAt: deps.now() });
  return result(outcome.outcome, outcome.game, input.playerId, outcome.points);
}
