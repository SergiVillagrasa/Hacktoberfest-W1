import type { RoomView } from '@snaphunt/contracts';

export const MIN_PLAYERS = 2;

export function canStart(view: Pick<RoomView, 'players'>): boolean {
  return view.players.length >= MIN_PLAYERS && view.players.every((p) => p.ready);
}

export function startHint(view: Pick<RoomView, 'players'>): string {
  if (view.players.length < MIN_PLAYERS) return 'Waiting for at least one friend to join.';
  const waiting = view.players.filter((p) => !p.ready).length;
  if (waiting > 0) return waiting === 1 ? 'Waiting for 1 player to be ready.' : `Waiting for ${waiting} players to be ready.`;
  return "Everyone's ready. Start when you are!";
}

export function shareUrl(origin: string, code: string, basePath = ''): string {
  return `${origin}${basePath}/join?code=${code}`;
}
