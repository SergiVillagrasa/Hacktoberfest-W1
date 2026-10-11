# SnapHunt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full SnapHunt game (lobby, voice clues, verification, visual-clue races, eliminations, solo hunt, scoring, spectator, recap) and deploy web + API to Vercel for tonight's outdoor playtest.

**Architecture:** Bun monorepo with hexagonal layering per `docs/architecture.md`. All game rules are pure functions in `packages/core` over a `Game` aggregate, persisted by Drizzle with optimistic version checks; Express (one Vercel Function) composes use cases with adapters; Next.js web talks only to the API over HTTP + SSE (SSE polls the room version once per second).

**Tech Stack:** TypeScript (ESM, ES2022), Bun 1.4 workspaces + `bun test`, Next.js 16 App Router + HeroUI v3 + Tailwind v4, Express 5, Drizzle ORM + `postgres` (postgres-js) on Supabase Postgres, PGlite for repository tests, Supabase Storage, Zod 4, Mastra (`@mastra/core`), ElevenLabs JS SDK, `@fal-ai/client`, `@vercel/functions`.

**Spec:** `docs/design_plans/2026-10-11-snaphunt-game-design.md` (read it with this plan; also `docs/architecture.md`, `docs/product-brief.md`, `AGENTS.md`).

## Global Constraints

- Read `docs/architecture.md` before each task. Dependency direction is enforced: core imports nothing from infra/apps; web talks only to api.
- Never read or print `.env`. Keys are backend-only (`apps/api`, `packages/infra`). Env names: `GOOGLE_AI_API_KEY`, `NEBIUS_API_KEY`, `ELEVENLABS_API_KEY`, `FAL_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, plus non-secret `VISION_MODEL` (default `google/gemma-4-31b-it`, fallback `nebius/Qwen/Qwen3.8-27B`), `WEB_ORIGIN`, `NEXT_PUBLIC_API_URL`. Every new name goes into `.env.example`.
- Pin exact dependency versions, each published at least 7 days ago (check `npm view <pkg> time`). Add deps from the repo root with `bun add`; commit `bun.lock`.
- All packages are ESM (`"type": "module"`), `tsconfig` target ES2022, strict.
- The user merges every PR; agents push and open PRs but never merge. Because of that, a task whose code depends on unmerged work stacks on that branch (PR base = parent branch). `eng-{n}` numbers in task headings are indicative; always take the next free number per the `branch-naming` skill. A task may be split into more PRs when it would exceed the size rule.
- One task = one branch `SergiVillagrasa/eng-{n}-{slug}` = one PR (title `type(scope): outcome`, body `## What` / `## Why` only, ~≤200 net LOC excluding lockfile, generated migrations and binary assets). Branch from `main`; stack on the previous branch only when it is unmerged and needed. No worktrees. Merge commits only.
- Game constants (copy exactly): players 2–6; time limits `[10, 15, 20, 30]` minutes; countdown `5000` ms; max failed attempts `5`; judge budget `20000` ms; score `1000 × max(0.25, 1 − elapsed/timeLimit) × (secondClueUsed ? 0.75 : 1)`, rounded; room code 5 chars from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`.
- Every vision call retries with exponential backoff (500 ms, 1 s, 2 s, 4 s…) inside its deadline and is idempotent; retries never award points or consume attempts twice.
- Original target photos are never exposed to other players before the game is `finished`.
- Frontend work (Tasks 18–23) goes through Impeccable (`/impeccable` shape → craft → critique); copy is English, friendly, short.
- Tests: `bun test` from the repo root runs all package tests. Each task's verification also runs `bun run typecheck` (root script: `tsc -b`).

## Review Focus

1. **Two correct photos for the same target arrive at once** → exactly one scores; the other gets "already found" and does not lose an attempt. Pinned in Task 9 (repository version conflict) and Task 16 (use case retry on conflict).
2. **The same submission is retried after a network drop** (same idempotency key) → identical result, no second score or attempt. Pinned in Task 16.
3. **The timer runs out while every phone is closed** → the next snapshot shows `finished` with the correct ranking. Pinned in Task 6 (`advanceClock`) and Task 15 (snapshot runs `tick`).
4. **A player submits after being eliminated, after running out of attempts, or for a target that was just found** → rejected with a clear reason, no attempt consumed. Pinned in Task 16.
5. **A phone refreshes or reopens mid-game** → same player, same clues, same audio. Pinned in Task 13 (session lookup) and Task 18 (token persisted in `localStorage`).

---

## File Map

```txt
package.json, tsconfig.base.json, tsconfig.json, bunfig.toml
packages/contracts/src/{index,api,views}.ts
packages/core/src/
  domain/{types,constants,rng,room-code,derangement,scoring,ranking,races,game}.ts
  ports/{index}.ts
  usecases/{create-room,join-room,remove-player,submit-target,prepare-target,start-game,tick,get-view,request-second-clue,submit-find}.ts
  index.ts
packages/core/test/{fixtures.ts, *.test.ts}
packages/infra/src/
  db/{schema,client,game-repository,submission-repository,migrations/}.ts
  storage/supabase-image-store.ts
  ai/{retry,vision-mastra,prompts}.ts
  voice/elevenlabs-speech.ts
  hints/fal-hints.ts
