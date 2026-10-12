import type { FeedItem } from '@snaphunt/contracts';
import type { MascotState } from '@/components/mascot/states';

export type HostClip = 'welcome' | 'countdown' | 'find' | 'eliminated' | 'solo' | 'winner';

export interface Announcement {
  state: MascotState;
  line: string;
  clip: HostClip | null;
}

export const feedKey = (item: FeedItem) => `${item.at}|${item.type}|${item.text}`;

/** How the host reacts to something that just happened in the game. */
export function announcementFor(item: FeedItem, ownPlayerId?: string): Announcement | null {
  if (item.type === 'target_found' && item.hunterId !== undefined && item.hunterId === ownPlayerId) return null;
  switch (item.type) {
    case 'target_found':
      return { state: 'celebrating', line: item.text, clip: 'find' };
    case 'player_eliminated':
      return { state: 'shocked', line: item.text, clip: 'eliminated' };
    case 'visual_clue_issued':
      return { state: 'talking', line: item.text, clip: null };
    case 'player_out_of_attempts':
      return { state: 'sad', line: item.text, clip: null };
    case 'solo_mode':
      return { state: 'talking', line: item.text, clip: 'solo' };
    case 'game_finished':
      return { state: 'trophy', line: item.text, clip: 'winner' };
    default:
      return null;
  }
}

/** Feed items the viewer has not seen yet, oldest first. */
export function freshItems(seen: ReadonlySet<string>, feed: readonly FeedItem[]): FeedItem[] {
  return feed.filter((item) => !seen.has(feedKey(item)));
}
