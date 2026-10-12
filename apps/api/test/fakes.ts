import { createMemoryGameRepository, createMemorySubmissionRepository, seededRng, type ImageStore } from '@snaphunt/core';
import type { AppDeps } from '../src/app';

export function makeDeps(overrides: Partial<AppDeps> = {}) {
  let n = 0;
  const files = new Map<string, Uint8Array>();
  const tasks: (() => Promise<void>)[] = [];
  const images: ImageStore = {
    put: async (path, bytes) => void files.set(path, bytes),
    get: async (path) => files.get(path) ?? Promise.reject(new Error('missing')),
    signedUrl: async (path) => `https://signed/${path}`,
  };
  const submissions = createMemorySubmissionRepository();
  const deps: AppDeps = {
    games: createMemoryGameRepository(submissions.all),
    submissions,
    images,
    vision: {
      validateTarget: async () => ({ accepted: true, reason: null, label: 'thing' }),
      writeClues: async () => ({ first: 'a', second: 'b', visual: 'c', judgeBusy: 'd' }),
      compare: async () => ({ sameObject: true, confidence: 1, matchingFeatures: [], differences: [] }),
    },
    speech: { speak: async (text) => new TextEncoder().encode(text) },
    hints: { stylize: async () => new Uint8Array([1]) },
    background: (task) => void tasks.push(task),
    now: () => new Date('2026-10-11T10:00:00Z'),
    rng: seededRng(9),
    newId: () => `id${++n}`,
    webOrigin: 'http://localhost:3000',
    ...overrides,
  };
  return { deps, files, tasks, runBackground: async () => void (await Promise.all(tasks.splice(0).map((task) => task()))) };
}
