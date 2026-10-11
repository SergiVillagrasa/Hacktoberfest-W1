import type { Clue, Game, Player, Target } from './types';

const isActive = (c: Clue) => c.status === 'active';
const unresolved = (game: Game): Target[] => game.targets.filter((t) => t.foundBy === null);

export function voiceHunterOf(game: Game, targetId: string): Player | null {
  const clue = game.clues.find((c) => isActive(c) && c.kind === 'voice' && c.targetId === targetId);
  return game.players.find((p) => p.id === clue?.hunterId) ?? null;
}

export function eligibleVisualTargets(game: Game, hunterId: string): Target[] {
  if (game.clues.some((c) => isActive(c) && c.kind === 'visual' && c.hunterId === hunterId)) return [];
  return unresolved(game).filter((t) => {
    if (t.ownerId === hunterId) return false;
    const active = game.clues.filter((c) => isActive(c) && c.targetId === t.id);
    if (active.some((c) => c.hunterId === hunterId || c.kind === 'visual')) return false;
    const voice = voiceHunterOf(game, t.id);
    return voice ? voice.status === 'active' : true;
  });
}

export function isRacePossible(game: Game): boolean {
  if (game.clues.some((c) => isActive(c) && c.kind === 'visual')) return false;
  const open = unresolved(game);
  return game.players.some(
    (p) =>
      p.status === 'active' &&
      game.clues.some((c) => isActive(c) && c.hunterId === p.id && open.some((x) => x.id === c.targetId)) &&
      open.some((t) => {
        if (t.ownerId === p.id) return false;
        const v = voiceHunterOf(game, t.id);
        const onX = game.clues.some((c) => isActive(c) && c.hunterId === p.id && c.targetId === t.id);
        return v !== null && v.status === 'active' && v.id !== p.id && !onX;
      }),
  );
}

export function shouldEnterSolo(game: Game): boolean {
  return (
    game.phase === 'races' &&
    !game.clues.some((c) => isActive(c) && c.kind === 'visual') &&
    !isRacePossible(game)
  );
}