apps/api/src/{app,server,vercel-entry,env,composition,auth,sse}.ts
apps/api/src/routes/{rooms,targets,game,clues}.ts
apps/web/src/app/{page,create,join,room/[code]}/…
apps/web/src/components/{mascot,camera,clues,game,shared}/…
apps/web/src/lib/{api,session,sse,audio,image}.ts
scripts/spikes/vision-spike.ts
```

## Core Types (defined in Task 3, used everywhere)

```ts
// packages/core/src/domain/types.ts
export type RoomStatus = 'lobby' | 'countdown' | 'active' | 'finished';
export type Phase = 'races' | 'solo';
export type PlayerStatus = 'active' | 'eliminated' | 'out_of_attempts';
export type ClueKind = 'voice' | 'visual';
export type ClueStatus = 'active' | 'won' | 'lost' | 'cancelled';
export type Validation = 'pending' | 'accepted' | 'rejected';
export type PrepStatus = 'pending' | 'ready' | 'failed';

export interface Player { id: string; nickname: string; isCreator: boolean; status: PlayerStatus; failedAttempts: number; joinedAt: Date; }
export interface TargetAssets {
  prep: PrepStatus;
  clues: { first: string; second: string; visual: string; judgeBusy: string } | null;
  audio: { first: string | null; second: string | null; visual: string | null; judgeBusy: string | null }; // storage paths
  hintPath: string | null; // null when Fal failed or not ready
}
export interface Target { id: string; ownerId: string; imagePath: string; validation: Validation; rejectReason: string | null; foundBy: string | null; foundAt: Date | null; points: number | null; assets: TargetAssets; }
export interface Clue { id: string; targetId: string; hunterId: string; kind: ClueKind; issuedAt: Date; secondClueUsed: boolean; judgeBusyServed: boolean; status: ClueStatus; }
export interface Game {
  roomId: string; code: string; status: RoomStatus; phase: Phase; timeLimitMs: number;
  countdownEndsAt: Date | null; endsAt: Date | null; finishedAt: Date | null;
  players: Player[]; targets: Target[]; clues: Clue[]; version: number;
}
export type DomainEvent =
  | { type: 'game_started'; at: Date }
  | { type: 'target_found'; at: Date; targetId: string; hunterId: string; points: number; kind: ClueKind }
  | { type: 'player_eliminated'; at: Date; playerId: string; byPlayerId: string }
  | { type: 'visual_clue_issued'; at: Date; clueId: string; hunterId: string; targetId: string }
  | { type: 'player_out_of_attempts'; at: Date; playerId: string }
  | { type: 'solo_mode'; at: Date }
  | { type: 'game_finished'; at: Date; reason: 'all_found' | 'time_up' | 'no_pursuers' };
