'use client';

import { RoomView } from '@snaphunt/contracts';
import { useEffect, useState } from 'react';
import { createApi } from './api';
import { getSession } from './session';

export interface EventSourceLike {
  readyState: number;
  close(): void;
  addEventListener(type: string, listener: (event: any) => void): void;
}

export interface RoomStreamOptions {
  url: string;
  fetchView: () => Promise<RoomView>;
  onView: (view: RoomView) => void;
  onConnected: (connected: boolean) => void;
  onFatal?: (code: string) => void;
  EventSourceCtor?: new (url: string) => EventSourceLike;
  maxBackoffMs?: number;
}

const CLOSED = 2;
const FATAL_CODES = new Set(['forbidden', 'not_found']);

export function connectRoomStream({ url, fetchView, onView, onConnected, onFatal, EventSourceCtor = EventSource, maxBackoffMs = 8000 }: RoomStreamOptions) {
  let source: EventSourceLike | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let attempt = 0;
  let version = -1;

  const deliver = (view: RoomView) => {
    if (view.version < version) return;
    version = view.version;
    onView(view);
  };
  const resync = () => void fetchView().then((view) => !stopped && deliver(view), () => {});

  function open() {
    if (stopped) return;
    source = new EventSourceCtor(url);
    source.addEventListener('open', () => {
      attempt = 0;
      onConnected(true);
    });
    source.addEventListener('view', (event) => {
      const parsed = RoomView.safeParse(safeJson(event.data));
      if (parsed.success) {
        onConnected(true);
        deliver(parsed.data);
      }
    });
    source.addEventListener('error', (event) => {
      onConnected(false);
      const body = typeof event?.data === 'string' ? (safeJson(event.data) as { code?: string } | null) : null;
      if (body?.code && FATAL_CODES.has(body.code)) {
        stopped = true;
        source?.close();
        onFatal?.(body.code);
      } else if (source?.readyState === CLOSED) {
        source.close();
        timer = setTimeout(() => (resync(), open()), Math.min(500 * 2 ** attempt++, maxBackoffMs));
      }
    });
  }

  resync();
  open();
  return {
    resync,
    close() {
      stopped = true;
      clearTimeout(timer);
      source?.close();
    },
  };
}

function safeJson(raw: unknown): unknown {
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function useRoomView(code: string): { view: RoomView | null; connected: boolean; error: string | null } {
  const [view, setView] = useState<RoomView | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = getSession(code);
    if (!session) {
      setError('no_session');
      return;
    }
    const api = createApi();
    const stream = connectRoomStream({
      url: api.eventsUrl(code, session.token),
      fetchView: () => api.getRoom(code, session.token),
      onView: setView,
      onConnected: setConnected,
      onFatal: setError,
    });
    const wake = () => document.visibilityState === 'visible' && stream.resync();
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', stream.resync);
    return () => {
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', stream.resync);
      stream.close();
    };
  }, [code]);

  return { view, connected, error };
}
