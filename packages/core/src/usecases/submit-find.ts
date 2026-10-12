import type { SubmitResult } from '@snaphunt/contracts';
import { JUDGE_BUDGET_MS, JUDGE_HARD_BUDGET_MS, MATCH_THRESHOLD } from '../domain/constants';
import { GameError } from '../domain/errors';
import { advanceClock, applyFailedAttempt, applyVerifiedFind } from '../domain/game';
import { sniffImageType } from '../domain/image-type';
import type { DomainEvent, Game, IdGen, Judgement, Rng } from '../domain/types';
import type { GameRepository, ImageStore, MatchEvidence, SubmissionRepository, VisionModel } from '../ports';
import { storagePaths } from '../ports/image-store';
import { JUDGEMENT_GRACE_MS, JUDGE_ENDED_MESSAGE, JUDGE_RETRY_MESSAGE, judgeResult, judgementSubmission, pendingResult } from './judging';
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
  background: (task: () => Promise<void>) => void;
  judgeBudgetMs?: number;
  judgeHardBudgetMs?: number;
}

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

const diagnose = (stage: string, startedAt: number, error: unknown) => {
  const status = (error as { status?: unknown } | null)?.status;
  console.warn('submitFind judge', { stage, elapsedMs: Date.now() - startedAt, error: error instanceof Error ? error.name : 'unknown', ...(typeof status === 'number' ? { status } : {}) });
};

async function serveBonus(deps: FindDeps, code: string, clueId: string, judgementId: string): Promise<Game> {
  let seen!: Game;
  await updateGame(
    deps.games,
    code,
    (fresh) => {
      seen = fresh;
      const clue = fresh.clues.find((c) => c.id === clueId);
      if (clue?.judgement?.id !== judgementId || clue.judgement.result || clue.judgeBusyServed) return fresh;
      return { ...fresh, clues: fresh.clues.map((c) => (c.id === clueId ? { ...c, judgeBusyServed: true } : c)) };
    },
    (fresh, next) => (next === fresh ? Promise.resolve(fresh) : deps.games.save(next, [])),
  );
  return seen;
}

const scope = (prior: { playerId: string; clueId: string; roomId: string }, input: { playerId: string; clueId: string }, roomId: string) => {
  if (prior.playerId !== input.playerId || prior.clueId !== input.clueId || prior.roomId !== roomId) throw new GameError('forbidden', 'Idempotency key belongs to another submission');
};

async function reportPending(deps: FindDeps, input: { code: string; playerId: string; clueId: string }, judgementId: string): Promise<SubmitResult> {
  const fresh = await serveBonus(deps, input.code, input.clueId, judgementId);
  const j = fresh.clues.find((c) => c.id === input.clueId)?.judgement;
  if (j?.id === judgementId && j.result) return j.result;
  return pendingResult(fresh, input.playerId, judgementId);
}

async function judge(deps: FindDeps, input: { code: string; playerId: string; clueId: string; bytes: Uint8Array }, targetImagePath: string, judgement: Judgement): Promise<SubmitResult | null> {
  const startedAt = Date.now();
  const hard = deps.judgeHardBudgetMs ?? JUDGE_HARD_BUDGET_MS;
  let evidence: MatchEvidence | null = null;
  try {
    evidence = await withDeadline(async (signal) => {
      const reference = await deps.images.get(targetImagePath);
      signal.throwIfAborted();
      return deps.vision.compare(reference, input.bytes, signal);
    }, hard);
  } catch (error) {
    diagnose('compare', startedAt, error);
  }
  const matched = !!evidence && evidence.sameObject && evidence.confidence >= MATCH_THRESHOLD;

  const applied = await updateGame(
    deps.games,
    input.code,
    (loaded) => {
      const { game: fresh, events: tickEvents } = advanceClock(loaded, deps.now());
      const clue = fresh.clues.find((c) => c.id === input.clueId);
      const current = clue?.judgement;
      if (!clue || current?.id !== judgement.id) return { kind: 'stale' as const, game: loaded, events: [] as DomainEvent[], result: null as SubmitResult | null, submission: null };
      if (current.result) return { kind: 'stale' as const, game: loaded, events: [] as DomainEvent[], result: current.result, submission: null };
      const player = fresh.players.find((p) => p.id === input.playerId);
      const target = fresh.targets.find((t) => t.id === clue.targetId)!;
      let next = fresh;
      let events = tickEvents;
      let res: SubmitResult;
      if (target.foundBy !== null) {
        res = judgeResult('already_found', fresh, input.playerId, null, { submissionId: judgement.id, pending: false });
      } else if (fresh.status !== 'active' || clue.status !== 'active' || player?.status !== 'active') {
        res = judgeResult('judge_busy', fresh, input.playerId, null, { message: JUDGE_ENDED_MESSAGE, submissionId: judgement.id, pending: false });
      } else if (!evidence || current.expiresAt <= deps.now().getTime()) {
        res = judgeResult('judge_busy', fresh, input.playerId, null, { message: JUDGE_RETRY_MESSAGE, submissionId: judgement.id, pending: false });
      } else {
        const t = matched ? applyVerifiedFind(fresh, input.clueId, deps.now(), deps.rng, deps.newId) : applyFailedAttempt(fresh, input.playerId, deps.now());
        next = t.game;
        events = [...events, ...t.events];
        const points = matched ? t.game.targets.find((x) => x.id === target.id)!.points : null;
        res = judgeResult(matched ? 'match' : 'no_match', next, input.playerId, points, { submissionId: judgement.id, pending: false });
      }
      next = { ...next, clues: next.clues.map((c) => (c.id === input.clueId ? { ...c, judgement: { ...current, result: res } } : c)) };
      return {
        kind: 'apply' as const,
        game: next,
        events,
        result: res,
        submission: judgementSubmission(judgement, fresh.roomId, input.clueId, input.playerId, res, evidence, new Date(judgement.startedAt)),
      };
    },
    async (fresh, r) => (r.kind === 'apply' ? deps.games.save(r.game, r.events, undefined, [r.submission!]) : fresh),
  );
  return applied.result;
}

