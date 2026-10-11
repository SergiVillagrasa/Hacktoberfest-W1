import { SessionResponse } from '@snaphunt/contracts';

export interface SessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const keyFor = (code: string) => `snaphunt:${code.toUpperCase()}`;
const browserStorage = (): SessionStorage | null => (typeof window === 'undefined' ? null : window.localStorage);

export function saveSession(code: string, session: SessionResponse, storage: SessionStorage | null = browserStorage()): void {
  storage?.setItem(keyFor(code), JSON.stringify(session));
}

export function getSession(code: string, storage: SessionStorage | null = browserStorage()): SessionResponse | null {
  const raw = storage?.getItem(keyFor(code));
  if (!raw) return null;
  try {
    const parsed = SessionResponse.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
  } catch {
    // fall through to cleanup
  }
  storage?.removeItem(keyFor(code));
  return null;
}

export function clearSession(code: string, storage: SessionStorage | null = browserStorage()): void {
  storage?.removeItem(keyFor(code));
}
