'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect } from 'react';
import { Lobby } from '@/components/game/Lobby';
import { Mascot } from '@/components/mascot/Mascot';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { useRoomView } from '@/lib/sse';
import { getSession } from '@/lib/session';

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const code = use(params).code.toUpperCase();
  const router = useRouter();
  const { view, connected, error, refresh } = useRoomView(code);
  const token = typeof window === 'undefined' ? null : getSession(code)?.token ?? null;

  useEffect(() => {
    if (error === 'no_session') router.replace(`/join?code=${code}`);
  }, [error, code, router]);

  if (error && error !== 'no_session') {
    return (
      <ScreenShell>
        <Mascot state="sad" size="md" line="You're not part of this room anymore, or it no longer exists." />
        <Link href="/" className="chunky mt-auto">
          Back to start
        </Link>
      </ScreenShell>
    );
  }

  if (!view || !token) {
    return (
      <ScreenShell>
        <Mascot state="thinking" size="md" line="Joining the room..." />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      {!connected ? (
        <p role="status" className="rounded-xl bg-sun px-3 py-2 text-center text-sm font-bold text-ink">
          Reconnecting...
        </p>
      ) : null}
      {view.status === 'lobby' ? (
        <Lobby code={code} token={token} view={view} refresh={refresh} />
      ) : (
        <Mascot state="talking" size="md" line="The game has started!" />
      )}
    </ScreenShell>
  );
}
