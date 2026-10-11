# Architecture

## Goal

Build a TypeScript monorepo for a mobile-first multiplayer object-hunting game. Players photograph objects, find other players' objects using AI voice clues, and unlock AI-generated visual clues to compete for remaining objects. The system follows a hexagonal / ports-and-adapters architecture so game rules stay independent from frameworks, databases, and external services.

## Stack

- Language: TypeScript
- Package manager: bun workspaces
- Frontend: Next.js App Router, React, and Turbopack; HeroUI v3 and Tailwind CSS v4
- Backend: Express
- Database: PostgreSQL (Supabase)
- Data access: Drizzle ORM
- Validation: Zod (runtime schemas for API requests and other trust-boundary input)
- AI orchestration: Mastra
- AI vision: multimodal model for photo verification and clue generation
- Voice: ElevenLabs TTS
- Image transformation: Fal
- Storage: Supabase Storage
- Real-time updates: Server-Sent Events (SSE); each stream polls the room version about once per second, ends after 280 s and the client reconnects, because Vercel functions have a time limit and no shared memory
- Auth: temporary guest player sessions; no account registration
- Deployment: Vercel for both the web app and the API (two projects, `apps/web` and `apps/api`); the API is built into a single bundle at deploy time and runs with `maxDuration` 300

## Monorepo Layout

```txt
apps/
  api/        Backend application: Express, guest sessions, game endpoints, composition root
  web/        Frontend application: Next.js App Router UI

packages/
  contracts/  Framework-independent shared API types, events, and validation
  core/       Business logic, domain models, use cases, ports
  infra/      Adapter implementations: database, storage, AI providers, real-time events
```

## Dependency Rules

`packages/core` is the center of the system.

`packages/contracts` holds framework-independent API value contracts shared by core, API, infra, and web. It imports no other workspace package; sharing these definitions does not permit frontend access to backend services.

- `packages/core` must never import from `packages/infra`.
- `packages/core` must never import from `apps/*`.
- `packages/core` must not depend on React, Express, Drizzle, Mastra, provider SDKs, or database clients.
- `packages/infra` may import from `packages/core` to implement ports.
- `packages/infra` must not contain business logic.
- `apps/api` may compose `packages/core` and `packages/infra`.
- `apps/web` must talk to `apps/api` only.

Allowed dependency direction:

```txt
apps/web  -> apps/api
apps/api  -> packages/core
apps/api  -> packages/infra
packages/infra -> packages/core
packages/core -> no app or infra imports
core / infra / api / web -> packages/contracts -> no workspace imports
```

## Package Responsibilities

### `packages/core`

Contains business rules only:

- Domain entities and value objects (games, players, objects, hunts, clues, submissions)
- Use cases for game creation, joining, assignments, discoveries, scoring, elimination, and completion
- Business validation and authoritative game-state transitions
- Port interfaces for persistence, storage, AI services, and event publishing
- Shared domain errors and result types

### `packages/infra`

Contains adapters only:

- Drizzle repositories
- Database connections (PostgreSQL via Supabase)
- Storage provider integration
- Mastra moderator and vision model integration
- ElevenLabs TTS and Fal image transformation clients
- Real-time event publishing

Adapters implement ports defined in `packages/core`. Business decisions belong in `packages/core`, not here.

### `apps/api`

Backend entry point:

- Express server
- HTTP routes and controllers
- Guest session handling
- SSE game event endpoint
- Request validation at the API boundary with Zod schemas
- Composition of core use cases with infra adapters

Sessions, storage, database access, and AI integrations happen from the backend only. The frontend must never connect directly to these services.

### `apps/web`

Frontend entry point:

- Next.js App Router application
- Mobile-first game creation, room joining, lobby, and gameplay UI
- Camera capture, clues, verification feedback, and leaderboard
- HTTP and SSE calls to `apps/api` via `src/lib/` (`NEXT_PUBLIC_API_URL`); no direct Supabase or AI provider access

Source layout:

- `src/app/` — routes for home, create, join, game lobby, gameplay, and results
- `src/components/shared/` — UI reused across routes
- `src/components/game/`, `src/components/camera/`, `src/components/clues/` — feature-specific UI
- `src/lib/` — API and SSE clients
- `src/themes/` — HeroUI theme overrides

Add shared components when a second route needs them; do not wrap HeroUI primitives until reuse is real.

The frontend must not import from `packages/infra` or connect directly to the database, storage, or AI providers.

## Endpoint Flow

Every API endpoint follows this path:

```txt
Route (endpoint) -> Controller -> Use case -> Port -> Adapter
```

