import type { RoomView } from '@snaphunt/contracts';

export function sortedPlayers(players: RoomView['players']): RoomView['players'] {
  return [...players].sort((a, b) => b.score - a.score || b.finds - a.finds || a.nickname.localeCompare(b.nickname));
}

export function Scoreboard({ players, meId }: { players: RoomView['players']; meId: string }) {
  return (
    <ol className="flex flex-col gap-2" aria-label="Scoreboard">
      {sortedPlayers(players).map((player, index) => (
        <li key={player.id} className={`sh-card flex items-center gap-3 px-3 py-2 ${player.id === meId ? 'sh-card-selected' : ''}`}>
          <span className="tabular w-5 text-center font-display text-lg font-bold text-ink-soft">{index + 1}</span>
          <span className="flex-1 truncate text-base font-bold text-ink">
            {player.nickname}
            {player.id === meId ? <span className="text-ink-soft"> (you)</span> : null}
          </span>
          {player.status !== 'active' ? <span className="sh-badge">Out</span> : null}
          <span className="tabular font-display text-lg font-bold text-ink">{player.score}</span>
        </li>
      ))}
    </ol>
  );
}