export async function submitFind(deps: FindDeps, input: { code: string; playerId: string; clueId: string; bytes: Uint8Array; idempotencyKey: string }): Promise<SubmitResult> {
  const { games, submissions, images } = deps;
  const game = await tick(deps, input.code);

  const prior = await submissions.findByKey(input.idempotencyKey);
  if (prior) {
    scope(prior, input, game.roomId);
    const current = game.clues.find((c) => c.id === prior.clueId)?.judgement;
    if (current?.id === prior.id && current.result) return current.result;
    if (prior.outcome === 'pending') return reportPending(deps, input, prior.id);
    return judgeResult(prior.outcome, game, input.playerId, prior.points, { submissionId: prior.id, pending: false });
  }

  const pre = precheck(game, input.playerId, input.clueId);
  if (pre.alreadyFound) return judgeResult('already_found', game, input.playerId);
  if (pre.clue.judgement && !pre.clue.judgement.result) return reportPending(deps, input, pre.clue.judgement.id);

  const contentType = sniffImageType(input.bytes);
  if (!contentType) throw new GameError('invalid_state', 'Please send a JPEG, PNG or WebP photo');
  const submissionId = deps.newId();
  const imagePath = storagePaths.submission(game.roomId, submissionId);
  await images.put(imagePath, input.bytes, contentType);

  const hard = deps.judgeHardBudgetMs ?? JUDGE_HARD_BUDGET_MS;
  const startedAt = deps.now().getTime();
  const judgement: Judgement = { id: submissionId, idempotencyKey: input.idempotencyKey, imagePath, startedAt, expiresAt: startedAt + hard + JUDGEMENT_GRACE_MS, result: null };

  type Reserved = { kind: 'reserve' | 'found' | 'pending' | 'done' | 'reject'; game: Game; events?: DomainEvent[]; judgement?: Judgement; result?: SubmitResult | null; error?: GameError };
  let reservation: Reserved;
  try {
    reservation = await updateGame(
      games,
      input.code,
      async (fresh): Promise<Reserved> => {
        const again = await submissions.findByKey(input.idempotencyKey);
        if (again) {
          scope(again, input, fresh.roomId);
          return { kind: 'done', game: fresh, judgement: { ...judgement, id: again.id }, result: again.outcome === 'pending' ? null : judgeResult(again.outcome, fresh, input.playerId, again.points, { submissionId: again.id, pending: false }) };
        }
        const { game: clocked, events } = advanceClock(fresh, deps.now());
        let check: ReturnType<typeof precheck>;
        try {
          check = precheck(clocked, input.playerId, input.clueId);
        } catch (e) {
          if (e instanceof GameError && (e.code === 'clue_not_active' || e.code === 'not_active_player')) return { kind: 'reject', game: clocked, events, error: e };
          throw e;
        }
        if (check.alreadyFound) return { kind: 'found', game: clocked, events };
        const current = check.clue.judgement;
        if (current && !current.result) return { kind: 'pending', game: clocked, events, judgement: current };
        return { kind: 'reserve', game: { ...clocked, clues: clocked.clues.map((c) => (c.id === input.clueId ? { ...c, judgement } : c)) }, events };
      },
      async (fresh, r) =>
        r.kind === 'reserve'
          ? games.save(r.game, r.events ?? [], undefined, [judgementSubmission(judgement, r.game.roomId, input.clueId, input.playerId, null, null, deps.now())])
          : r.events?.length
            ? games.save(r.game, r.events)
            : r.game,
    );
  } catch (error) {
    const again = error instanceof GameError && error.code === 'forbidden' ? await submissions.findByKey(input.idempotencyKey) : null;
    if (!again) throw error;
    scope(again, input, game.roomId);
    if (again.outcome === 'pending') return reportPending(deps, input, again.id);
    return judgeResult(again.outcome, game, input.playerId, again.points, { submissionId: again.id, pending: false });
  }

  if (reservation.kind === 'reject') throw reservation.error;
  if (reservation.kind === 'found') return judgeResult('already_found', reservation.game, input.playerId);
  if (reservation.kind === 'done' && reservation.result) return reservation.result;
  if (reservation.kind !== 'reserve') return reportPending(deps, input, (reservation.judgement ?? judgement).id);

  const completion = judge(deps, input, pre.target.imagePath, judgement).catch((error) => (diagnose('apply', startedAt, error), null));
  deps.background(() => completion.then(() => {}));

  const soft = deps.judgeBudgetMs ?? JUDGE_BUDGET_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const early = await Promise.race([completion, new Promise<null>((resolve) => (timer = setTimeout(() => resolve(null), soft)))]);
  clearTimeout(timer);
  if (early) return early;

  return reportPending(deps, input, judgement.id);
}
