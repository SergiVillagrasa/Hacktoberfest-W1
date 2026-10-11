export type GameErrorCode =
  | 'not_found'
  | 'forbidden'
  | 'invalid_state'
  | 'room_full'
  | 'not_ready'
  | 'already_found'
  | 'not_active_player'
  | 'clue_not_active'
  | 'second_clue_used'
  | 'version_conflict';

export class GameError extends Error {
  constructor(
    public code: GameErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'GameError';
  }
}
