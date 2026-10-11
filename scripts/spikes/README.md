# Spikes

Throwaway measurement scripts. Nothing here ships.

## vision-spike.ts

Measures how well candidate vision models answer "is this the exact same physical
object?" — the core verification step of SnapHunt.

Photo sets live in `spikes/photos/` (gitignored; never committed). For each
object drop in:

- `<name>-ref.jpg` (or `.jpeg`) — the private reference photo
- `<name>-same.jpg` — same object, different angle/position (expects match)
- `<name>-lookalike.jpg` — same category, different instance (expects no match)

The script discovers every `*-ref.*` set automatically; `same`/`lookalike` are
optional per object. It also runs ref-vs-ref as a sanity check. Each pair runs
3× per model (`google/gemma-4-31b-it`, `nebius/Qwen/Qwen3.8-27B`) and prints a
table with verdict, confidence, latency, retries, and errors. Calls retry with
backoff inside a 20 s budget.

Requires `GOOGLE_AI_API_KEY` and `NEBIUS_API_KEY` in `.env`. Run from the repo
root:

```bash
bun --env-file=.env scripts/spikes/vision-spike.ts
```
