import type { ClueView } from '@snaphunt/contracts';
import type { ReactNode } from 'react';
import { PlayButton } from './PlayButton';

interface VoiceClueCardProps {
  clue: ClueView;
  onPlay: (url: string, text: string) => void;
  onSecondClue: () => void;
  asking: boolean;
  submit: ReactNode;
}

export function VoiceClueCard({ clue, onPlay, onSecondClue, asking, submit }: VoiceClueCardProps) {
  return (
    <section className="sh-card flex flex-col gap-3 p-4" aria-label="Your clue">
      <h2 className="text-xl text-ink">Your clue</h2>
      <p className="text-lg font-bold leading-snug text-ink">{clue.text ?? 'The host is warming up...'}</p>
      {clue.audioUrl ? <PlayButton label="clue" replay onPlay={() => onPlay(clue.audioUrl!, clue.text ?? '')} /> : null}

      {clue.secondClueUsed && clue.secondText ? (
        <div className="rounded-xl bg-leaf-soft p-3">
          <p className="text-base font-bold text-ink">{clue.secondText}</p>
          {clue.secondAudioUrl ? (
            <div className="mt-2">
              <PlayButton label="second clue" replay onPlay={() => onPlay(clue.secondAudioUrl!, clue.secondText!)} />
            </div>
          ) : null}
        </div>
      ) : (
        <button type="button" className="chunky chunky-secondary chunky-sm" disabled={asking} onClick={onSecondClue}>
          {asking ? 'Asking...' : 'Second clue (-25% points)'}
        </button>
      )}

      {clue.judgeBusyText ? (
        <div className="rounded-xl bg-sun/40 p-3">
          <p className="text-base font-bold text-ink">{clue.judgeBusyText}</p>
          {clue.judgeBusyAudioUrl ? (
            <div className="mt-2">
              <PlayButton label="bonus hint" replay onPlay={() => onPlay(clue.judgeBusyAudioUrl!, clue.judgeBusyText!)} />
            </div>
          ) : null}
        </div>
      ) : null}

      {submit}
    </section>
  );
}
