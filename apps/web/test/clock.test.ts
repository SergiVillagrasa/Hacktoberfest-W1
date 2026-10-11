import { describe, expect, test } from 'vitest';
import { feedKey, announcementFor, freshItems } from '../src/lib/announcements';
import { countdownNumber, formatClock, msUntil } from '../src/lib/clock';

describe('clock', () => {
  test('time is read on the server clock through the phone offset', () => {
    // Phone is 3 s behind the server: serverNow - phoneNow = +3000.
    expect(msUntil('2026-10-11T10:00:10.000Z', 3000, Date.parse('2026-10-11T10:00:04.000Z'))).toBe(3000);
    expect(msUntil(null, 0, 0)).toBe(0);
  });

  test('the countdown shows 5 down to 1 and then 0 for go', () => {
    expect([5000, 4200, 1000, 999, 1, 0, -300].map(countdownNumber)).toEqual([5, 5, 1, 1, 1, 0, 0]);
  });

  test('the clock reads m:ss, rounds up and never goes negative', () => {
    expect(formatClock(15 * 60_000)).toBe('15:00');
    expect(formatClock(61_001)).toBe('1:02');
    expect(formatClock(59_000)).toBe('0:59');
    expect(formatClock(1)).toBe('0:01');
    expect(formatClock(-500)).toBe('0:00');
  });
});

describe('announcements', () => {
  const item = (type: string, text: string, at = '2026-10-11T10:00:00.000Z') => ({ at, type, text, photoUrl: null });

  test('each game event has a host reaction and unknown events are ignored', () => {
    expect(announcementFor(item('target_found', 'Ann found a target (+900)'))).toMatchObject({ state: 'celebrating', clip: 'find' });
    expect(announcementFor(item('player_eliminated', 'Bob was knocked out by Ann'))).toMatchObject({ state: 'shocked', clip: 'eliminated' });
    expect(announcementFor(item('solo_mode', 'Solo hunt!'))).toMatchObject({ clip: 'solo' });
    expect(announcementFor(item('game_finished', 'Game over!'))).toMatchObject({ state: 'trophy', clip: 'winner' });
    expect(announcementFor(item('player_out_of_attempts', 'Cy is out'))).toMatchObject({ state: 'sad', clip: null });
    expect(announcementFor(item('game_started', 'The hunt is on!'))).toBeNull();
  });

  test('only items the viewer has not seen are fresh', () => {
    const feed = [item('target_found', 'a', '2026-10-11T10:00:01.000Z'), item('solo_mode', 'b', '2026-10-11T10:00:02.000Z')];
    const seen = new Set([feedKey(feed[0]!)]);
    expect(freshItems(seen, feed)).toEqual([feed[1]]);
    expect(freshItems(new Set(), feed)).toHaveLength(2);
    expect(freshItems(new Set(feed.map(feedKey)), feed)).toEqual([]);
  });
});
