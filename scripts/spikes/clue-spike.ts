import { Agent } from '@mastra/core/agent';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { closeSync, ftruncateSync, openSync, readFileSync, realpathSync, writeSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sniffImageType } from '../../packages/core/src/index';
import { CLUES_PROMPT } from '../../packages/infra/src/ai/prompts';
import { CluesSchema } from '../../packages/infra/src/ai/vision-mastra';
import { withRetry } from '../../packages/infra/src/ai/retry';

const [requestedOutput, ...photoPaths] = process.argv.slice(2);
if (!requestedOutput || photoPaths.length !== 2) throw new Error('Usage: bun --env-file=.env scripts/spikes/clue-spike.ts <output-outside-repository.json> <photo1> <photo2> (two photos, retries within 30 seconds per photo)');
const root = realpathSync(fileURLToPath(new URL('../../', import.meta.url)));
const outside = (path: string) => {
  const r = relative(root, path);
  return r === '..' || r.startsWith(`..${sep}`) || isAbsolute(r);
};
const requestedPath = resolve(requestedOutput);
if (!outside(requestedPath)) throw new Error('Private spike output must be outside the repository');
const outputPath = join(realpathSync(dirname(requestedPath)), basename(requestedPath));
if (!outside(outputPath)) throw new Error('Private spike output must be outside the repository');
const apiKey = process.env.NEBIUS_API_KEY;
if (!apiKey) throw new Error('NEBIUS_API_KEY is required');
const photos = photoPaths.map((path) => {
  const image = new Uint8Array(readFileSync(path));
  const mediaType = sniffImageType(image);
  if (!mediaType) throw new Error('Unsupported photo type');
  return { path, image, mediaType };
});
const modelId = 'nebius/Qwen/Qwen3.8-27B';
const results: unknown[] = [];
const output = openSync(outputPath, 'wx', 0o600);
const save = () => {
  const bytes = Buffer.from(JSON.stringify({ modelId, prompt: CLUES_PROMPT, results }, null, 2));
  for (let offset = 0; offset < bytes.length;) offset += writeSync(output, bytes, offset, bytes.length - offset, offset);
  ftruncateSync(output, bytes.length);
};
try {
  save();
  for (const { path, image, mediaType } of photos) {
    const agent = new Agent({ id: 'snaphunt-vision', name: 'SnapHunt Vision', instructions: CLUES_PROMPT, model: { id: modelId, apiKey } });
    const started = performance.now();
    try {
      const clues = await withRetry(async (signal) => {
        const response = await agent.generate(
          [{ role: 'user', content: [{ type: 'image', image, mediaType }, { type: 'text', text: 'Write the four clues for this object.' }] }],
          { structuredOutput: { schema: CluesSchema }, abortSignal: signal, maxSteps: 1, modelSettings: { maxRetries: 0 } },
        );
        return CluesSchema.parse(response.object);
      }, { deadlineMs: 30_000 });
      results.push({ path, latencyMs: Math.round(performance.now() - started), clues });
      save();
    } catch {
      results.push({ path, latencyMs: Math.round(performance.now() - started), error: 'Call failed within the retry deadline.' });
      save();
      throw new Error('Nebius clue smoke check failed; inspect the private result file.');
    }
  }
} finally {
  closeSync(output);
}
console.log(`Saved two Nebius clue outputs to ${outputPath}; retries bounded to 30 seconds per photo, no other providers used.`);
