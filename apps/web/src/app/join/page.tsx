'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { Mascot } from '@/components/mascot/Mascot';
import { Field } from '@/components/ui/Field';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { unlockAudio } from '@/lib/audio';
import { api, errorMessage } from '@/lib/client';
import { NICKNAME_MAX, ROOM_CODE_LENGTH, cleanNickname, isRoomCode, normalizeRoomCode } from '@/lib/forms';
import { saveSession } from '@/lib/session';

function JoinForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState(() => normalizeRoomCode(params.get('code') ?? ''));
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = cleanNickname(nickname);
  const ready = isRoomCode(code) && name.length > 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready || busy) return;
    void unlockAudio();
    setBusy(true);
    setError(null);
    try {
      const session = await api.joinRoom(code, { nickname: name });
      saveSession(session.roomCode, session);
      router.push(`/room/${session.roomCode}`);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <ScreenShell back="/">
      <Mascot state={error ? 'sad' : busy ? 'thinking' : 'idle'} size="md" line={error ?? (busy ? 'Finding your room...' : 'Got a room code? Type it in!')} />
      <form onSubmit={submit} className="flex flex-1 flex-col gap-5">
        <Field
          label="Room code"
          value={code}
          onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
          maxLength={ROOM_CODE_LENGTH}
          placeholder="ABCDE"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="code-input"
          aria-invalid={error !== null && !isRoomCode(code)}
          required
        />
        <Field label="Your nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={NICKNAME_MAX} placeholder="Sam" autoComplete="nickname" autoCapitalize="words" enterKeyHint="done" required />
        <div className="mt-auto">
          <button type="submit" className="chunky w-full" disabled={!ready || busy}>
            {busy ? 'Joining...' : 'Join room'}
          </button>
        </div>
      </form>
    </ScreenShell>
  );
}

export default function JoinPage() {
  return (
    <Suspense>
      <JoinForm />
    </Suspense>
  );
}
