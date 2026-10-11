import { GameError } from './errors';
import { shuffle } from './rng';
import type { Rng } from './types';

export function createDerangement(ids: readonly string[], rng: Rng): Map<string, string> {
  if (ids.length < 2) throw new GameError('invalid_state', 'A derangement needs at least 2 ids');
  for (;;) {
    const owners = shuffle(ids, rng);
    if (owners.every((owner, i) => owner !== ids[i])) return new Map(ids.map((id, i) => [id, owners[i]!]));
  }
}
