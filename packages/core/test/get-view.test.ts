import { RoomView } from '@snaphunt/contracts';
import { describe, expect, test } from 'vitest';
import { createMemoryGameRepository, getView, type Game, type ImageStore } from '../src';
import { T0, makeClue, makeGame, makePlayer, makeTarget } from './fixtures';

const images: ImageStore = { put: async () => {}, get: async () => new Uint8Array(), signedUrl: async (path) => `https://signed/${path}` };
const deps = () => ({ games: createMemoryGameRepository(), images });
const assetsFor = (n: string) => ({
  prep: 'ready' as const,
  clues: { first: `first-${n}`, second: `second-${n}`, visual: `visual-${n}`, judgeBusy: `busy-${n}` },
  audio: { first: `audio-first-${n}.mp3`, second: `audio-second-${n}.mp3`, visual: `audio-visual-${n}.mp3`, judgeBusy: `audio-busy-${n}.mp3` },
  hintPath: `hint-${n}.webp`,
});

function activeGame(overrides: Partial<Game> = {}): Game {
  return makeGame({
    players: ['a', 'b', 'c'].map((id) => makePlayer(id)),
    targets: ['a', 'b', 'c'].map((id) => makeTarget(`t${id}`, id, { imagePath: `photo-${id}.jpg`, assets: assetsFor(id) })),
    clues: [makeClue('ca', 'tb', 'a'), makeClue('cb', 'tc', 'b'), makeClue('cc', 'ta', 'c')],
    ...overrides,
  });
}
const view = (game: Game, id: string) => getView(deps(), game, id, T0);

describe('getView visibility', () => {
  test('an active hunter never sees another unresolved target photo or hint', async () => {
    const v = await view(activeGame(), 'a');
    expect(RoomView.safeParse(v).success).toBe(true);
    const json = JSON.stringify(v);
    for (const secret of ['photo-b.jpg', 'photo-c.jpg', 'hint-b', 'hint-c', 'first-c', 'first-a']) expect(json).not.toContain(secret);
    expect(v.myClues).toMatchObject([{ id: 'ca', text: 'first-b', audioUrl: 'https://signed/audio-first-b.mp3', secondText: null, judgeBusyText: null, hintUrl: null }]);
    expect(v.spectatorClues).toEqual([]);
    expect(v.myTarget).toMatchObject({ imageUrl: 'https://signed/photo-a.jpg' });
    expect(v.ranking).toBeNull();
    expect(v.recap).toBeNull();
  });

  test('second and judge-busy texts appear only after they were used or served', async () => {
    const g = activeGame();
    g.clues[0] = makeClue('ca', 'tb', 'a', { secondClueUsed: true });
    expect((await view(g, 'a')).myClues[0]).toMatchObject({ secondText: 'second-b', secondAudioUrl: 'https://signed/audio-second-b.mp3', judgeBusyText: null });
    g.clues[0] = makeClue('ca', 'tb', 'a', { judgeBusyServed: true });
    expect((await view(g, 'a')).myClues[0]).toMatchObject({ judgeBusyText: 'busy-b', judgeBusyAudioUrl: 'https://signed/audio-busy-b.mp3', secondText: null });
  });

  test('a visual clue shows its hint and short text to its own hunter only', async () => {
    const g = activeGame();
    g.clues.push(makeClue('va', 'tc', 'a', { kind: 'visual' }));
    const mine = await view(g, 'a');
    expect(mine.myClues.find((c) => c.id === 'va')).toMatchObject({ text: 'visual-c', hintUrl: 'https://signed/hint-c.webp', audioUrl: 'https://signed/audio-visual-c.mp3' });
    expect(JSON.stringify(await view(g, 'b'))).not.toContain('hint-c');
  });

  test('an eliminated spectator sees everyone else\'s active clues with texts and hints', async () => {
    const g = activeGame();
    g.players[0]!.status = 'eliminated';
    g.clues[0]!.status = 'lost';
    g.clues.push(makeClue('vb', 'ta', 'b', { kind: 'visual' }));
    const v = await view(g, 'a');
    expect(v.spectatorClues.map((c) => c.id).sort()).toEqual(['cb', 'cc', 'vb']);
    expect(v.spectatorClues.find((c) => c.id === 'vb')).toMatchObject({ hintUrl: 'https://signed/hint-a.webp' });
    expect(v.spectatorClues.find((c) => c.id === 'cb')).toMatchObject({ text: 'first-c' });
  });

  test('lobby and countdown show no clue texts or audio, only your own target', async () => {
    const lobby = activeGame({ status: 'lobby' });
    lobby.clues = [];
    const v = await view(lobby, 'b');
    expect(v.myClues).toEqual([]);
    expect(v.myTarget).toMatchObject({ validation: 'accepted', imageUrl: 'https://signed/photo-b.jpg' });
    expect(v.players.every((p) => p.ready)).toBe(true);
    const countdown = await view(activeGame({ status: 'countdown' }), 'a');
    expect(countdown.myClues[0]).toMatchObject({ text: null, audioUrl: null });
    expect(JSON.stringify(countdown)).not.toContain('first-b');
  });

  test('finished games reveal ranking and recap with originals', async () => {
    const g = activeGame({ status: 'finished' });
    g.targets[1] = { ...g.targets[1]!, foundBy: 'a', foundAt: T0, points: 900 };
    const v = await view(g, 'c');
    expect(RoomView.safeParse(v).success).toBe(true);
    expect(v.ranking![0]).toMatchObject({ playerId: 'a', score: 900, rank: 1 });
    expect(v.recap).toHaveLength(3);
    expect(v.recap!.find((r) => r.targetId === 'tb')).toMatchObject({ ownerNickname: 'B', finderNickname: 'A', originalUrl: 'https://signed/photo-b.jpg', points: 900 });
  });

  test('me.attemptsLeft and unknown players', async () => {
    const g = activeGame();
    g.players[0]!.failedAttempts = 2;
    expect((await view(g, 'a')).me).toMatchObject({ attemptsLeft: 3, failedAttempts: 2, status: 'active' });
    await expect(view(g, 'zzz')).rejects.toMatchObject({ code: 'not_found' });
  });

  test('the feed turns domain events into friendly lines using nicknames', async () => {
    const d = deps();
    const g = activeGame();
    await d.games.create(g, {});
    const saved = await d.games.save(g, [{ type: 'target_found', at: T0, targetId: 'tb', hunterId: 'a', points: 900, kind: 'voice' }]);
    const v = await getView(d, saved, 'b', T0);
    expect(v.feed).toMatchObject([{ type: 'target_found', text: 'A found a target (+900)', photoUrl: null }]);
    expect(JSON.stringify(v.feed)).not.toContain('tb');
  });
});
