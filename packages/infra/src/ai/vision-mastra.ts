import { Agent } from '@mastra/core/agent';
import { JUDGE_HARD_BUDGET_MS, sniffImageType, type ClueSet, type MatchEvidence, type TargetValidation, type VisionModel } from '@snaphunt/core';
import { z } from 'zod';
import { CLUES_PROMPT, COMPARE_PROMPT, VALIDATE_PROMPT } from './prompts';
import { withRetry } from './retry';

const ValidationSchema = z.object({ accepted: z.boolean(), reason: z.string().nullable(), label: z.string() });
const clue = (maxWords: number) =>
  z
    .string()
    .trim()
    .refine((text) => text.length > 0 && text.split(/\s+/).length <= maxWords, `clue must be 1-${maxWords} words`);
export const CluesSchema = z.object({ first: clue(25), second: clue(25), visual: clue(12), judgeBusy: clue(25) });
const EvidenceSchema = z.object({
  sameObject: z.boolean(),
  confidence: z.number().min(0).max(1),
  matchingFeatures: z.array(z.string()),
  differences: z.array(z.string()),
});

export interface MastraVisionOptions {
  modelId: string;
  apiKey: string;
  compareDeadlineMs?: number;
  generateDeadlineMs?: number;
}

const imagePart = (bytes: Uint8Array) => ({ type: 'image' as const, image: bytes, mediaType: sniffImageType(bytes) ?? 'image/jpeg' });

export function createMastraVision({ modelId, apiKey, compareDeadlineMs = JUDGE_HARD_BUDGET_MS, generateDeadlineMs = 30_000 }: MastraVisionOptions): VisionModel {
  async function ask<S extends z.ZodType>(instructions: string, schema: S, images: Uint8Array[], text: string, deadlineMs: number, signal: AbortSignal): Promise<z.infer<S>> {
    const agent = new Agent({ id: 'snaphunt-vision', name: 'SnapHunt Vision', instructions, model: { id: modelId as never, apiKey } });
    return withRetry(
      async (attemptSignal) => {
        const res = await agent.generate(
          [{ role: 'user', content: [...images.map(imagePart), { type: 'text' as const, text }] }],
          { structuredOutput: { schema }, abortSignal: attemptSignal, modelSettings: { maxRetries: 0 } },
        );
        if (!res.object) throw new Error('Vision model returned no structured output');
        return schema.parse(res.object);
      },
      { deadlineMs, signal },
    );
  }

  return {
    validateTarget: (image, otherAccepted, signal): Promise<TargetValidation> =>
      ask(VALIDATE_PROMPT, ValidationSchema, [image, ...otherAccepted], `Screen the first image. ${otherAccepted.length} already accepted target(s) follow it.`, generateDeadlineMs, signal),
    writeClues: (image, signal): Promise<ClueSet> => ask(CLUES_PROMPT, CluesSchema, [image], 'Write the four clues for this object.', generateDeadlineMs, signal),
    compare: (reference, candidate, signal): Promise<MatchEvidence> =>
      ask(COMPARE_PROMPT, EvidenceSchema, [reference, candidate], 'First image: reference. Second image: candidate. Judge per your instructions.', compareDeadlineMs, signal),
  };
}
