# SnapHunt

SnapHunt is a real-world multiplayer photo scavenger hunt for 2–6 friends. Each
player secretly photographs a nearby object, then receives an AI-written voice
clue for another player's target. Search your surroundings, photograph the exact
object, and let the AI provide matching evidence while the backend applies the
game rules. Successful discoveries can unlock generated visual clues and races
against other hunters. A cheerful pug hosts the experience.

Built for the Hacktoberfest "Touch Grass" challenge: it is a game that gets
people off their chairs and looking at the real world around them.

## Play the demo

- Live demo: https://sergi-villagrasa.tech/projects/snaphunt
- Demo video: https://drive.google.com/file/d/1wKuDRf7nL-k8ujCB4NbgPSmx_ULod4wN/view?usp=sharing

## How to play

You need 2-6 players in the same area, each with a phone and an internet
connection. No accounts and no API keys are required to play — guests join with
a nickname.

1. One player creates a room and shares the join code. Everyone else joins on
   their own phone.
2. Each player secretly photographs a different object that everyone can
   physically reach. The other players never see these originals.
3. When every player has submitted and been accepted, the host starts the game.
4. Each player receives a voice clue for another player's object—never their
   own. Listen to it or read the text, find the object, and submit a photo.
5. A verified discovery earns points and can unlock a generated visual hint for
   another unresolved target. If the visual-clue challenger finds it before its
   original voice-clue hunter, that original hunter is eliminated for the rest
   of the round.
6. Continue hunting until the round ends, then check the leaderboard. The
   player with the highest total score wins; each player has at most five
   failed verification attempts per round. Faster finds earn more points;
   requesting a second clue reduces the award.

**Three or more players are recommended to experience visual-clue races.**

Play safely: watch where you are walking, only photograph objects you are
allowed to, and be considerate of people around you. The app asks for camera
access (to take photos) and plays audio clues through the browser.

The game has been playtested with 3 people in a home using common household
objects. Outdoor play is possible but has not been tested yet.

## Current stack

| Layer | Technology |
| --- | --- |
| Vision model | Qwen3.8-27B (`nebius/Qwen/Qwen3.8-27B`) via Nebius — primary; `google/gemma-4-31b-it` as a configurable alternative via `VISION_MODEL` (not an automatic fallback) |
| Agent framework | Mastra (structured agent responses) |
| Speech | ElevenLabs text-to-speech for clues |
| Visual clues | fal `fal-ai/nano-banana-2/edit` image editing |
| Frontend | Next.js, React, HeroUI, Tailwind CSS |
| Backend | Express |
| Data | Drizzle ORM, PostgreSQL, Supabase Storage |
| Realtime | Server-Sent Events |
| Hosting | Vercel |

## Repository layout

```
apps/
  web/                 Next.js frontend (@snaphunt/web)
  api/                 Express backend (@snaphunt/api)
packages/
  contracts/           Shared types and API contracts
  core/                Game rules and domain logic
  infra/               Database, storage, and provider adapters
```

The backend follows a ports-and-adapters style: game rules live in `core` and
are enforced by the server, not by the AI providers. Providers (vision, speech,
image editing) sit behind adapter interfaces so they can be swapped or faked.

Original target photos remain private to their creators; other hunters receive
only authorized clues, not the reference photos. Provider credentials stay on
the backend and are never exposed to the frontend.

More detail:

- [docs/architecture.md](docs/architecture.md) — technical design
- [docs/product-brief.md](docs/product-brief.md) — game rules and hackathon
  context (the brief predates the switch to Qwen as the default vision model;
  the table above reflects the current setup)

## Development setup

Prerequisites: Node.js and Bun.

Install dependencies from the repo root:

```bash
bun install --frozen-lockfile
```

### Option A: fake providers (no credentials, no AI calls)

The fake API serves real game flow with in-memory rooms and mocked vision,
speech, and hints. It accepts every submitted target and returns "match" as the
default judge verdict — useful for UI and game-flow work, but it is not real AI
verification. All state resets on restart.

Terminal 1 — fake API (port 8787):

```bash
bun run dev:api:fake
```

Terminal 2 — web app (port 3000):

```bash
NEXT_PUBLIC_API_URL=http://localhost:8787 BASE_PATH= bun run dev:web
```

Then open http://localhost:3000.

### Option B: real providers

The real backend needs credentials in `.env` at the repo root. Create it if you
do not have one:

```bash
test -e .env || cp .env.example .env
```

Fill in the required values locally (see `.env.example`):

- `DATABASE_URL` — Supabase transaction pooler URL (percent-encode special
  characters in the password)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `ELEVENLABS_API_KEY`
- `FAL_KEY`
- `NEBIUS_API_KEY` for the default Qwen model, or `GOOGLE_AI_API_KEY` if you
  configure `VISION_MODEL` to use Gemma instead
- Optional: `VISION_MODEL` (defaults to `nebius/Qwen/Qwen3.8-27B`),
  `WEB_ORIGIN` (defaults to `http://localhost:3000`), `PORT` (defaults to 8787)

Frontend values `NEXT_PUBLIC_API_URL` and `BASE_PATH` are public, not secrets —
never pass backend credentials to the frontend.

Run the migrations against your own development database:

```bash
bun run db:migrate
```

The Supabase storage adapter creates the private `snaphunt-private` bucket on
first upload, so no manual bucket setup is needed.

Terminal 1 — real API:

```bash
bun run --filter @snaphunt/api dev
```

Terminal 2 — web app:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8787 BASE_PATH= bun run dev:web
```

Real-provider mode calls external APIs, so it needs internet access and usage
is billed by those providers.

Note on camera access: browsers only expose the camera in a secure context
(HTTPS or localhost). Playing on a physical phone over plain LAN HTTP will not
work — use the deployed demo or serve your dev environment over HTTPS.

## Verification

| Command | What it does |
| --- | --- |
| `bun run test` | Run the Vitest suite |
| `bun run typecheck` | Typecheck all packages and the web app |
| `bun run build:web` | Build the web bundle |
| `bun run db:migrate` | Apply pending SQL migrations to `DATABASE_URL` |

Deployments run through `bun run deploy:api` and `bun run deploy:web`, which
publish to the project's existing Vercel projects (`snaphunt-api` and
`snaphunt-web`) and expect the corresponding environment variables to already
be configured in Vercel. They are not generic one-click deploys.
