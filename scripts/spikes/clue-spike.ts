import { Agent } from '@mastra/core/agent';
import { readFileSync, writeFileSync } from 'node:fs';
import { sniffImageType } from '../../packages/core/src/index';
import { CLUES_PROMPT } from '../../packages/infra/src/ai/prompts';
import { CluesSchema } from '../../packages/infra/src/ai/vision-mastra';

const [outputPath, ...photoPaths] = process.argv.slice(2);
if (!outputPath || photoPaths.length !== 2) throw new Error('Usage: bun --env-file=.env scripts/spikes/clue-spike.ts <private-output.json> <photo1> <photo2> (two calls, no retries)');
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
const save = () => writeFileSync(outputPath, JSON.stringify({ modelId, prompt: CLUES_PROMPT, results }, null, 2), { flag: 'w', mode: 0o600 });
writeFileSync(outputPath, '', { flag: 'wx', mode: 0o600 });
save();
for (const { path, image, mediaType } of photos) {
  const agent = new Agent({ id: 'snaphunt-vision', name: 'SnapHunt Vision', instructions: CLUES_PROMPT, model: { id: modelId, apiKey } });
  const started = performance.now();
  try {
    const response = await agent.generate(
      [{ role: 'user', content: [{ type: 'image', image, mediaType }, { type: 'text', text: 'Write the four clues for this object.' }] }],
      { structuredOutput: { schema: CluesSchema }, abortSignal: AbortSignal.timeout(30_000), maxSteps: 1, modelSettings: { maxRetries: 0 } },
    );
    results.push({ path, latencyMs: Math.round(performance.now() - started), clues: CluesSchema.parse(response.object) });
    save();
  } catch {
    results.push({ path, latencyMs: Math.round(performance.now() - started), error: 'Call failed; no retry attempted.' });
    save();
    throw new Error('Nebius clue smoke check failed; inspect the private result file. No retry attempted.');
  }
}
console.log(`Saved two Nebius clue outputs to ${outputPath}; no retries or other providers used.`);
