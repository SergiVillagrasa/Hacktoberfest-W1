export const LOW_TIME_MS = 60_000;

/** Milliseconds until an ISO instant, measured on the server's clock via the phone's offset. */
export function msUntil(iso: string | null, clockOffsetMs: number, nowMs: number): number {
  return iso ? Date.parse(iso) - (nowMs + clockOffsetMs) : 0;
}

/** Whole seconds shown on the countdown: 5, 4, 3, 2, 1, then 0 for "Go". */
export function countdownNumber(msLeft: number): number {
  return Math.max(0, Math.ceil(msLeft / 1000));
}

/** m:ss, rounding up so the clock only reads 0:00 once time is really up. */
export function formatClock(msLeft: number): string {
  const total = Math.max(0, Math.ceil(msLeft / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