| Layer | Lives in | Responsibility |
|---|---|---|
| Route | `apps/api` | Map HTTP method/path to a controller |
| Controller | `apps/api` | Parse the request with Zod, call one use case, map the result to an HTTP response |
| Use case | `packages/core` | Core business logic for one action |
| Port | `packages/core` | Interface the use case needs (persistence, AI, storage, etc.) |
| Adapter | `packages/infra` | Concrete implementation (Drizzle/Postgres, Mastra, ElevenLabs, Fal, …) |

Rules:

- Controllers stay thin: no business rules, no direct database access.
- Use cases depend only on ports, never on Express, Drizzle, or provider SDKs.
- Adapters are wired in `apps/api` at composition time and injected into use cases.
- One route handler calls one controller action; one controller action calls one use case.
- Game state, scoring, and eliminations are determined by backend use cases, not AI agents or clients.

## Data And Security Rules

- Use Drizzle ORM for database access against PostgreSQL (Supabase).
- Database and storage access must happen through backend-controlled adapters.
- Keep original object photographs private; only reveal assigned clues to authorized players.
- Enforce game membership, session ownership, and host permissions in the backend.
- Use database transactions to ensure an object can be claimed only once.
- Validate image uploads and AI responses; keep provider API keys on the backend.
- Use SSE for live updates; persist authoritative game state in PostgreSQL.

## Auth Rules

- Temporary guest player sessions only; no account registration.
- The backend issues a session when a player creates or joins a game.
- Sessions identify the player and authorize access to their game and clues.
- The backend validates sessions for protected actions.
- The frontend must not generate or trust player identities on its own.

## Development Workflow

- Before implementation, write only a concise, high-level implementation plan covering the affected areas, approach, and verification.
- Save implementation plans only in `docs/implementation_plans`.
- Save design plans / approved designs only in `docs/design_plans`.
- Never create a `.agents` file or directory in this repository.
- Manage JavaScript dependencies from the root bun workspace and commit `bun.lock`.
- Do not write separate specifications or low-level, step-by-step implementation plans unless explicitly requested.
- Do not create `.qa` directories or save QA screenshots at this stage. Add visual QA when optimization work begins.
- Scope is the full rule set in `docs/product-brief.md`, including Fal visual races, eliminations, and solo-hunt mode.

### Superpowers and Impeccable

Implementation follows the Superpowers workflow (brainstorming → writing-plans → subagent-driven or inline execution with test-driven development → code review → finishing a branch). Frontend design work uses Impeccable. Where Superpowers defaults conflict with this document, this document wins:

- Save Superpowers designs/specs to `docs/design_plans/` and plans to `docs/implementation_plans/`, not `docs/superpowers/`. Detailed, task-by-task Superpowers plans are allowed and are the explicit exception to the "no low-level plans" rule above.
- Do not use git worktrees. Work on a `{username}/eng-{n}-{short-slug}` branch in the main checkout.
- When finishing a branch, always push it and open a PR; never merge locally into `main`. Accepted PRs are merged with a merge commit.
- PR titles and bodies follow `pr-description` (no test-plan section), and every PR follows `pr-sca`; split Superpowers plan tasks into PRs accordingly.

### Skills (required for branches and PRs)

Use the repo skills under `.devin/skills/` before and while shipping work:

- **branch-naming** (`.devin/skills/branch-naming`): name every implementation branch `{username}/eng-{n}-{short-slug}` before changing code. Do not use `feat/`, `fix/`, or `chore/` prefixes; do not omit the `eng-{n}` segment. Each branch gets its own sequential number.
- **pr-description** (`.devin/skills/pr-description`): every PR title uses conventional commits (`type(optional-scope): outcome`) without `eng-N` in the title; every PR body uses `## What` then `## Why` only.
- **pr-sca** (`.devin/skills/pr-sca`): every PR must be Small (~under 200 LOC net), Concise (one responsibility), and Atomic (revert-safe and deployable). Split or stack when a change is larger.

### Branching and merges

- `main` is the stable branch.
- Create one branch per feature, fix, component, backend change, or frontend change, named `{username}/eng-{n}-{short-slug}` with a unique `n` for that branch.
- Before branching, take the next free eng number after the highest already used on remote branches.
- Branch from `main` unless the work depends on another unmerged branch.
- Use stacked branches only when a feature depends on previous in-flight work.
- Open a pull request for each branch into its merge target (`main`, or the parent stack branch).
- Review and validate before merging.
- Merge to `main` only when the PR is accepted and checks pass.
- Use merge commits for accepted PRs; do not squash, rebase, or fast-forward into `main`.
- Review `main` with `git log --first-parent` so only branch merge commits appear.
