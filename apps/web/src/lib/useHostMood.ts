'use client';

import type { FeedItem } from '@snaphunt/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MascotState } from '@/components/mascot/states';
import { announcementFor, feedKey, freshItems } from './announcements';
import { playHostClip } from './audio';
import { scrollToTop } from './scroll';

export interface Mood {
  state: MascotState;
  line: string;
}

/**
 * The host's short-lived reactions: whatever the player just did, plus what happens around the table.
 * History is not replayed on first load, and the player's own result is not talked over.
 */
export function useHostMood(feed: FeedItem[]) {
  const [moment, setMoment] = useState<Mood | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const seen = useRef<Set<string> | null>(null);
  const quietUntil = useRef(0);

  const say = useCallback((state: MascotState, line: string, ms = 4500, bringIntoView = false) => {
    clearTimeout(timer.current);
    setMoment({ state, line });
    timer.current = setTimeout(() => setMoment(null), ms);
    if (bringIntoView) scrollToTop();
  }, []);

  const stayQuiet = useCallback((ms: number) => {
    quietUntil.current = Date.now() + ms;
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (seen.current === null) {
      seen.current = new Set(feed.map(feedKey));
      return;
    }
    for (const item of freshItems(seen.current, feed)) {
      seen.current.add(feedKey(item));
      const announcement = announcementFor(item);
      if (!announcement || Date.now() < quietUntil.current) continue;
      say(announcement.state, announcement.line);
      if (announcement.clip) void playHostClip(announcement.clip);
    }
  }, [feed, say]);

  return { moment, say, stayQuiet };
}
