# Judge native structured output

- **Problem:** in production every find submission returns `judge_busy`. Vercel logs show Qwen3.8 (Nebius) answering the compare call with the JSON schema itself instead of a verdict, so Mastra's structured-output validation fails on every retry until the judge deadline.
- **Affected area:** `packages/infra/src/ai/vision-mastra.ts` (all three vision calls share `ask`).
- **Approach:** drop `jsonPromptInjection: 'auto'` so Mastra always uses the provider's native JSON-schema response format instead of possibly pasting the schema into the prompt. Stacked on `eng-51-deploy-web` because the API deploy needs its CORS and deploy-script changes.
- **Verification:** infra tests; deploy the API and run a scripted two-player game against production (create, join, two targets, start, submit a matching photo) expecting `match` and a picture clue for the next hunter.
