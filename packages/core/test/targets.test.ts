import { describe, expect, test, vi } from 'vitest';
import { JUDGE_DOWN_MESSAGE, createMemoryGameRepository, createRoom, joinRoom, prepareTarget, seededRng, submitTarget, type ClueSet, type GameError, type ImageStore, type MatchEvidence, type RoomDeps, type TargetDeps, type TargetValidation, type VisionModel } from '../src';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const CLUES: ClueSet = { first: 'one', second: 'two', visual: 'three', judgeBusy: 'four' };
const code = async (p: Promise<unknown>) => ((await p.then(() => null, (e: GameError) => e))?.code ?? null);

function setup(overrides: { vision?: Partial<VisionModel>; speak?: (text: string) => Promise<Uint8Array>; stylize?: () => Promise<Uint8Array> } = {}) {
  let n = 0;
  const games = createMemoryGameRepository();
  const files = new Map<string, Uint8Array>();
  const images: ImageStore = {
    put: async (path, bytes) => void files.set(path, bytes),
    get: async (path) => files.get(path) ?? Promise.reject(new Error('missing')),
    signedUrl: async (path) => `https://signed/${path}`,
  };
  const tasks: (() => Promise<void>)[] = [];
  const vision: VisionModel = {
    validateTarget: vi.fn(async (): Promise<TargetValidation> => ({ accepted: true, reason: null, label: 'thing' })),
    writeClues: vi.fn(async () => CLUES),
    compare: vi.fn(async (): Promise<MatchEvidence> => ({ sameObject: true, confidence: 1, matchingFeatures: [], differences: [] })),
    ...overrides.vision,
  };
  const deps: TargetDeps = {
    games,
    images,
    vision,
    speech: { speak: overrides.speak ?? (async (text) => new TextEncoder().encode(`mp3:${text}`)) },
    hints: { stylize: overrides.stylize ?? (async () => new Uint8Array([9, 9])) },
    newId: () => `id${++n}`,
    background: (task) => void tasks.push(task),
  };
  const roomDeps: RoomDeps = { games, now: () => new Date(), rng: seededRng(3), newId: deps.newId, newToken: () => `tok${++n}`, hashToken: (t) => t };
  const runBackground = async () => {
    while (tasks.length) await tasks.shift()!();
  };
  return { games, files, deps, roomDeps, vision, tasks, runBackground };
}

async function lobby(s: ReturnType<typeof setup>) {
  const ann = await createRoom(s.roomDeps, { nickname: 'Ann', timeLimitMinutes: 10 });
  const bob = await joinRoom(s.roomDeps, { code: ann.roomCode, nickname: 'Bob' });
  return { ann, bob, code: ann.roomCode };
}
const target = async (s: ReturnType<typeof setup>, c: string, playerId: string) => (await s.games.loadByCode(c))!.targets.find((t) => t.ownerId === playerId)!;

describe('submitTarget', () => {
  test('stores the photo, marks it pending and schedules preparation', async () => {
    const s = setup();
    const { ann, code: c } = await lobby(s);
    expect(await submitTarget(s.deps, { code: c, playerId: ann.playerId, bytes: JPEG })).toEqual({ validation: 'pending' });
    const t = await target(s, c, ann.playerId);
    expect(t).toMatchObject({ validation: 'pending', foundBy: null });
    expect(s.files.get(t.imagePath)).toEqual(JPEG);
    expect(s.tasks).toHaveLength(1);
  });

  test('a new upload replaces the previous target in place', async () => {
    const s = setup();
    const { ann, code: c } = await lobby(s);
    await submitTarget(s.deps, { code: c, playerId: ann.playerId, bytes: JPEG });
    await s.runBackground();
    const first = await target(s, c, ann.playerId);
    await submitTarget(s.deps, { code: c, playerId: ann.playerId, bytes: new Uint8Array([0xff, 0xd8, 7]) });
    const second = await target(s, c, ann.playerId);
    expect((await s.games.loadByCode(c))!.targets).toHaveLength(1);
    expect(second).toMatchObject({ id: first.id, validation: 'pending', assets: { prep: 'pending', clues: null } });
  });

  test('overlapping first uploads from one player leave exactly one target', async () => {
    const s = setup();
    const { ann, code: c } = await lobby(s);
    await Promise.all([
      submitTarget(s.deps, { code: c, playerId: ann.playerId, bytes: JPEG }),
      submitTarget(s.deps, { code: c, playerId: ann.playerId, bytes: new Uint8Array([0xff, 0xd8, 8]) }),
    ]);
    expect((await s.games.loadByCode(c))!.targets).toHaveLength(1);
  });

  test('a rejected retake never overwrites the live reference photo', async () => {
    const s = setup();
    const { ann, code: c } = await lobby(s);
    await submitTarget(s.deps, { code: c, playerId: ann.playerId, bytes: JPEG });
    await s.runBackground();
    const live = await target(s, c, ann.playerId);
    const put = s.deps.images.put;
    s.deps.images.put = async (path, bytes, type) => {
      await put(path, bytes, type);
      await s.games.save({ ...(await s.games.loadByCode(c))!, status: 'countdown' }, []);
    };
    expect(await code(submitTarget(s.deps, { code: c, playerId: ann.playerId, bytes: new Uint8Array([0xff, 0xd8, 9]) }))).toBe('invalid_state');
    expect((await target(s, c, ann.playerId)).imagePath).toBe(live.imagePath);
    expect(s.files.get(live.imagePath)).toEqual(JPEG);
  });

  test('rejects non-JPEG bytes and uploads after the game started', async () => {
    const s = setup();
    const { ann, code: c } = await lobby(s);
    expect(await code(submitTarget(s.deps, { code: c, playerId: ann.playerId, bytes: new Uint8Array([1, 2, 3]) }))).toBe('invalid_state');
    await s.games.save({ ...(await s.games.loadByCode(c))!, status: 'countdown' }, []);
    expect(await code(submitTarget(s.deps, { code: c, playerId: ann.playerId, bytes: JPEG }))).toBe('invalid_state');
  });
});

