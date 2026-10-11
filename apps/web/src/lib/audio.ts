export interface AudioLike {
  src: string;
  currentTime: number;
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
export async function playClue(url: string, create: () => AudioLike = make): Promise<boolean> {
  shared ??= create();
  shared.src = url;
  shared.currentTime = 0;
  try {
    await shared.play();
    return true;
  } catch {
    return false;
  }
}

export function stopClue(): void {
  shared?.pause();
}

export function resetAudioForTests(): void {
  shared = null;
  unlocked = false;
}
