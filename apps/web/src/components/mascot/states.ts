export type MascotState = 'idle' | 'talking' | 'thinking' | 'celebrating' | 'sad' | 'shocked' | 'countdown' | 'trophy';

export const POSES: Record<MascotState, { width: number; height: number; alt: string }> = {
  idle: { width: 655, height: 823, alt: 'The pug host sitting and smiling' },
  talking: { width: 655, height: 824, alt: 'The pug host talking' },
  thinking: { width: 655, height: 823, alt: 'The pug host thinking with a paw on its chin' },
  celebrating: { width: 800, height: 823, alt: 'The pug host cheering with both paws up' },
  sad: { width: 655, height: 823, alt: 'The pug host looking sympathetic' },
  shocked: { width: 655, height: 860, alt: 'The pug host looking shocked' },
  countdown: { width: 655, height: 824, alt: 'The pug host holding a stopwatch' },
  trophy: { width: 904, height: 876, alt: 'The pug host holding up a golden trophy' },
};

export const MASCOT_STATES = Object.keys(POSES) as MascotState[];