describe('prepareTarget', () => {
  test('accepted path fills clues, all four audio files and the hint', async () => {
    const s = setup();
    const { ann, code: c } = await lobby(s);
    await submitTarget(s.deps, { code: c, playerId: ann.playerId, bytes: JPEG });
    await s.runBackground();
    const t = await target(s, c, ann.playerId);
    expect(t.validation).toBe('accepted');
    expect(t.assets).toMatchObject({ prep: 'ready', clues: CLUES });
    for (const path of [...Object.values(t.assets.audio), t.assets.hintPath]) expect(s.files.has(path!)).toBe(true);
    expect(Object.values(t.assets.audio).every(Boolean)).toBe(true);
  });

  test('a speech failure leaves that audio null and preparation continues', async () => {
    const s = setup({ speak: async (text) => (text === 'two' ? Promise.reject(new Error('tts down')) : new TextEncoder().encode(text)) });
    const { ann, code: c } = await lobby(s);
    await submitTarget(s.deps, { code: c, playerId: ann.playerId, bytes: JPEG });
    await s.runBackground();
    const t = await target(s, c, ann.playerId);
    expect(t.assets.audio).toMatchObject({ second: null });
    expect(t.assets.audio.first).not.toBeNull();
    expect(t.assets).toMatchObject({ prep: 'ready' });
    expect(t.assets.hintPath).not.toBeNull();
  });

  test('a Fal failure leaves hintPath null but the target is ready', async () => {
    const s = setup({ stylize: async () => Promise.reject(new Error('fal down')) });
    const { ann, code: c } = await lobby(s);
    await submitTarget(s.deps, { code: c, playerId: ann.playerId, bytes: JPEG });
    await s.runBackground();
    expect((await target(s, c, ann.playerId)).assets).toMatchObject({ prep: 'ready', hintPath: null });
  });

  test('a rejection stores the reason and writes no clues', async () => {
    const s = setup({ vision: { validateTarget: vi.fn(async () => ({ accepted: false, reason: 'Too blurry', label: 'blur' })) } });
    const { ann, code: c } = await lobby(s);
    await submitTarget(s.deps, { code: c, playerId: ann.playerId, bytes: JPEG });
    await s.runBackground();
    expect(await target(s, c, ann.playerId)).toMatchObject({ validation: 'rejected', rejectReason: 'Too blurry' });
    expect(s.vision.writeClues).not.toHaveBeenCalled();
  });

  test('a vision outage marks the target rejected with a friendly retry message', async () => {
    const s = setup({ vision: { validateTarget: vi.fn(async () => Promise.reject(new Error('deadline'))) } });
    const { ann, code: c } = await lobby(s);
    await submitTarget(s.deps, { code: c, playerId: ann.playerId, bytes: JPEG });
    await s.runBackground();
    expect(await target(s, c, ann.playerId)).toMatchObject({ validation: 'rejected', rejectReason: JUDGE_DOWN_MESSAGE, assets: { prep: 'failed' } });
  });

  test('validation sees the other accepted targets so duplicates can be rejected', async () => {
    const s = setup();
    const { ann, bob, code: c } = await lobby(s);
    await submitTarget(s.deps, { code: c, playerId: ann.playerId, bytes: JPEG });
    await s.runBackground();
    await submitTarget(s.deps, { code: c, playerId: bob.playerId, bytes: new Uint8Array([0xff, 0xd8, 5]) });
    await s.runBackground();
    const calls = vi.mocked(s.vision.validateTarget).mock.calls;
    expect(calls[0]![1]).toHaveLength(0);
    expect(calls[1]![1]).toEqual([JPEG]);
  });

  test('re-running preparation on a ready target does nothing', async () => {
    const s = setup();
    const { ann, code: c } = await lobby(s);
    await submitTarget(s.deps, { code: c, playerId: ann.playerId, bytes: JPEG });
    await s.runBackground();
    const t = await target(s, c, ann.playerId);
    const version = await s.games.version(c);
    await prepareTarget(s.deps, { code: c, targetId: t.id });
    expect(s.vision.validateTarget).toHaveBeenCalledTimes(1);
    expect(s.vision.writeClues).toHaveBeenCalledTimes(1);
    expect(await s.games.version(c)).toBe(version);
  });
});
