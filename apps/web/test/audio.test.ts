import { beforeEach, describe, expect, test } from 'vitest';
import { playClue, resetAudioForTests, stopClue, unlockAudio, type AudioLike } from '../src/lib/audio';

function fakeAudio(opts: { blockFirst?: boolean } = {}) {
  const log: string[] = [];
  let blocked = !!opts.blockFirst;
  const audio: AudioLike = {
    src: '',
    currentTime: 5,
    play: async () => {
      log.push(`play:${audio.src.startsWith('data:') ? 'silent' : audio.src}`);
      if (blocked) {
        blocked = false;
        throw new Error('NotAllowedError');
      }
    },
    pause: () => void log.push('pause'),
  };
  return { audio, log };
}

beforeEach(() => resetAudioForTests());

describe('audio', () => {
  test('the first tap unlocks one shared element with silence, later clues reuse it', async () => {
    const { audio, log } = fakeAudio();
    let created = 0;
    const create = () => (created++, audio);
    expect(await unlockAudio(create)).toBe(true);
    expect(await unlockAudio(create)).toBe(true);
    expect(await playClue('https://cdn/clue.mp3', create)).toBe(true);
    expect(created).toBe(1);
    expect(log).toEqual(['play:silent', 'pause', 'play:https://cdn/clue.mp3']);
    expect(audio.currentTime).toBe(0);
  });

  test('a blocked unlock reports false and can be retried on the next tap', async () => {
    const { audio } = fakeAudio({ blockFirst: true });
    expect(await unlockAudio(() => audio)).toBe(false);
    expect(await unlockAudio(() => audio)).toBe(true);
  });

  test('a blocked clue resolves false so the UI can show the text instead', async () => {
    const { audio } = fakeAudio({ blockFirst: true });
    expect(await playClue('https://cdn/clue.mp3', () => audio)).toBe(false);
  });

  test('stopClue pauses and is safe before anything played', async () => {
    stopClue();
    const { audio, log } = fakeAudio();
    await playClue('https://cdn/a.mp3', () => audio);
    stopClue();
    expect(log.at(-1)).toBe('pause');
  });
});
