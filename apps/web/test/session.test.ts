import { describe, expect, test } from 'vitest';
import { clearSession, getSession, saveSession, type SessionStorage } from '../src/lib/session';

const memory = (): SessionStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
};
const session = { roomCode: 'ABCDE', playerId: 'p1', token: 't1' };

describe('session storage', () => {
  test('round-trips under snaphunt:{CODE} regardless of case', () => {
    const s = memory();
    saveSession('abcde', session, s);
    expect([...s.data.keys()]).toEqual(['snaphunt:ABCDE']);
    expect(getSession('ABCDE', s)).toEqual(session);
    expect(getSession('ZZZZZ', s)).toBeNull();
  });

  test('corrupt or foreign data is discarded instead of crashing', () => {
    const s = memory();
    s.setItem('snaphunt:ABCDE', '{not json');
    expect(getSession('ABCDE', s)).toBeNull();
    expect(s.data.size).toBe(0);
    s.setItem('snaphunt:ABCDE', JSON.stringify({ token: 1 }));
    expect(getSession('ABCDE', s)).toBeNull();
    expect(s.data.size).toBe(0);
  });

  test('clearSession removes it and a missing storage is a safe no-op', () => {
    const s = memory();
    saveSession('ABCDE', session, s);
    clearSession('abcde', s);
    expect(getSession('ABCDE', s)).toBeNull();
    saveSession('ABCDE', session, null);
    expect(getSession('ABCDE', null)).toBeNull();
  });
});
