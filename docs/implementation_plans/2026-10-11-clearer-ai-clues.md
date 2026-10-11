# Clearer AI clues

## Approved approach

Replace the playful riddle style with easy, plain-English descriptions grounded in the target photo. First clues identify visible features; second clues add distinctive details and may mention an obvious everyday use. Keep all four fields, English, existing 25/12-word limits, and exclusions for object names, brands, printed text, and location. Do not alter verification, validation, Fal, speech, game rules, or provider settings.

## Affected areas

- `packages/infra/src/ai/prompts.ts`: update only `CLUES_PROMPT`, including a generic example unrelated to the two regression photos.
- `packages/infra/test/clues-prompt.test.ts`: offline prompt-contract checks for grounding, directness, progressive hints, and privacy constraints. These do not prove semantic output quality.
- `scripts/spikes/clue-spike.ts`: an explicit two-photo, single-pass Nebius comparison runner with no retries, no other providers, and private local result capture.

## Verification

1. Capture the old prompt's four-field outputs on the two user-supplied photos, one Nebius call each.
2. Run the new prompt-contract tests against the old prompt and record the expected failures before updating it.
3. Run the prompt and schema tests after the change, then one final offline test-suite pass and typecheck.
4. Capture revised outputs on the same two photos, one Nebius call each; manually check visible accuracy, usefulness, second-hint progression, and privacy. Four paid Nebius calls total; no automatic reruns or LLM graders. Zero Fal, ElevenLabs, Google, database, deployment, or game-preparation calls.
5. Review the complete diff. Keep private photos, results, and secrets out of git. The small comparison is a smoke check, not a broad quality benchmark.
