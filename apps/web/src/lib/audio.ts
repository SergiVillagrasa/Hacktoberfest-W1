import { withBase } from './base-path';

export interface AudioLike {
  src: string;
  currentTime: number;
  onended?: ((event: Event) => unknown) | null;
  play(): Promise<void>;
  pause(): void;
}

const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=';

let shared: AudioLike | null = null;
let unlocked = false;

const make = (): AudioLike => new Audio();

export function unlockAudio(create: () => AudioLike = make): Promise<boolean> {
  if (unlocked) return Promise.resolve(true);
  shared ??= create();
  shared.src = SILENT_WAV;
  return shared.play().then(
    () => {
      shared?.pause();
      unlocked = true;
      return true;
    },
    () => false,
  );
}

/** Plays a clue on the element unlocked by the first tap. Resolves false when the browser blocks it, so the UI can fall back to text. */
export async function playClue(url: string, create: () => AudioLike = make, onEnd?: () => void): Promise<boolean> {
  shared ??= create();
  shared.src = url;
  shared.currentTime = 0;
  shared.onended = onEnd ? () => onEnd() : null;
  try {
    await shared.play();
    return true;
  } catch {
    return false;
  }
}

/** Plays one of the static host announcements from `public/voice`. */
export function playHostClip(name: string, create: () => AudioLike = make, onEnd?: () => void): Promise<boolean> {
  return playClue(withBase(`/voice/${name}.mp3`), create, onEnd);
}

export function stopClue(): void {
  if (shared) shared.onended = null;
  shared?.pause();
}

export const audioUnlocked = () => unlocked;

export function resetAudioForTests(): void {
  shared = null;
  unlocked = false;
}