export interface Transition { game: Game; events: DomainEvent[]; }
export type Rng = () => number; // [0, 1)
export type IdGen = () => string;
```

Domain errors (`packages/core/src/domain/errors.ts`): `class GameError extends Error { constructor(public code: GameErrorCode, message: string) }` with `GameErrorCode = 'not_found' | 'forbidden' | 'invalid_state' | 'room_full' | 'not_ready' | 'already_found' | 'not_active_player' | 'clue_not_active' | 'second_clue_used' | 'version_conflict'`.

---

### Task 1: Monorepo scaffold (eng-1)

**Files:** Create root `package.json` (workspaces `apps/*`, `packages/*`; scripts `test: bun test`, `typecheck: tsc -b`), `tsconfig.base.json`, `tsconfig.json` (project references), `bunfig.toml`; `packages/{contracts,core,infra}/package.json` + `tsconfig.json` + `src/index.ts` (empty export); `packages/core/test/smoke.test.ts`. Update `.gitignore` (`node_modules`, `.next`, `.vercel`, `dist`, `spikes/photos/`).

**Interfaces:** Produces workspace package names `@snaphunt/contracts`, `@snaphunt/core`, `@snaphunt/infra`, `@snaphunt/api`, `@snaphunt/web`.

- [ ] Step 1: Write `packages/core/test/smoke.test.ts`: `expect(await import('@snaphunt/core')).toBeDefined()`.
- [ ] Step 2: Create workspace files; `bun install`; add `typescript` (dev) at root.
- [ ] Step 3: Run `bun test` → PASS; `bun run typecheck` → exit 0.
- [ ] Step 4: Commit, push, open PR `chore: scaffold bun monorepo`.

### Task 2: Vision spike (eng-2, throwaway, parallel with Tasks 3–7)

**Files:** Create `scripts/spikes/vision-spike.ts`, `scripts/spikes/README.md` (how to run). Photos in `spikes/photos/` (gitignored) — **the user provides them**: for at least 3 objects, `<obj>-ref.jpg`, `<obj>-same.jpg` (same object, other angle), `<obj>-lookalike.jpg` (same kind, different object).

- [ ] Step 1: Add `@mastra/core` at root. Script builds one Mastra `Agent` per model id in `['google/gemma-4-31b-it', 'nebius/Qwen/Qwen3.8-27B']`, with `model: { id, apiKey }` (`GOOGLE_AI_API_KEY` / `NEBIUS_API_KEY` read from `process.env`, loaded with `bun --env-file=.env`), sends ref + candidate images, and requests structured output with the `MatchEvidence` schema from Task 11 (`{ sameObject: boolean, confidence: number, matchingFeatures: string[], differences: string[] }`). Verify the current Mastra image-message and `structuredOutput` API in the Mastra docs before writing (mastra skill).
- [ ] Step 2: Run each pair 3×; print a table: model, pair, sameObject, confidence, latency ms, HTTP errors. Never print keys.
- [ ] Step 3: Pick primary model and `MATCH_THRESHOLD` (start 0.8). Record the table and decision in the PR body; set `MATCH_THRESHOLD` in Task 3's constants if it differs.
- [ ] Step 4: Commit, push, PR `chore(spike): measure vision verification accuracy and latency`.

### Task 3: Core types, constants, room codes, derangement (eng-3)

**Files:** Create `packages/core/src/domain/{types,errors,constants,rng,room-code,derangement}.ts`; tests `packages/core/test/{room-code,derangement}.test.ts`; `packages/core/test/fixtures.ts`.

**Interfaces:** Produces the Core Types above; `constants.ts`: `MIN_PLAYERS=2, MAX_PLAYERS=6, TIME_LIMIT_MINUTES=[10,15,20,30] as const, COUNTDOWN_MS=5000, MAX_FAILED_ATTEMPTS=5, JUDGE_BUDGET_MS=20000, MATCH_THRESHOLD=0.8, ROOM_CODE_ALPHABET='ABCDEFGHJKMNPQRSTUVWXYZ23456789', ROOM_CODE_LENGTH=5`; `seededRng(seed: number): Rng` (mulberry32); `generateRoomCode(rng: Rng): string`; `createDerangement(ids: readonly string[], rng: Rng): Map<string, string>` (key = hunter id, value = owner id whose target they hunt); `fixtures.ts`: `makeGame(overrides)`, `makePlayer`, `makeTarget`, `makeClue` builders with sensible defaults.

- [ ] Step 1: Tests:
  - `generateRoomCode` returns 5 chars, all in alphabet, for 500 seeds.
  - `createDerangement` for n = 2..6 and seeds 1..1000: keys and values are both exactly the input set, and `map.get(id) !== id` for every id.
  - `createDerangement(['a'], rng)` and `([], rng)` throw `GameError` code `invalid_state`.
  - For n = 3, across seeds 1..3000, both possible derangements occur (not constant).
- [ ] Step 2: Run → FAIL.
- [ ] Step 3: Implement. Derangement: Fisher–Yates shuffle, retry until no fixed point (expected < 3 tries).
- [ ] Step 4: Run → PASS. Commit; PR `feat(core): add game types, room codes and derangement`.

### Task 4: Scoring and ranking (eng-4)

**Files:** Create `packages/core/src/domain/{scoring,ranking}.ts`; tests `packages/core/test/{scoring,ranking}.test.ts`.

**Interfaces:** `scoreFind(input: { issuedAt: Date; foundAt: Date; timeLimitMs: number; secondClueUsed: boolean }): number`; `interface Ranked { playerId: string; nickname: string; score: number; finds: number; lastFindAt: Date | null; rank: number }`; `rankPlayers(game: Game): Ranked[]` (sorted by rank).

- [ ] Step 1: Tests (timeLimit 600 000 ms):
  - elapsed 0 → 1000; 60 s → 900; 60 s + second clue → 675; 570 s → 250; 570 s + second → 188; elapsed beyond limit → 250.
  - Ranking: A score 900 last find 10:05, B 900 last find 10:03, C 0 finds → order B(1), A(2), C(3). Score = sum of `points` of targets with `foundBy === player`.
  - Two zero-find players share the last rank number; order among them by `joinedAt`.
- [ ] Step 2–4: FAIL → implement → PASS. Commit; PR `feat(core): add time and clue based scoring with tie-break ranking`.

### Task 5: Race eligibility and solo detection (eng-5)

**Files:** Create `packages/core/src/domain/races.ts`; test `packages/core/test/races.test.ts`.

**Interfaces:**
- `voiceHunterOf(game, targetId): Player | null` (active voice clue holder, if any).
- `eligibleVisualTargets(game: Game, hunterId: string): Target[]` — unresolved targets T where: `T.ownerId !== hunterId`; hunter has no active clue on T; T has no active visual clue; hunter holds no active visual clue; and either T's voice hunter is `active` (race) or T has no active voice clue (orphan).
- `isRacePossible(game: Game): boolean` — exists active player P with an active clue on an unresolved target X, and an unresolved target T ≠ X with `T.ownerId !== P.id`, an active voice hunter V (V active, V ≠ P), and no active visual clue.
- `shouldEnterSolo(game: Game): boolean` — `phase === 'races'` && no active visual clue && `!isRacePossible(game)`.

- [ ] Step 1: Tests with fixtures:
  - 4 players A..D, voice A→B, B→C, C→D, D→A; A found B's target: eligible for A = {C's, D's}; excludes A's own target.
  - Hunter holding an active visual clue → `[]`.
  - Target with an active visual challenger is excluded.
  - Orphan: D `out_of_attempts`, D's voice clue cancelled → A's target eligible for C (owner ≠ C).
  - 2 players swap, A finds → `eligibleVisualTargets(A) = []`, `shouldEnterSolo = true`.
  - 3 players, all hunting → `isRacePossible = true`.
  - Phase already `solo` → `shouldEnterSolo = false`.
- [ ] Step 2–4: FAIL → implement → PASS. Commit; PR `feat(core): add visual race eligibility and solo detection`.

### Task 6: Game transitions (eng-6)

**Files:** Create `packages/core/src/domain/game.ts`; test `packages/core/test/game.test.ts`.

**Interfaces:**
- `startGame(game, now: Date, rng: Rng, newId: IdGen): Transition` — requires `status==='lobby'`, players 2–6, every player has exactly one `accepted` target; sets `status='countdown'`, `countdownEndsAt=now+5000`, `endsAt=countdownEndsAt+timeLimitMs`; creates voice clues from `createDerangement` with `issuedAt=countdownEndsAt`. Errors: `invalid_state`, `not_ready`.
- `advanceClock(game, now): Transition` — countdown→active at `countdownEndsAt` (event `game_started`); active→finished at `endsAt` (reason `time_up`). Idempotent: calling twice emits nothing new.
- `applyVerifiedFind(game, clueId: string, foundAt: Date, rng: Rng, newId: IdGen): Transition` — clue must be active, hunter active, target unresolved (else `clue_not_active` / `not_active_player` / `already_found`). Sets target `foundBy/foundAt/points` (via `scoreFind` from the clue's `issuedAt`), clue `won`. Other active clues on that target: if the finder's clue is `visual` and a voice clue is active → voice clue `lost`, voice hunter `eliminated` (event `player_eliminated`), cancel all the eliminated player's other active clues; if the finder's clue is `voice`, the visual clue → `lost`. Then if `phase==='races'`: pick `eligibleVisualTargets(finder)` at random → new visual clue (`issuedAt=foundAt`, event `visual_clue_issued`). Then `shouldEnterSolo` → `phase='solo'` (event `solo_mode`). Then `checkEnd`.
- `applyFailedAttempt(game, playerId, at: Date): Transition` — `failedAttempts+1`; at 5 → `out_of_attempts`, cancel their active clues (event `player_out_of_attempts`); then solo check and `checkEnd`.
- `checkEnd(game, at): Transition` — finishes when all targets found (`all_found`) or no active player holds an active clue on an unresolved target (`no_pursuers`).
- `useSecondClue(game, clueId, playerId): Game` — voice clue only, owned by player, active, not yet used; sets `secondClueUsed`. Errors `clue_not_active`, `second_clue_used`, `forbidden`.

- [ ] Step 1: Tests (seeded rng):
  - startGame with 3 accepted targets → 3 voice clues, nobody hunts own, `countdownEndsAt=now+5000`, `endsAt=now+5000+timeLimitMs`; with one `pending` target → `not_ready`; with 1 player → `invalid_state`.
  - advanceClock before / at countdown end / at endsAt; second call no events.
  - Voice find with visual challenger active → challenger clue `lost`, nobody eliminated.
  - Visual find before voice hunter → voice hunter `eliminated`, their other visual clue `cancelled`, finder scores.
  - Chaining: finder gets a new visual clue only if eligible; never two active visual clues.
  - 5th failed attempt → `out_of_attempts`, clues cancelled; 6th attempt call → `not_active_player`.
  - Find on an already-found target → `already_found`, game unchanged.
  - Last target found → `finished`, reason `all_found`; only remaining pursuer runs out → `no_pursuers`.
  - Solo: after the switch no visual clues are issued and no eliminations happen.
  - useSecondClue twice → `second_clue_used`; on a visual clue → `clue_not_active`.
- [ ] Step 2–4: FAIL → implement (pure; return new objects, never mutate input) → PASS. Commit; PR `feat(core): add game state transitions for finds, races and endgame`.

### Task 7: Contracts (eng-7)

**Files:** Create `packages/contracts/src/{api,views,index}.ts`; test `packages/contracts/test/api.test.ts`. Add `zod`.

**Interfaces:**
- Requests: `CreateRoomBody = z.object({ nickname: z.string().trim().min(1).max(20), timeLimitMinutes: z.union([z.literal(10),z.literal(15),z.literal(20),z.literal(30)]) })`; `JoinRoomBody = { nickname }`; `RoomCodeParam = z.string().regex(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/)`; `SubmitHeaders = { 'idempotency-key': z.uuid() }`.
- Responses: `SessionResponse = { roomCode, playerId, token }`; `SubmitResult = { outcome: 'match' | 'no_match' | 'judge_busy' | 'already_found'; points?: number; attemptsLeft: number; message: string }`; `ApiError = { code: GameErrorCode; message: string }`.
- `RoomView` (what one viewer may see): `{ code, status, phase, timeLimitMs, countdownEndsAt, endsAt, serverNow, version, me: { playerId, isCreator, status, failedAttempts, attemptsLeft } , players: { id, nickname, isCreator, status, ready, score, finds }[], myClues: ClueView[], spectatorClues: ClueView[], feed: FeedItem[], ranking: Ranked[] | null, recap: RecapItem[] | null, myTarget: { validation, rejectReason, imageUrl } | null }`; `ClueView = { id, kind, status, targetId, text: string | null, secondText: string | null, judgeBusyText: string | null, audioUrl, secondAudioUrl, judgeBusyAudioUrl, hintUrl: string | null, secondClueUsed, issuedAt }`; `FeedItem = { at, type, text, photoUrl: string | null }`; `RecapItem = { targetId, ownerNickname, finderNickname: string | null, originalUrl, findPhotoUrl: string | null, clueText, clueAudioUrl, hintUrl, points }`. All dates ISO strings.
- [ ] Step 1: Tests: valid/invalid nickname (empty, 21 chars), invalid time limit 12, room code with `0`/`O` rejected.
- [ ] Step 2–4: FAIL → implement → PASS. Commit; PR `feat(contracts): add api request and room view schemas`.

### Task 8: Database schema and migration (eng-8)

**Files:** Create `packages/infra/src/db/{schema,client}.ts`, `packages/infra/drizzle.config.ts`, generated `packages/infra/src/db/migrations/*`. Add `drizzle-orm`, `postgres`, `drizzle-kit` (dev), `@electric-sql/pglite` (dev).

**Interfaces:** Tables mirroring Core Types: `rooms(id uuid pk, code text unique, status, phase, time_limit_ms int, countdown_ends_at, ends_at, finished_at timestamptz, version int default 0, created_at)`, `players(id, room_id fk, nickname, is_creator, status, failed_attempts, token_hash text unique, joined_at)`, `targets(id, room_id, owner_id fk unique per room, image_path, validation, reject_reason, found_by, found_at, points, assets jsonb)`, `clues(id, room_id, target_id, hunter_id, kind, issued_at, second_clue_used, judge_busy_served, status)`, `submissions(id, room_id, clue_id, player_id, idempotency_key text unique, image_path, outcome, evidence jsonb, created_at)`, `events(id bigserial, room_id, at, type, payload jsonb)` with index `(room_id, id)`. `createDb(url: string)` returns a drizzle client using postgres-js with `prepare: false` (Supabase pooler).
- [ ] Step 1: `bunx drizzle-kit generate`; review the SQL by hand.
- [ ] Step 2: Apply to Supabase with `bunx drizzle-kit migrate` (env from `.env`, never printed). Confirm tables via Supabase MCP `list_tables`.
- [ ] Step 3: Commit; PR `feat(infra): add database schema and initial migration`.

### Task 9: Game and submission repositories (eng-9)

**Files:** Create `packages/core/src/ports/index.ts`; `packages/infra/src/db/{game-repository,submission-repository}.ts`; test `packages/infra/test/game-repository.test.ts` (PGlite + migrations).

**Interfaces (ports in core):**
```ts
export interface GameRepository {
  create(game: Game): Promise<void>;
  loadByCode(code: string): Promise<Game | null>;
  findPlayerByTokenHash(hash: string): Promise<{ roomCode: string; playerId: string } | null>;
  /** Persists game if stored version === game.version, then increments version; appends events. Throws GameError('version_conflict'). */
  save(game: Game, events: DomainEvent[], tokenHashes?: Record<string, string>): Promise<Game>;
  version(code: string): Promise<number | null>;
  recentEvents(roomId: string, limit: number): Promise<(DomainEvent & { id: number })[]>;
}
export interface SubmissionRepository {
  findByKey(key: string): Promise<StoredSubmission | null>;
  record(s: StoredSubmission): Promise<void>; // unique on idempotency_key
}
export interface StoredSubmission { id: string; roomId: string; clueId: string; playerId: string; idempotencyKey: string; imagePath: string; outcome: SubmitResult['outcome']; points: number | null; evidence: unknown; createdAt: Date; }
```
- [ ] Step 1: Tests: create → loadByCode round-trips every field (dates, assets jsonb); `save` with stale version throws `version_conflict` and writes nothing; two concurrent `save`s from the same loaded version → exactly one succeeds; `findPlayerByTokenHash` finds the player.
- [ ] Step 2–4: FAIL → implement (single transaction: `UPDATE rooms … WHERE id=$1 AND version=$2`, 0 rows → conflict; then upsert players/targets/clues; insert events) → PASS. Commit; PR `feat(infra): add versioned game repository`.

### Task 10: Image storage adapter (eng-10)

**Files:** Create `packages/infra/src/storage/supabase-image-store.ts`; add port `ImageStore` to core ports. Add `@supabase/supabase-js`.

**Interfaces:** `interface ImageStore { put(path: string, bytes: Uint8Array, contentType: string): Promise<void>; get(path: string): Promise<Uint8Array>; signedUrl(path: string, ttlSeconds: number): Promise<string>; }`. Bucket `snaphunt-private` (private; create if missing on first use). Paths: `rooms/{roomId}/targets/{targetId}.jpg`, `…/submissions/{submissionId}.jpg`, `…/audio/{targetId}-{kind}.mp3`, `…/hints/{targetId}.webp`.
- [ ] Step 1: Manual check script (not committed) uploads, signs, fetches a 1×1 JPEG; signed URL returns 200, unsigned public URL returns 400/404.
- [ ] Step 2: Commit; PR `feat(infra): add private supabase image store`.

### Task 11: Vision adapter (eng-11)

**Files:** Create `packages/infra/src/ai/{retry,prompts,vision-mastra}.ts`; port `VisionModel` in core; test `packages/infra/test/retry.test.ts`.

**Interfaces:**
```ts
export interface TargetValidation { accepted: boolean; reason: string | null; label: string; } // label never shown to players before the end
export interface ClueSet { first: string; second: string; visual: string; judgeBusy: string; }
export interface MatchEvidence { sameObject: boolean; confidence: number; matchingFeatures: string[]; differences: string[]; }
export interface VisionModel {
  validateTarget(image: Uint8Array, otherAccepted: Uint8Array[], signal: AbortSignal): Promise<TargetValidation>;
  writeClues(image: Uint8Array, signal: AbortSignal): Promise<ClueSet>;
  compare(reference: Uint8Array, candidate: Uint8Array, signal: AbortSignal): Promise<MatchEvidence>;
}
// retry.ts
export function withRetry<T>(fn: (signal: AbortSignal) => Promise<T>, opts: { deadlineMs: number; baseDelayMs?: number; isRetryable?: (e: unknown) => boolean; sleep?: (ms: number) => Promise<void>; now?: () => number }): Promise<T>;
```
`createMastraVision({ modelId, apiKey }): VisionModel` uses a Mastra `Agent` with `model: { id: modelId, apiKey }`, image parts, and `structuredOutput` with Zod schemas; `apiKey` comes from `GOOGLE_AI_API_KEY` for `google/*` and `NEBIUS_API_KEY` for `nebius/*`. Prompts: clues are game-show-host voice, English, ≤ 25 words, never name the object or its location; `second` more specific; `judgeBusy` is an extra hint in the same voice; `visual` is a short teaser for the visual challenger. Compare prompt demands the exact same physical instance (wear, marks, labels, attachments), different angle allowed.
- [ ] Step 1: retry tests (fake sleep/now): succeeds on 3rd try after two 500s; delays 500, 1000; stops and throws `DeadlineExceeded` when the next delay would pass the deadline; non-retryable (400) throws immediately.
- [ ] Step 2–4: FAIL → implement → PASS. Manual: run the spike photos through `createMastraVision` once.
- [ ] Step 5: Commit; PR `feat(infra): add mastra vision adapter with deadline-bound retries`.

### Task 12: Speech and hint adapters (eng-12)

**Files:** Create `packages/infra/src/voice/elevenlabs-speech.ts`, `packages/infra/src/hints/fal-hints.ts`; ports `SpeechSynth`, `HintGenerator` in core. Add `@elevenlabs/elevenlabs-js`, `@fal-ai/client`.

**Interfaces:** `interface SpeechSynth { speak(text: string): Promise<Uint8Array> }` (mp3; one fixed game-show-host voice id chosen with the ElevenLabs CLI/text-to-speech skill and stored as constant `HOST_VOICE_ID`). `interface HintGenerator { stylize(imageUrl: string): Promise<Uint8Array> }` using `fal-ai/nano-banana-2/edit`, one image, 1K, WebP, prompt per `fal-prompting` skill: "stylized cheerful cartoon illustration of only the main object, same silhouette and distinctive non-text features, plain pastel background, no text, no labels, no surroundings".
- [ ] Step 1: Manual check: speak "Welcome to SnapHunt!" → playable mp3; stylize a spike photo → WebP that passes the brief's visual-clue acceptance contract by eye.
- [ ] Step 2: Commit; PR `feat(infra): add elevenlabs speech and fal hint adapters`.

### Task 13: API skeleton, sessions, rooms (eng-13)

**Files:** Create `apps/api/src/{env,app,server,vercel-entry,composition,auth}.ts`, `apps/api/src/routes/rooms.ts`, `packages/core/src/usecases/{create-room,join-room,remove-player}.ts`; tests `apps/api/test/rooms.test.ts` with an in-memory `GameRepository` (`apps/api/test/memory-repo.ts`). Add `express`, `supertest` (dev), `cors`.

**Interfaces:**
- `env.ts`: Zod-parsed env; missing keys fail fast at startup with the key name only.
- `createApp(deps: AppDeps): Express`; `AppDeps = { games: GameRepository; submissions: SubmissionRepository; images: ImageStore; vision: VisionModel; speech: SpeechSynth; hints: HintGenerator; background: (task: () => Promise<void>) => void; now: () => Date; rng: Rng; newId: IdGen; webOrigin: string }`.
- Token: 32 random bytes base64url; stored as SHA-256 hex. `requirePlayer(code)` middleware reads `Authorization: Bearer` (or `?token=` for SSE only) → `req.player`.
- Routes: `POST /rooms` → 201 `SessionResponse`; `POST /rooms/:code/players` → 201 (errors: 404, 409 `invalid_state` if not lobby, 409 `room_full` at 6); `DELETE /rooms/:code/players/:playerId` (creator only, lobby only, not self) → 204. Errors map `GameError` → `{code,message}` with 400/403/404/409.
- `vercel-entry.ts` default-exports the app for Vercel; `server.ts` listens on `PORT` for local dev.
- [ ] Step 1: Tests: create → join → join… 7th join → 409 `room_full`; non-creator delete → 403; join after start → 409; bad body → 400; unknown token → 401.
- [ ] Step 2–4: FAIL → implement → PASS. Commit; PR `feat(api): add rooms, guest sessions and lobby membership`.

### Task 14: Target upload and background preparation (eng-14)

**Files:** Create `packages/core/src/usecases/{submit-target,prepare-target}.ts`, `apps/api/src/routes/targets.ts`; test `apps/api/test/targets.test.ts` with fake ports.

**Interfaces:**
- `PUT /rooms/:code/target` body `image/jpeg` raw (`express.raw({ type: 'image/jpeg', limit: '4mb' })`) → 202 `{ validation: 'pending' }`. Lobby only. Replaces the player's previous target.
- `submitTarget(deps, { code, playerId, bytes })` stores the image, sets validation `pending`, then `deps.background(() => prepareTarget(...))`.
- `prepareTarget`: `validateTarget` (with other accepted images) → `accepted`/`rejected` + reason (saved first, so the lobby updates fast) → if accepted: `writeClues` → `speak` ×4 (each failure leaves that audio `null`) → `stylize` via signed URL (failure → `hintPath null`) → `prep='ready'`; vision failure after its 30 s deadline → `prep='failed'` and validation `rejected` with reason "The judge couldn't look at that photo, try again". Every write uses load → mutate → `save` with up to 3 retries on `version_conflict`. Re-running on an already-prepared target does nothing (idempotent).
- [ ] Step 1: Tests: accepted path fills all assets; speech failure keeps going with null audio; Fal failure → `hintPath null`, `prep ready`; rejection stores reason; upload after start → 409.
- [ ] Step 2–4: FAIL → implement → PASS. Commit; PR `feat(api): add target upload with background clue preparation`.

### Task 15: Start, tick, room view and SSE (eng-15)

**Files:** Create `packages/core/src/usecases/{start-game,tick,get-view}.ts`, `apps/api/src/{sse.ts,routes/game.ts}`; tests `packages/core/test/get-view.test.ts`, `apps/api/test/game.test.ts`.

**Interfaces:**
- `POST /rooms/:code/start` (creator) → 200 `RoomView`.
- `tick(deps, code): Promise<Game>` — load, `advanceClock(now)`, save if changed (ignore `version_conflict`, reload).
- `getView(deps, game, playerId, now): Promise<RoomView>` — the only place that decides visibility: unresolved targets' `imageUrl`/`hintUrl` only to the viewer's own clues (and `spectatorClues` for non-active viewers); clue texts only when `status` is `active`/`finished`; `recap` and `ranking` only when `finished`; signed URL TTL 600 s; `myClues` second-clue text only after `secondClueUsed`; `judgeBusyText` only after `judgeBusyServed`.
- `GET /rooms/:code` → `tick` then `getView`.
- `GET /rooms/:code/events?token=…` SSE: every 1000 ms run `tick` (which compares `version`); on change send `event: view` with the JSON `RoomView`; `: ping` every 15 s; end the response at 280 s (client reconnects). Headers `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`.
- [ ] Step 1: Tests: view for active hunter never contains another unresolved target's `imageUrl`; spectator sees active clues' texts and hints; lobby view shows own target only; after `endsAt` with no activity, `GET /rooms/:code` returns `status: 'finished'` with ranking (Review Focus 3); start by non-creator → 403; start with pending target → 409 `not_ready`.
- [ ] Step 2–4: FAIL → implement → PASS. Commit; PR `feat(api): add game start, lazy clock and live room view stream`.

### Task 16: Second clue and find submission (eng-16)

**Files:** Create `packages/core/src/usecases/{request-second-clue,submit-find}.ts`, `apps/api/src/routes/clues.ts`; tests `packages/core/test/submit-find.test.ts`, `apps/api/test/clues.test.ts`.

**Interfaces:**
- `POST /rooms/:code/clues/:clueId/second` → 200 `RoomView`.
- `POST /rooms/:code/clues/:clueId/submissions` body raw `image/jpeg`, header `Idempotency-Key` → 200 `SubmitResult`.
- `submitFind(deps, { code, playerId, clueId, bytes, idempotencyKey })`:
  1. Existing submission with this key → return its stored result (Review Focus 2).
  2. Load game; reject without consuming an attempt when player not active, clue not active, or target already found (Review Focus 4) → outcome `already_found` or `GameError`.
  3. Store the photo; `compare` with `withRetry` and `JUDGE_BUDGET_MS`. On deadline → set clue `judgeBusyServed=true`, record outcome `judge_busy`, no attempt consumed; the view now exposes the judge-busy clue text/audio.
  4. Evidence accepted iff `sameObject && confidence >= MATCH_THRESHOLD` → `applyVerifiedFind`; else `applyFailedAttempt`. Save; on `version_conflict` reload and re-apply from step 2 (the target may now be found → `already_found`, no attempt consumed) (Review Focus 1).
  5. Record the submission with outcome and points.
- Message copy: match "You found it!", no_match "Not quite — that's not the one. Keep looking!", judge_busy "The judge is on a quick break — here's a bonus clue!", already_found "Too late — someone just found it!".
- [ ] Step 1: Tests with fake vision: match scores and returns points; no_match decrements `attemptsLeft`; 5th miss → `out_of_attempts`; same key twice → same result, one score; concurrent matches on the same target via two players → one `match`, one `already_found` with attempts unchanged; vision exceeding 20 s (fake clock) → `judge_busy`, attempts unchanged; eliminated player → 409 `not_active_player`.
- [ ] Step 2–4: FAIL → implement → PASS. Commit; PR `feat(api): add find verification, second clues and judge fallback`.

### Task 17: Deploy API to Vercel (eng-17)

**Files:** Create `apps/api/vercel.json` (`maxDuration: 300`), `.env.example` additions (`VISION_MODEL`, `WEB_ORIGIN`, `NEXT_PUBLIC_API_URL`, `NEBIUS_API_KEY`). Uses `@vercel/functions` `waitUntil` as `AppDeps.background`.
- [ ] Step 1: Create the Vercel project for `apps/api` (root dir `apps/api`), set env vars from `.env` via `vercel env add` without echoing values. **Needs the user to be logged in to the Vercel CLI.**
- [ ] Step 2: Deploy; smoke test with curl: create room, join, SSE stream sends a `view` event.
- [ ] Step 3: Update `docs/architecture.md` Stack line to "Deployment: Vercel (web and API)" and "Real-time: SSE polling the room version". Commit; PR `chore(api): deploy api to vercel`.

### Task 18: Web scaffold, theme, API client, session (eng-18)

**Files:** `apps/web` Next.js app (`create-next-app` with TypeScript, App Router, Turbopack, Tailwind v4), HeroUI v3 per `heroui-react` skill; `src/themes/snaphunt.css`; `src/lib/{api,session,sse,audio}.ts`; `PRODUCT.md`/`DESIGN.md` via Impeccable `init` at `apps/web`.

**Interfaces:** `api.ts`: typed functions per route returning contracts types, throwing `ApiError`; `session.ts`: `saveSession(code, s: SessionResponse)`, `getSession(code): SessionResponse | null` (`localStorage` key `snaphunt:{code}`) (Review Focus 5); `sse.ts`: `useRoomView(code): { view: RoomView | null; connected: boolean }` — EventSource with `?token`, initial `GET` fallback, auto-reconnect; `audio.ts`: `unlockAudio()` on first tap, `playClue(url)`.
- [ ] Step 1: Impeccable shape/init: friendly Kahoot × Duolingo, bright rounded, outdoor-readable contrast, big tap targets.
- [ ] Step 2: `bun --filter @snaphunt/web build` passes; home page renders the theme.
- [ ] Step 3: Commit; PR `feat(web): scaffold next app with theme, api client and session`.

### Task 19: Mascot (eng-19)

**Files:** `apps/web/public/mascot/{idle,talking,thinking,celebrating,sad,shocked,countdown,trophy}.webp`; `src/components/mascot/Mascot.tsx`.

**Interfaces:** `<Mascot state={'idle'|'talking'|'thinking'|'celebrating'|'sad'|'shocked'|'countdown'|'trophy'} line?: string />` — pose image + CSS animation per state (bob, wiggle, bounce, shake), speech bubble with `line`, respects `prefers-reduced-motion`.
- [ ] Step 1: Generate one base character with Fal (text-to-image), then each pose with `fal-ai/nano-banana-2/edit` from the base for consistency; ≤ 80 KB each. Show the set to the user for approval before committing.
- [ ] Step 1b: Generate generic host announcement clips once with the ElevenLabs CLI (same `HOST_VOICE_ID`) into `apps/web/public/voice/{find,eliminated,solo,winner,countdown,welcome}.mp3` — no player names, so they can be static.
- [ ] Step 2: Build passes; dev page `/dev/mascot` (removed before merge, or behind `NODE_ENV !== 'production'`) shows all states.
- [ ] Step 3: Commit; PR `feat(web): add animated game-show host mascot`.

### Task 20: Home, create, join (eng-20)

**Files:** `src/app/page.tsx`, `src/app/create/page.tsx`, `src/app/join/page.tsx`.
- Create: nickname + time-limit chips (10/15/20/30) → `POST /rooms` → save session → `/room/{code}`. Join: code (uppercase, 5 chars) + nickname → `/room/{code}`. Errors shown by the mascot (`sad`) with the API message. First tap calls `unlockAudio()`.
- [ ] Verify in the browser preview on a mobile viewport: create + join from two browser profiles lands both in the same room. Commit; PR `feat(web): add home, create and join screens`.

### Task 21: Lobby and camera (eng-21)

**Files:** `src/app/room/[code]/page.tsx` (switches screen by `view.status`/`me.status`), `src/components/game/Lobby.tsx`, `src/components/camera/{CaptureButton.tsx,resize.ts}`.

**Interfaces:** `resizeToJpeg(file: File, maxSide = 1280, quality = 0.82): Promise<Blob>` via `createImageBitmap` + canvas (handles iPhone HEIC through the browser decoder; result < 4 MB). `<CaptureButton onPhoto={(blob) => …} />` uses `<input type="file" accept="image/*" capture="environment">`.
- Lobby: big room code with copy/share, players with ready badges, own target preview with status (pending spinner / accepted / rejected reason + retake), creator-only remove buttons and Start button (enabled only when ≥ 2 players and all ready).
- [ ] Verify with 2 browser profiles against the deployed or local API: upload, acceptance shows, Start enables only when both ready. Commit; PR `feat(web): add lobby with target capture and start`.

### Task 22: Countdown and hunt (eng-22)

**Files:** `src/components/game/{Countdown,Hunt,Timer,Scoreboard,SubmitFlow}.tsx`, `src/components/clues/{VoiceClueCard,VisualClueCard}.tsx`.
- Countdown: 5→1 from `countdownEndsAt` corrected by `serverNow`, mascot `countdown`.
- Hunt: mascot `talking` while audio plays; voice clue card (play/replay, text, "Second clue (−25% points)" button, judge-busy clue when served); visual clue card (hint image, or "drawing your clue…" with the visual voice clue while `hintUrl` is null); camera submit → mascot `thinking` → result (`celebrating` / `sad` / bonus clue); attempts left (5 dots); timer; mini scoreboard; feed announcements trigger mascot lines and audio.
- [ ] Verify with 3 browser profiles: full find, a miss, a visual race elimination. Commit; PR `feat(web): add countdown and hunt screens`.

### Task 23: Spectator, results and recap (eng-23)

**Files:** `src/components/game/{Spectator,Results,RecapGallery}.tsx`.
- Spectator (eliminated / out of attempts): banner with reason, live scoreboard, feed with find photos, active clues (texts + hints).
- Results: ranking with tie-break note, mascot `trophy`, winner celebration; recap gallery per target: original photo, find photo, clue text + audio, visual hint, finder, points.
- [ ] Verify by finishing a 3-player game in the browser. Commit; PR `feat(web): add spectator view, results and recap gallery`.

### Task 24: Deploy web and playtest (eng-24)

**Files:** `apps/web/vercel.json` if needed; `.env.example` (`NEXT_PUBLIC_API_URL`).
- [ ] Create the Vercel project for `apps/web`, set `NEXT_PUBLIC_API_URL`; set API `WEB_ORIGIN` to the web URL (CORS). Deploy both.
- [ ] Smoke test on two real phones on mobile data: join, capture, start, find, recap.
- [ ] Commit; PR `chore(web): deploy web app to vercel`. Then the outdoor playtest (user).
