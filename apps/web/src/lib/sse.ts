'use client';

import { RoomView } from '@snaphunt/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createApi } from './api';
import { clearSession, getSession } from './session';

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

/** A rejected session or a missing room can never recover by retrying. */
function fatalCodeOf(error: unknown): string | null {
  const status = (error as { status?: number } | null)?.status;
  return status === 401 || status === 403 ? 'forbidden' : status === 404 ? 'not_found' : null;
}

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
  const stop = (code: string) => {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    source?.close();
    onConnected(false);
    onFatal?.(code);
  };
  const resync = () =>
    void fetchView().then(
      (view) => !stopped && deliver(view),
      (error) => {
        const code = fatalCodeOf(error);
        if (code) stop(code);
      },
    );

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
        stop(body.code);
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

export interface RoomViewState {
  view: RoomView | null;
  connected: boolean;
  error: string | null;
  /** serverNow minus the phone's clock when the latest view arrived; add it to Date.now() to read server time. */
  clockOffsetMs: number;
  refresh: () => void;
}

export function useRoomView(code: string): RoomViewState {
  const [view, setView] = useState<RoomView | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const streamRef = useRef<{ resync: () => void } | null>(null);
  const refresh = useCallback(() => streamRef.current?.resync(), []);

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
      onView: (next) => {
        setView(next);
        setClockOffsetMs(Date.parse(next.serverNow) - Date.now());
      },
      onConnected: setConnected,
      onFatal: (reason) => {
        clearSession(code);
        setError(reason);
      },
    });
    streamRef.current = stream;
    const wake = () => document.visibilityState === 'visible' && stream.resync();
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', stream.resync);
    return () => {
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', stream.resync);
      streamRef.current = null;
      stream.close();
    };
  }, [code]);

  return { view, connected, error, clockOffsetMs, refresh };
}
