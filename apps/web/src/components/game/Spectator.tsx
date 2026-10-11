'use client';

import type { RoomView } from '@snaphunt/contracts';
import { Mascot } from '@/components/mascot/Mascot';
import { spectatorReason } from '@/lib/results';
import { useHostMood } from '@/lib/useHostMood';
import { Feed } from './Feed';
import { Scoreboard } from './Scoreboard';
import { Timer } from './Timer';

interface SpectatorProps {
  view: RoomView;
  clockOffsetMs: number;
}

export function Spectator({ view, clockOffsetMs }: SpectatorProps) {
  const reason = spectatorReason(view.me.status);
  const { moment } = useHostMood(view.feed);
  const mood = moment ?? { state: reason.state, line: reason.line };

  return (
    <div className="flex flex-1 flex-col gap-5">
      <header className="sticky top-0 z-10 -mx-5 flex items-center justify-between gap-3 border-b-2 border-line bg-white px-5 py-2.5">
        <Timer endsAt={view.endsAt} clockOffsetMs={clockOffsetMs} />
        <span className="sh-badge">Watching</span>
      </header>

      <section className="sh-card flex flex-col items-center gap-1 p-4 text-center" aria-label="Your status">
        <h1 className="text-2xl text-ink">{reason.title}</h1>
        <p className="text-base text-ink-soft">You can still see everyone's clues and the live scores.</p>
      </section>

      <Mascot state={mood.state} line={mood.line} size="md" />

      {view.spectatorClues.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl text-ink">What the hunters are chasing</h2>
          {view.spectatorClues.map((clue) => (
            <article key={clue.id} className={`sh-card flex gap-3 p-3 ${clue.kind === 'visual' ? 'sh-card-info' : ''}`}>
              {clue.hintUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={clue.hintUrl} alt="A drawing of an object a hunter is looking for" className="size-24 shrink-0 rounded-xl border-2 border-line object-contain" />
              ) : null}
              <div className="flex flex-1 flex-col gap-1">
                <p className="text-sm font-bold text-ink-soft">{clue.kind === 'visual' ? 'Picture clue' : 'Spoken clue'}</p>
                <p className="text-base font-bold leading-snug text-ink">{clue.text ?? 'The host is warming up...'}</p>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-xl text-ink">Scoreboard</h2>
        <Scoreboard players={view.players} meId={view.me.playerId} />
      </section>

      <section className="flex flex-col gap-2 pb-2">
        <h2 className="text-xl text-ink">Latest</h2>
        <Feed items={view.feed} limit={6} />
      </section>
    </div>
  );
}
