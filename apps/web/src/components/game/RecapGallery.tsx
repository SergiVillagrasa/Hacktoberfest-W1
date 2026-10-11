'use client';

import type { RecapItem } from '@snaphunt/contracts';
import { PlayButton } from '@/components/clues/PlayButton';
import { playClue } from '@/lib/audio';
import { recapSummary } from '@/lib/results';

export function RecapGallery({ items }: { items: RecapItem[] }) {
  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => (
        <article key={item.targetId} className="sh-card flex flex-col gap-3 p-3">
          <h3 className="text-lg text-ink">{item.ownerNickname}&apos;s object</h3>
          <div className="grid grid-cols-2 gap-2">
            <figure className="flex flex-col gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.originalUrl} alt={`${item.ownerNickname}'s secret object`} className="aspect-square w-full rounded-xl border-2 border-line object-cover" />
              <figcaption className="text-sm font-bold text-ink-soft">The secret object</figcaption>
            </figure>
            <figure className="flex flex-col gap-1">
              {item.findPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.findPhotoUrl} alt={`The photo that found ${item.ownerNickname}'s object`} className="aspect-square w-full rounded-xl border-2 border-leaf object-cover" />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center rounded-xl border-2 border-dashed border-line-deep p-2 text-center text-sm font-bold text-ink-soft">Not found</div>
              )}
              <figcaption className="text-sm font-bold text-ink-soft">The find</figcaption>
            </figure>
          </div>
          <p className={`text-base font-bold ${item.finderNickname ? 'text-leaf-edge' : 'text-ink-soft'}`}>{recapSummary(item)}</p>
          {item.clueText ? <p className="text-base text-ink">&ldquo;{item.clueText}&rdquo;</p> : null}
          {item.clueAudioUrl ? <PlayButton label="clue" onPlay={() => void playClue(item.clueAudioUrl!)} /> : null}
          {item.hintUrl ? (
            <figure className="flex flex-col gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.hintUrl} alt="The picture clue" className="mx-auto max-h-56 rounded-xl border-2 border-line object-contain" />
              <figcaption className="text-sm font-bold text-ink-soft">The picture clue</figcaption>
            </figure>
          ) : null}
        </article>
      ))}
    </div>
  );
}
