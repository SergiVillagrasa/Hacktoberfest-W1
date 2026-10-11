import type { ClueView } from '@snaphunt/contracts';
import type { ReactNode } from 'react';
import { PlayButton } from './PlayButton';

interface VisualClueCardProps {
  clue: ClueView;
  onPlay: (url: string, text: string) => void;
  submit: ReactNode;
}

export function VisualClueCard({ clue, onPlay, submit }: VisualClueCardProps) {
  return (
    <section className="sh-card sh-card-info flex flex-col gap-3 p-4" aria-label="Picture clue">
      <h2 className="text-xl text-ink">Picture clue</h2>
      <p className="text-base text-ink-soft">Find this object before its hunter does!</p>
      {clue.hintUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={clue.hintUrl} alt="A drawing of the object you are looking for" className="mx-auto max-h-72 w-full rounded-xl border-2 border-line object-contain" />
      ) : clue.hintStatus === 'unavailable' ? (
        <div className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line-deep p-4 text-center">
          <p className="text-base font-bold text-ink">No picture this time.</p>
          <p className="text-sm text-ink-soft">Use the spoken clue below to find it.</p>
        </div>
      ) : (
        <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line-deep p-4 text-center">
          <span className="sh-spinner" aria-hidden="true" />
          <p className="text-base font-bold text-ink">Drawing your clue...</p>
        </div>
      )}
      {clue.text ? <p className="text-lg font-bold leading-snug text-ink">{clue.text}</p> : null}
      {clue.audioUrl ? <PlayButton label="clue" replay onPlay={() => onPlay(clue.audioUrl!, clue.text ?? '')} /> : null}
      {submit}
    </section>
  );
}
