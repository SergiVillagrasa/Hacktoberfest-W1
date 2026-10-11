'use client';

import type { RoomView } from '@snaphunt/contracts';
import { useEffect } from 'react';
import { Mascot } from '@/components/mascot/Mascot';
import { playHostClip } from '@/lib/audio';
import { countdownNumber, msUntil } from '@/lib/clock';
import { useNow } from '@/lib/useNow';

interface CountdownProps {
  view: RoomView;
  clockOffsetMs: number;
}

export function Countdown({ view, clockOffsetMs }: CountdownProps) {
  const now = useNow(100);
  const number = countdownNumber(msUntil(view.countdownEndsAt, clockOffsetMs, now));

  useEffect(() => {
    void playHostClip('countdown');
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <Mascot state="countdown" size="lg" line={number > 0 ? 'Get ready to hunt!' : 'Go find it!'} />
      <p className="tabular font-display text-9xl font-extrabold leading-none text-leaf" role="timer" aria-live="off" aria-label={number > 0 ? `${number} seconds to start` : 'Go'}>
        {number > 0 ? number : 'Go!'}
      </p>
    </div>
  );
}
