'use client';

import type { FeedItem } from '@snaphunt/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MascotState } from '@/components/mascot/states';
import { announcementFor, feedKey, freshItems } from './announcements';
import { createAnnouncementQueue, type Moment } from './announcementQueue';
import { playHostClip } from './audio';
import { scrollToTop } from './scroll';

export interface Mood {
  state: MascotState;
  line: string;
}

/**
 * The host's reactions: what the player just did and what happens around the table, played one after another.
 * History is not replayed on first load, and the player's own result is not talked over.
 */
export function useHostMood(feed: FeedItem[], ownPlayerId?: string) {
  const [moment, setMoment] = useState<Mood | null>(null);
  const [announcing, setAnnouncing] = useState(false);
  const seen = useRef<Set<string> | null>(null);
  const quietUntil = useRef(0);
  const queue = useRef<ReturnType<typeof createAnnouncementQueue> | null>(null);

  useEffect(() => {
    queue.current = createAnnouncementQueue({
      show: (m) => {
        setMoment(m ? { state: m.state, line: m.line } : null);
        if (m?.scroll) scrollToTop();
      },
      playClip: (clip, onEnd) => playHostClip(clip, undefined, onEnd),
      setBusy: setAnnouncing,
    });
    return () => queue.current?.clear();
  }, []);

  const announce = useCallback((m: Moment) => queue.current?.push(m), []);
  const say = useCallback((state: MascotState, line: string, holdMs?: number, scroll = false) => announce({ state, line, holdMs, scroll }), [announce]);
  const stayQuiet = useCallback((ms: number) => {
    quietUntil.current = Date.now() + ms;
  }, []);

  useEffect(() => {
    if (seen.current === null) {
      seen.current = new Set(feed.map(feedKey));
      return;
    }
    for (const item of freshItems(seen.current, feed)) {
      seen.current.add(feedKey(item));
      const announcement = announcementFor(item, ownPlayerId);
      if (announcement && Date.now() >= quietUntil.current) announce(announcement);
    }
  }, [feed, announce, ownPlayerId]);

  return { moment, announcing, announce, say, stayQuiet };
}
