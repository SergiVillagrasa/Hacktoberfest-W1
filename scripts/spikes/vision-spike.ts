import { Agent } from '@mastra/core/agent';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Throwaway spike: measures same-object photo verification accuracy/latency.
// Run from repo root: bun --env-file=.env scripts/spikes/vision-spike.ts

const MatchEvidence = z.object({
  sameObject: z.boolean(),
  confidence: z.number().min(0).max(1),
  matchingFeatures: z.array(z.string()),
  differences: z.array(z.string()),
});
type MatchEvidence = z.infer<typeof MatchEvidence>;

const PHOTOS_DIR = fileURLToPath(new URL('../../spikes/photos/', import.meta.url));
const RUNS_PER_PAIR = 3;
const CONCURRENCY = 3;
// One model call can take ~60 s, so the budget caps retry *waiting*, not calls.
const RETRY_WAIT_BUDGET_MS = 20_000;
const BACKOFF_MS = [500, 1000, 2000, 4000];

const PROMPT = [
  'You are the verification judge for a real-world photo scavenger hunt.',
  'The first image is the private reference photo of the target object.',
  'The second image is a candidate photo submitted by a player.',
  'Decide whether the candidate shows the EXACT SAME physical object instance',
  'as the reference, allowing a different angle, position, distance, and lighting.',
  'Compare object-specific evidence: wear marks, scratches, stitching, dents,',
  'attached accessories, unique patterns, and printed details.',
  'A same-category lookalike (different instance of the same kind of object)',
  'MUST be judged sameObject=false.',
  'confidence is your certainty in the sameObject verdict, 0 to 1.',
].join(' ');

interface ModelSpec {
  id: string;
  apiKey: string | undefined;
  providerOptions?: Record<string, unknown>;
}

const MODELS: ModelSpec[] = [
  { id: 'google/gemma-4-31b-it', apiKey: process.env.GOOGLE_AI_API_KEY },
  { id: 'nebius/Qwen/Qwen3.8-27B', apiKey: process.env.NEBIUS_API_KEY },
];

interface Pair {
  object: string;
  kind: 'ref' | 'same' | 'lookalike';
  expected: boolean;
  candidatePath: string;
}

interface PhotoSet {
  object: string;
  refPath: string;
  samePath?: string;
  lookalikePath?: string;
}

function discoverPhotoSets(): PhotoSet[] {
  const files = readdirSync(PHOTOS_DIR);
  const sets = new Map<string, PhotoSet>();
  for (const file of files) {
    const m = /^(.+)-(ref|same|lookalike)\.(jpe?g)$/i.exec(file);
    if (!m) continue;
    const [, object, kind] = m;
    const set = sets.get(object) ?? { object, refPath: '' };
    set[`${kind.toLowerCase()}Path` as 'refPath' | 'samePath' | 'lookalikePath'] = join(PHOTOS_DIR, file);
    sets.set(object, set);
  }
  return [...sets.values()].filter((s) => s.refPath);
}

function toDataUrl(path: string): string {
  const mime = /\.png$/i.test(path) ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${readFileSync(path).toString('base64')}`;
}

function buildAgent(spec: ModelSpec): Agent {
  if (!spec.apiKey) throw new Error(`missing API key env var for ${spec.id}`);
  return new Agent({
    id: `judge-${spec.id.replaceAll('/', '-')}`,
    name: 'Match Judge',
    instructions: PROMPT,
    model: { id: spec.id, apiKey: spec.apiKey },
  });
}

async function judge(agent: Agent, spec: ModelSpec, refPath: string, candidatePath: string) {
  const started = performance.now();
  let retries = 0;
  let waitedMs = 0;
  for (;;) {
    try {
      const response = await agent.generate(
        [
          {
            role: 'user',
            content: [
              { type: 'image', image: toDataUrl(refPath) },
              { type: 'image', image: toDataUrl(candidatePath) },
              {
                type: 'text',
                text: 'First image: reference. Second image: candidate. Judge per your instructions.',
              },
            ],
          },
        ],
        {
          structuredOutput: { schema: MatchEvidence, jsonPromptInjection: 'auto' },
          ...(spec.providerOptions ? { providerOptions: spec.providerOptions } : {}),
        },
      );
      return {
        object: response.object as MatchEvidence | undefined,
        latencyMs: Math.round(performance.now() - started),
        retries,
        error: '',
      };
    } catch (err) {
      const wait = BACKOFF_MS[retries] ?? 4000;
      if (retries >= BACKOFF_MS.length || waitedMs + wait > RETRY_WAIT_BUDGET_MS) {
        return {
          object: undefined,
          latencyMs: Math.round(performance.now() - started),
          retries,
          error: err instanceof Error ? err.message.split('\n')[0].slice(0, 160) : String(err),
        };
      }
      retries += 1;
      waitedMs += wait;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

function pad(value: unknown, width: number): string {
  const s = String(value ?? '');
  return s.length > width ? s.slice(0, width) : s.padEnd(width);
}

async function main() {
  const sets = discoverPhotoSets();
  if (sets.length === 0) {
    console.error(`No <name>-ref.(jpg|jpeg) photo sets found in ${PHOTOS_DIR}`);
    process.exit(1);
  }

  const pairs: Pair[] = [];
  for (const set of sets) {
    pairs.push({ object: set.object, kind: 'ref', expected: true, candidatePath: set.refPath });
    if (set.samePath)
      pairs.push({ object: set.object, kind: 'same', expected: true, candidatePath: set.samePath });
    if (set.lookalikePath)
      pairs.push({ object: set.object, kind: 'lookalike', expected: false, candidatePath: set.lookalikePath });
  }

  console.log(`Objects: ${sets.map((s) => s.object).join(', ')}`);
  console.log(
    ['model', 'pair', 'expected', 'sameObject', 'confidence', 'ms', 'retries', 'error']
      .map((h, i) => pad(h, [26, 22, 8, 10, 10, 8, 7, 60][i]))
      .join(' | '),
  );
  console.log('-'.repeat(160));

  for (const spec of MODELS) {
    let agent: Agent;
    try {
      agent = buildAgent(spec);
    } catch (err) {
      console.log(`${spec.id}: ${(err as Error).message}`);
      continue;
    }
    const jobs: { pair: Pair; run: number }[] = [];
    for (const pair of pairs) {
      for (let run = 1; run <= RUNS_PER_PAIR; run++) jobs.push({ pair, run });
    }
    for (let i = 0; i < jobs.length; i += CONCURRENCY) {
      const batch = await Promise.all(
        jobs.slice(i, i + CONCURRENCY).map(({ pair, run }) =>
          judge(agent, spec, sets.find((s) => s.object === pair.object)!.refPath, pair.candidatePath).then(
            (r) => ({ pair, run, r }),
          ),
        ),
      );
      for (const { pair, run, r } of batch) {
        console.log(
          [
            pad(spec.id, 26),
            pad(`${pair.object}:${pair.kind}#${run}`, 22),
            pad(pair.expected, 8),
            pad(r.object?.sameObject ?? '-', 10),
            pad(r.object?.confidence?.toFixed(2) ?? '-', 10),
            pad(r.latencyMs, 8),
            pad(r.retries, 7),
            pad(r.error, 60),
          ].join(' | '),
        );
      }
    }
  }
}

await main();
