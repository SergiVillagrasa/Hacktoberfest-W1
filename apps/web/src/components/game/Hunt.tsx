'use client';

import type { ClueView, RoomView, SubmitResult } from '@snaphunt/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { VisualClueCard } from '@/components/clues/VisualClueCard';
import { VoiceClueCard } from '@/components/clues/VoiceClueCard';
import { Mascot } from '@/components/mascot/Mascot';
import { playClue } from '@/lib/audio';
import { api, errorMessage } from '@/lib/client';
import { acceptJudgementResult, unseenJudgementResults } from '@/lib/judgements';
import { scrollToTop } from '@/lib/scroll';
import { useHostMood, type Mood } from '@/lib/useHostMood';
import { AttemptsDots } from './AttemptsDots';
import { Feed } from './Feed';
import { Scoreboard } from './Scoreboard';
import { SubmitFlow } from './SubmitFlow';
import { Timer } from './Timer';

interface HuntProps {
  code: string;
  token: string;
  view: RoomView;
  clockOffsetMs: number;
  refresh: () => void;
}

const IDLE: Mood = { state: 'idle', line: 'Find it and snap it!' };

export function Hunt({ code, token, view, clockOffsetMs, refresh }: HuntProps) {
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [asking, setAsking] = useState(false);
  const spokenClues = useRef(new Set<string>());
  const bonusPlayed = useRef(new Set<string>());
  const seenSubmissions = useRef(new Set<string>());
  const me = view.players.find((p) => p.id === view.me.playerId);
  const clues = view.myClues.filter((c) => c.status === 'active');
  const { moment, announcing, announce, say, stayQuiet } = useHostMood(view.feed, view.me.playerId);

  const speak = useCallback((url: string, text: string) => {
    setSpeaking(text);
    void playClue(url, undefined, () => setSpeaking(null)).then((ok) => !ok && setSpeaking(null));
  }, []);

  // Read each new clue aloud once, after the host has finished reacting; it stays on screen as text either way.
  useEffect(() => {
    if (announcing) return;
    for (const clue of clues) {
      if (clue.audioUrl && !spokenClues.current.has(clue.id)) {
        spokenClues.current.add(clue.id);
        speak(clue.audioUrl, clue.text ?? '');
      }
      if (clue.judgeBusyAudioUrl && clue.judgeBusyText && !bonusPlayed.current.has(clue.id)) {
        bonusPlayed.current.add(clue.id);
        speak(clue.judgeBusyAudioUrl, clue.judgeBusyText);
      }
    }
  }, [clues, speak, announcing]);

  useEffect(() => {
    for (const result of unseenJudgementResults(view.myClues, seenSubmissions.current)) {
      reactToResult(result);
    }
  }, [view.myClues]);

  function reactToResult(result: SubmitResult) {
    stayQuiet(8000);
    const points = result.points ? ` +${result.points} points` : '';
    if (result.outcome === 'match') announce({ state: 'celebrating', line: `${result.message}${points}`, clip: 'find', holdMs: 4500, scroll: true });
    else if (result.outcome === 'no_match') say('sad', `${result.message} ${result.attemptsLeft} ${result.attemptsLeft === 1 ? 'try' : 'tries'} left.`, 4500, true);
    else if (result.outcome === 'judge_busy') say('talking', result.message, 4500, true);
    else say('shocked', result.message, 4500, true);
    refresh();
  }

  function onResult(result: SubmitResult) {
    if (!acceptJudgementResult(result, seenSubmissions.current)) {
      refresh();
      return;
    }
    reactToResult(result);
  }

  async function secondClue(clueId: string) {
    setAsking(true);
    try {
      await api.requestSecondClue(code, token, clueId);
      refresh();
    } catch (e) {
      say('sad', errorMessage(e));
    } finally {
      setAsking(false);
    }
  }

  const mood: Mood = sending ? { state: 'thinking', line: 'Hmm, let me take a look...' } : moment ?? (speaking ? { state: 'talking', line: speaking } : IDLE);
  const submit = (clue: ClueView, label: string) => (
    <SubmitFlow
      code={code}
      token={token}
      clueId={clue.id}
      label={label}
      disabled={sending}
      submission={clue.submission}
      onSending={(now) => {
        setSending(now);
        if (now) scrollToTop();
      }}
      onResult={onResult}
      onProblem={(message) => say('sad', message, 4500, true)}
    />
  );

  return (
    <div className="flex flex-1 flex-col gap-5">
      <header className="sticky top-0 z-10 -mx-5 flex items-center justify-between gap-3 border-b-2 border-line bg-white px-5 py-2.5">
        <Timer endsAt={view.endsAt} clockOffsetMs={clockOffsetMs} />
        <AttemptsDots left={view.me.attemptsLeft} />
        <p className="tabular text-right font-display text-lg font-bold leading-tight text-ink">
          {me?.score ?? 0}
          <span className="block text-xs font-bold text-ink-soft">points</span>
        </p>
      </header>

      <Mascot state={mood.state} line={mood.line} size="md" />

      {clues.length === 0 ? (
        <section className="sh-card p-4 text-center">
          <h2 className="text-xl text-ink">Nice work!</h2>
          <p className="mt-1 text-base text-ink-soft">You have no clue right now. Watch the scoreboard while the others finish.</p>
        </section>
      ) : (
        clues.map((clue) =>
          clue.kind === 'visual' ? (
            <VisualClueCard key={clue.id} clue={clue} onPlay={speak} submit={submit(clue, 'Found it? Take a photo')} />
          ) : (
            <VoiceClueCard key={clue.id} clue={clue} onPlay={speak} asking={asking} onSecondClue={() => void secondClue(clue.id)} submit={submit(clue, 'Found it? Take a photo')} />
          ),
        )
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-xl text-ink">Scoreboard</h2>
        <Scoreboard players={view.players} meId={view.me.playerId} />
      </section>

      <section className="flex flex-col gap-2 pb-2">
        <h2 className="text-xl text-ink">Latest</h2>
        <Feed items={view.feed} />
      </section>
    </div>
  );
}
