import { GameError } from '../domain/errors';
import type { Game, IdGen, Target } from '../domain/types';
import type { GameRepository, ImageStore, HintGenerator, SpeechSynth, VisionModel } from '../ports';
import { storagePaths } from '../ports/image-store';
import { mutateGame } from './rooms';

export interface TargetDeps {
  games: GameRepository;
  images: ImageStore;
  vision: VisionModel;
  speech: SpeechSynth;
  hints: HintGenerator;
  newId: IdGen;
  background: (task: () => Promise<void>) => void;
}

export const JUDGE_DOWN_MESSAGE = "The judge couldn't look at that photo, try again";
const VISION_TIMEOUT_MS = 35_000;
const HINT_URL_TTL_SECONDS = 600;
const AUDIO_KINDS = ['first', 'second', 'visual', 'judgeBusy'] as const;

const emptyAssets = (): Target['assets'] => ({ prep: 'pending', clues: null, audio: { first: null, second: null, visual: null, judgeBusy: null }, hintPath: null });
const isJpeg = (bytes: Uint8Array) => bytes.length > 2 && bytes[0] === 0xff && bytes[1] === 0xd8;

export async function submitTarget(deps: TargetDeps, input: { code: string; playerId: string; bytes: Uint8Array }): Promise<{ validation: 'pending' }> {
  if (!isJpeg(input.bytes)) throw new GameError('invalid_state', 'Please send a JPEG photo');
  const game = await deps.games.loadByCode(input.code);
  if (!game) throw new GameError('not_found', 'Room not found');
  if (game.status !== 'lobby') throw new GameError('invalid_state', 'The game already started');
  if (!game.players.some((p) => p.id === input.playerId)) throw new GameError('not_found', 'Player not found');

  const imagePath = storagePaths.target(game.roomId, deps.newId());
  await deps.images.put(imagePath, input.bytes, 'image/jpeg');
  const newTargetId = deps.newId();
  let targetId = newTargetId;
  await mutateGame(deps.games, input.code, (g) => {
    if (g.status !== 'lobby') throw new GameError('invalid_state', 'The game already started');
    const existing = g.targets.find((t) => t.ownerId === input.playerId);
    targetId = existing?.id ?? newTargetId;
    const fresh: Target = { id: targetId, ownerId: input.playerId, imagePath, validation: 'pending', rejectReason: null, foundBy: null, foundAt: null, points: null, assets: emptyAssets() };
    return { ...g, targets: existing ? g.targets.map((t) => (t.ownerId === input.playerId ? fresh : t)) : [...g.targets, fresh] };
  });
  deps.background(() => prepareTarget(deps, { code: input.code, targetId }));
  return { validation: 'pending' };
}

export async function prepareTarget(deps: TargetDeps, input: { code: string; targetId: string }): Promise<void> {
  const { games, images, vision, speech, hints } = deps;
  const game = await games.loadByCode(input.code);
  const target = game?.targets.find((t) => t.id === input.targetId);
  if (!game || !target) return;
  const needsValidation = target.validation === 'pending';
  if (!needsValidation && !(target.validation === 'accepted' && target.assets.prep === 'pending')) return;

  const update = (change: (t: Target) => Target) => mutateGame(games, input.code, (g): Game => ({ ...g, targets: g.targets.map((t) => (t.id === input.targetId ? change(t) : t)) }));
  const judgeDown = () => update((t) => ({ ...t, validation: 'rejected', rejectReason: JUDGE_DOWN_MESSAGE, assets: { ...t.assets, prep: 'failed' } }));
  const signal = AbortSignal.timeout(VISION_TIMEOUT_MS);

  let image: Uint8Array;
  try {
    image = await images.get(target.imagePath);
    if (needsValidation) {
      const others = await Promise.all(game.targets.filter((t) => t.id !== target.id && t.validation === 'accepted').map((t) => images.get(t.imagePath)));
      const verdict = await vision.validateTarget(image, others, signal);
      await update((t) => ({ ...t, validation: verdict.accepted ? 'accepted' : 'rejected', rejectReason: verdict.accepted ? null : verdict.reason ?? 'That photo will not work, try another object' }));
      if (!verdict.accepted) return;
    }
  } catch {
    await judgeDown();
    return;
  }

  let clues = target.assets.clues;
  if (!clues) {
    try {
      clues = await vision.writeClues(image, signal);
    } catch {
      await judgeDown();
      return;
    }
    const written = clues;
    await update((t) => ({ ...t, assets: { ...t.assets, clues: written } }));
  }

  const audio = { ...target.assets.audio };
  for (const kind of AUDIO_KINDS) {
    try {
      const path = storagePaths.audio(game.roomId, target.id, kind);
      await images.put(path, await speech.speak(clues[kind]), 'audio/mpeg');
      audio[kind] = path;
    } catch {
      audio[kind] = null;
    }
  }

  let hintPath: string | null = null;
  try {
    const path = storagePaths.hint(game.roomId, target.id);
    await images.put(path, await hints.stylize(await images.signedUrl(target.imagePath, HINT_URL_TTL_SECONDS)), 'image/webp');
    hintPath = path;
  } catch {
    hintPath = null;
  }

  await update((t) => ({ ...t, assets: { ...t.assets, audio, hintPath, prep: 'ready' } }));
}
