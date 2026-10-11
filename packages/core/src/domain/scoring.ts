export const BASE_SCORE = 1000;
export const MIN_SCORE_FRACTION = 0.25;
export const SECOND_CLUE_MULTIPLIER = 0.75;

export interface ScoreFindInput {
  issuedAt: Date;
  foundAt: Date;
  timeLimitMs: number;
  secondClueUsed: boolean;
}

export function scoreFind({ issuedAt, foundAt, timeLimitMs, secondClueUsed }: ScoreFindInput): number {
  const elapsed = Math.max(0, foundAt.getTime() - issuedAt.getTime());
  const timeFactor = Math.max(MIN_SCORE_FRACTION, 1 - elapsed / timeLimitMs);
  return Math.round(BASE_SCORE * timeFactor * (secondClueUsed ? SECOND_CLUE_MULTIPLIER : 1));
}
