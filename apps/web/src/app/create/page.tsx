'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Mascot } from '@/components/mascot/Mascot';
import { Field } from '@/components/ui/Field';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { TimeLimitPicker } from '@/components/ui/TimeLimitPicker';
import { unlockAudio } from '@/lib/audio';
import { api, errorMessage } from '@/lib/client';
import { NICKNAME_MAX, cleanNickname, type TimeLimit } from '@/lib/forms';
import { saveSession } from '@/lib/session';

export default function CreatePage() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [minutes, setMinutes] = useState<TimeLimit>(15);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = cleanNickname(nickname);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name || busy) return;
    void unlockAudio();
    setBusy(true);
    setError(null);
    try {
      const session = await api.createRoom({ nickname: name, timeLimitMinutes: minutes });
      saveSession(session.roomCode, session);
      router.push(`/room/${session.roomCode}`);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <ScreenShell back="/">
      <Mascot state={error ? 'sad' : busy ? 'thinking' : 'idle'} size="md" line={error ?? (busy ? 'Setting up your room...' : "Let's set up your game!")} />
      <form onSubmit={submit} className="flex flex-1 flex-col gap-5">
        <Field label="Your nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={NICKNAME_MAX} placeholder="Alex" autoComplete="nickname" autoCapitalize="words" enterKeyHint="done" required />
        <TimeLimitPicker value={minutes} onChange={setMinutes} />
        <div className="mt-auto">
          <button type="submit" className="chunky w-full" disabled={!name || busy}>
            {busy ? 'Creating...' : 'Create room'}
          </button>
        </div>
      </form>
    </ScreenShell>
  );
}
