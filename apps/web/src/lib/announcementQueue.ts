import type { MascotState } from '@/components/mascot/states';
import type { HostClip } from './announcements';

export interface Moment {
  state: MascotState;
  line: string;
  clip?: HostClip | null;
  /** Shortest time the moment stays on screen, in milliseconds. */
  holdMs?: number;
  /** Scroll the host into view when this moment starts. */
  scroll?: boolean;
}

export interface QueueDeps {
  show: (moment: Moment | null) => void;
  /** Starts a host clip; resolves false when the browser blocks playback. `onEnd` fires when it finishes. */
  playClip: (clip: HostClip, onEnd: () => void) => Promise<boolean>;
  setBusy: (busy: boolean) => void;
}

export const DEFAULT_HOLD_MS = 2800;
export const MAX_HOLD_MS = 7000;

/**
 * Plays the host's reactions one after another: each stays up for at least its hold time and until its clip
 * has finished (or a hard cap), so simultaneous events are never talked over.
 */
export function createAnnouncementQueue({ show, playClip, setBusy }: QueueDeps) {
  const waiting: Moment[] = [];
  let running = false;
  let timers: ReturnType<typeof setTimeout>[] = [];

  function next() {
    timers.forEach(clearTimeout);
    timers = [];
    const moment = waiting.shift();
    if (!moment) {
      running = false;
      show(null);
      setBusy(false);
      return;
    }
    running = true;
    setBusy(true);
    show(moment);
    let held = false;
    let ended = !moment.clip;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      next();
    };
    const check = () => held && ended && finish();
    timers.push(
      setTimeout(() => {
        held = true;
        check();
      }, moment.holdMs ?? DEFAULT_HOLD_MS),
      setTimeout(finish, MAX_HOLD_MS),
    );
    if (moment.clip) {
      void playClip(moment.clip, () => {
        ended = true;
        check();
      }).then((started) => {
        if (!started) {
          ended = true;
          check();
        }
      });
    }
  }

  return {
    push(moment: Moment) {
      waiting.push(moment);
      if (!running) next();
    },
    clear() {
      waiting.length = 0;
      timers.forEach(clearTimeout);
      timers = [];
      running = false;
    },
  };
}
