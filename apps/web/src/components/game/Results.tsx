'use client';

import type { RoomView } from '@snaphunt/contracts';
import Link from 'next/link';
import { useEffect } from 'react';
import { Mascot } from '@/components/mascot/Mascot';
import { playHostClip } from '@/lib/audio';
import { hasTieBreak, winnerLine } from '@/lib/results';
import { RecapGallery } from './RecapGallery';

export function Results({ view }: { view: RoomView }) {
  const ranking = view.ranking ?? [];
  const host = winnerLine(ranking, view.me.playerId);

  useEffect(() => {
    void playHostClip('winner');
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <Mascot state={host.state} line={host.line} size="lg" />

      <section className="flex flex-col gap-2" aria-label="Final ranking">
        <h1 className="text-3xl text-leaf">Final ranking</h1>
        <ol className="flex flex-col gap-2">
          {ranking.map((entry) => (
            <li key={entry.playerId} className={`sh-card flex items-center gap-3 px-3 py-3 ${entry.playerId === view.me.playerId ? 'sh-card-selected' : ''}`}>
              <span className={`tabular w-8 text-center font-display text-2xl font-extrabold ${entry.rank === 1 ? 'text-leaf' : 'text-ink-soft'}`}>{entry.rank}</span>
              <span className="flex-1 truncate text-lg font-bold text-ink">
                {entry.nickname}
                {entry.playerId === view.me.playerId ? <span className="text-ink-soft"> (you)</span> : null}
              </span>
              {entry.rank === 1 && entry.score > 0 ? <span className="sh-badge sh-badge-host">Winner</span> : null}
              <span className="text-right">
                <span className="tabular block font-display text-xl font-bold text-ink">{entry.score}</span>
                <span className="tabular block text-xs font-bold text-ink-soft">
                  {entry.finds} {entry.finds === 1 ? 'find' : 'finds'}
                </span>
              </span>
            </li>
          ))}
        </ol>
        {hasTieBreak(ranking) ? <p className="text-sm text-ink-soft">Ties are decided by who made their last find first.</p> : null}
      </section>

      <section className="flex flex-col gap-3" aria-label="Recap">
        <h2 className="text-2xl text-ink">The hunt in photos</h2>
        <RecapGallery items={view.recap ?? []} />
      </section>

      <Link href="/" className="chunky mt-auto">
        Play again
      </Link>
    </div>
  );
}
