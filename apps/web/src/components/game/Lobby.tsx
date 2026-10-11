'use client';

import type { RoomView } from '@snaphunt/contracts';
import { useState } from 'react';
import { CaptureButton } from '@/components/camera/CaptureButton';
import { Mascot } from '@/components/mascot/Mascot';
import type { MascotState } from '@/components/mascot/states';
import { api, errorMessage } from '@/lib/client';
import { BASE_PATH } from '@/lib/base-path';
import { canStart, shareUrl, startHint } from '@/lib/lobby';

interface LobbyProps {
  code: string;
  token: string;
  view: RoomView;
  refresh: () => void;
}

export function Lobby({ code, token, view, refresh }: LobbyProps) {
  const [uploading, setUploading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const target = view.myTarget;
  const isCreator = view.me.isCreator;
  const everyoneReady = canStart(view);

  async function uploadPhoto(photo: Blob) {
    setUploading(true);
    setProblem(null);
    try {
      await api.uploadTarget(code, token, photo);
      refresh();
    } catch (e) {
      setProblem(errorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  async function start() {
    setStarting(true);
    setProblem(null);
    try {
      await api.startGame(code, token);
      refresh();
    } catch (e) {
      setProblem(errorMessage(e));
    } finally {
      setStarting(false);
    }
  }

  async function remove(playerId: string) {
    try {
      await api.removePlayer(code, token, playerId);
      refresh();
    } catch (e) {
      setProblem(errorMessage(e));
    }
  }

  async function copy(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(message);
    } catch {
      setNotice(`Your code is ${code}`);
    }
    setTimeout(() => setNotice(null), 2500);
  }

  async function share() {
    const url = shareUrl(window.location.origin, code, BASE_PATH);
    if (navigator.share) {
      try {
        await navigator.share({ title: 'SnapHunt', text: `Join my SnapHunt room ${code}`, url });
        return;
      } catch {
        return;
      }
    }
    await copy(url, 'Invite link copied!');
  }

  const mascot = hostMood({ uploading, problem, validation: target?.validation, reason: target?.rejectReason, isCreator, everyoneReady });

  return (
    <div className="flex flex-1 flex-col gap-5">
      <section className="sh-card flex flex-col items-center gap-2 px-4 py-4 text-center">
        <p className="text-sm text-ink-soft">Friends join with this code</p>
        <p className="font-display text-5xl leading-none tracking-[0.18em] text-leaf" aria-label={`Room code ${code.split('').join(' ')}`}>
          {code}
        </p>
        <div className="mt-1 flex gap-2">
          <button type="button" className="chunky chunky-secondary chunky-sm" onClick={() => void copy(code, 'Code copied!')}>
            Copy code
          </button>
          <button type="button" className="chunky chunky-secondary chunky-sm" onClick={() => void share()}>
            Share
          </button>
        </div>
        <p role="status" className="min-h-5 text-sm font-bold text-leaf-edge">
          {notice}
        </p>
      </section>

      <Mascot state={mascot.state} line={mascot.line} size="sm" />

      <section className="flex flex-col gap-3">
        <h2 className="text-xl text-ink">Your secret object</h2>
        {target?.imageUrl ? (
          <div className="sh-card flex items-center gap-3 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={target.imageUrl} alt="Your secret object" className="size-20 shrink-0 rounded-xl border-2 border-line object-cover" />
            <div className="flex flex-1 flex-col gap-1">
              <TargetStatus validation={target.validation} reason={target.rejectReason} />
            </div>
          </div>
        ) : (
          <p className="text-base text-ink-soft">Pick something nearby that a friend could find, then snap it. Keep it secret!</p>
        )}
        <CaptureButton onPhoto={(photo) => void uploadPhoto(photo)} onError={setProblem} variant={target ? 'secondary' : 'primary'} disabled={uploading}>
          {uploading ? 'Sending...' : target ? 'Retake photo' : 'Take a photo'}
        </CaptureButton>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl text-ink">
          Players <span className="tabular text-ink-soft">({view.players.length}/6)</span>
        </h2>
        <ul className="flex flex-col gap-2">
          {view.players.map((player) => (
            <li key={player.id} className={`sh-card flex items-center gap-2 px-3 py-2.5 ${player.ready ? 'sh-card-selected' : ''}`}>
              <span className="flex-1 truncate text-lg font-bold text-ink">
                {player.nickname}
                {player.id === view.me.playerId ? <span className="text-ink-soft"> (you)</span> : null}
              </span>
              {player.isCreator ? <span className="sh-badge sh-badge-host">Host</span> : null}
              <span className={`sh-badge ${player.ready ? 'sh-badge-ready' : ''}`}>{player.ready ? 'Ready' : 'Not ready'}</span>
              {isCreator && player.id !== view.me.playerId ? (
                <button type="button" className="chunky chunky-secondary chunky-sm" onClick={() => void remove(player.id)} aria-label={`Remove ${player.nickname}`}>
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="text-sm text-ink-soft">
          The hunt lasts <span className="tabular font-bold text-ink">{Math.round(view.timeLimitMs / 60000)} minutes</span>.
        </p>
      </section>

      <div className="mt-auto flex flex-col gap-2 pt-2">
        {isCreator ? (
          <>
            <button type="button" className="chunky w-full" disabled={!everyoneReady || starting} onClick={() => void start()}>
              {starting ? 'Starting...' : 'Start game'}
            </button>
            <p className="text-center text-sm text-ink-soft">{startHint(view)}</p>
          </>
        ) : (
          <p className="text-center text-base text-ink-soft">Waiting for the host to start the game.</p>
        )}
      </div>
    </div>
  );
}

function TargetStatus({ validation, reason }: { validation: 'pending' | 'accepted' | 'rejected'; reason: string | null }) {
  if (validation === 'pending')
    return (
      <p className="flex items-center gap-2 text-base font-bold text-ink">
        <span className="sh-spinner" aria-hidden="true" /> The judge is looking...
      </p>
    );
  if (validation === 'accepted') return <p className="text-base font-bold text-leaf-edge">Accepted! Keep it secret.</p>;
  return <p className="text-base font-bold text-bow">{reason ?? "That one won't work. Try another object."}</p>;
}

function hostMood(input: { uploading: boolean; problem: string | null; validation?: 'pending' | 'accepted' | 'rejected'; reason?: string | null; isCreator: boolean; everyoneReady: boolean }): { state: MascotState; line: string } {
  if (input.problem) return { state: 'sad', line: input.problem };
  if (input.uploading) return { state: 'thinking', line: 'Sending your photo...' };
  if (input.validation === 'pending') return { state: 'thinking', line: 'Hmm, let me take a look...' };
  if (input.validation === 'rejected') return { state: 'sad', line: input.reason ?? "That one won't work. Try another object." };
  if (input.validation === 'accepted') return input.isCreator && input.everyoneReady ? { state: 'celebrating', line: "Everyone's ready. Start when you are!" } : { state: 'talking', line: 'Great pick! Keep it secret.' };
  return { state: 'idle', line: 'Pick a secret object nearby and snap it!' };
}
