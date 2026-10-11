'use client';

import { LOW_TIME_MS, formatClock, msUntil } from '@/lib/clock';
import { useNow } from '@/lib/useNow';

interface TimerProps {
  endsAt: string | null;
  clockOffsetMs: number;
}

export function Timer({ endsAt, clockOffsetMs }: TimerProps) {
  const msLeft = msUntil(endsAt, clockOffsetMs, useNow(250));
  const low = msLeft <= LOW_TIME_MS;
  return (
    <p className={`tabular font-display text-3xl font-extrabold leading-none ${low ? 'text-bow' : 'text-ink'}`} role="timer" aria-label="Time left">
      {formatClock(msLeft)}
    </p>
  );
}
