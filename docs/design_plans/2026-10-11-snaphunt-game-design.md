# SnapHunt — Full Game Design

Status: draft for approval. Date: 2026-10-11. Supersedes conflicting points in `docs/product-brief.md` (scoring, host start, host disputes, deployment) once approved; `docs/architecture.md` rules still apply except where this document changes deployment and real-time delivery.

Items marked **(builder call)** were decided by the designer, not the user, and may be revisited.

## 1. Intent

SnapHunt is a phone party game for 2–6 friends, played mainly outdoors. Each player secretly photographs a real object nearby; everyone then hunts someone else's object using clues from an AI game-show host, and photographs it to prove the find. The phone is a clue receiver and a camera; the play happens in the world. It is the Hacktoberfest Week 1 "Touch Grass" entry, with Gemma 4 31B IT (open-weight) as the core judge and clue writer.

Success tonight: a real outdoor round with friends that runs start to finish without anyone touching a laptop, plus enough evidence (recap gallery, screenshots, stories) for a strong DEV post.

### Goals
- The complete rule set below, including visual-clue races, eliminations, and solo-hunt mode.
- Friendly, playful feel inspired by Kahoot and Duolingo, with an illustrated mascot host.
- Fair, server-authoritative game state that survives refreshes and flaky outdoor connections.

### Non-goals (this build)
- Accounts, profiles, history across games, friends lists.
- Host moderation tools after the game starts, and verification disputes **(builder call; the brief's dispute review is dropped for time)**.
- Languages other than English.
- Native apps.

### Anti-goals (failure even if it "works")
- Players staring at the screen most of the game.
- A reference photo or location leaking to the hunter before the end.
- Accepting a lookalike object, or double-awarding a find after a retry.
- Waiting on AI with no feedback and no fallback.

## 2. Players, Rooms, Joining

- Each player uses their own phone in a mobile browser.
- Room creator picks a nickname and a game time limit (choices: 10, 15, 20, 30 minutes **(builder call)**) and gets a short room code (e.g. 5 letters, no ambiguous characters).
- Others join with the code and a nickname. No accounts. The backend issues a guest session token stored on the device so a refresh or reopen rejoins the same player.
- 2–6 players. Joining closes when the start countdown begins.

## 3. Game Flow

### 3.1 Lobby and target capture
- Every player photographs one secret object with the phone camera.
- The backend validates each target with Gemma: one clear primary object, safe and appropriate, not a duplicate of an already-accepted target in the room. Rejected photos come back with a friendly reason and a retake.
- On acceptance, the backend starts background preparation for that target (see 5.2) while the lobby continues.
- The lobby shows who has joined and who is ready (target accepted). Nobody sees anyone else's photo.

### 3.2 Start
- The creator has a Start button that is enabled only when there are at least 2 players and every joined player has an accepted target. Tapping it starts a 5-second countdown with the mascot on every phone, then hunting begins and the game timer starts.
- Before start, the creator can remove a player, so one stuck or departed player cannot block the room **(builder call)**.

### 3.3 Assignments and voice clues
- The backend randomly assigns each player another player's target (a derangement: nobody gets their own). Each target has exactly one voice hunter.
- The mascot host reads the hunter's clue aloud (ElevenLabs), with the clue text shown too. The clue describes the object indirectly, never naming it or its exact location.
- A hunter can replay the clue freely and can ask once per voice clue they hold for a second, more specific clue. Using it lowers the points for that find (see 4). Visual clues have no second clue **(builder call)**.

### 3.4 Submitting a find
- The hunter photographs what they think is the target and submits. The mascot shows a "thinking" state while Gemma compares it to the private reference.
- Match rule: the exact same physical object, typically photographed from a different position or angle; same-category lookalikes fail. Gemma returns structured evidence; the backend applies the threshold and owns the result.
- Each player has 5 failed attempts for the whole game. No cooldown. A player who uses all 5 becomes a spectator ("out of attempts").
- If Gemma cannot return a verdict within about 20 seconds (including retries), the attempt does not count against the 5, the photo is not judged, and the host instead reads an extra voice clue for that target (pre-generated, see 5.2) with no point cost **(cost is a builder call)**. The player retakes and submits again.
- A verified find marks the target found exactly once, scores it, announces it to everyone (mascot + voice), and triggers a visual race if one is legal.

### 3.5 Visual-clue races
After any verified find by player H, the moderator (backend, random choice) tries to give H a visual clue for another unresolved target T. T is eligible when:
- T is unresolved, not owned by H, and H is not T's voice hunter;
- T's voice hunter is still active;
- T has no visual challenger yet;
- H holds no other active visual clue.

If several targets are eligible, pick one at random. H becomes T's visual challenger and races T's voice hunter.
- H sees a stylized illustration of T generated by Fal (pre-generated, see 5.2). If the image is not ready yet, H gets a short voice clue for T immediately, and the image appears when ready.
- If the voice hunter finds T first: H stays active, and the clue is closed.
- If H finds T first: H scores it, and T's voice hunter is eliminated (spectator for the rest of the game). Any visual clue the eliminated player held is cancelled.
- Players can chain: each verified find can earn the next visual clue.
- A player keeps hunting their own voice target while holding a visual clue.

**(builder call)** Orphaned targets: if a target's voice hunter runs out of attempts, the target becomes eligible as a visual clue for the next finder with no elimination at stake.

### 3.6 Solo-hunt mode
When a find produces no eligible target and no other race is active, and no future race is possible (fewer than two active players with pursuable targets), the game switches permanently to solo hunt: remaining active players keep hunting their targets, with no new visual clues and no eliminations. The mascot announces the switch.

### 3.7 End
The game ends when any of these happens:
- every target is found;
- the time limit runs out;
- no active player can pursue any unresolved target.

The winner has the highest total score. Ties are broken by the earliest timestamp of each tied player's final successful find. Players with no finds rank last.

## 4. Scoring

Points depend on how long the find took and how many clues were used **(formula is a builder call)**:

```
elapsed   = found_at − clue_received_at   (for this hunter's clue)
timeShare = elapsed / game_time_limit
base      = 1000 × max(0.25, 1 − timeShare)
points    = round(base × (second clue used ? 0.75 : 1))
```

- Visual-race wins score the same way, timed from when the visual clue was issued.
- A found target scores exactly once; retries never add points.

## 5. AI, Voice, and Images

### 5.1 Roles
- **Gemma 4 31B IT** (via Google AI Studio, orchestrated with Mastra): target validation, clue writing (first and second clue, plus a short visual-race voice clue), and exact-object verification with structured evidence. Every call retries with backoff and is idempotent.
- **ElevenLabs**: one game-show host voice for clues and announcements (finds, eliminations, solo-hunt switch, winner).
- **Fal** (`fal-ai/nano-banana-2/edit` to start): turns a target's reference photo into a stylized illustration of the object that keeps its silhouette and distinctive features but removes surroundings, text, and location cues.

### 5.2 Preparation ahead of play (builder call)
When a target is accepted in the lobby, the backend prepares in the background:
1. clue texts (first, second, visual-race, and the extra "judge is busy" clue) with Gemma;
2. clue audio with ElevenLabs;
3. the Fal visual hint, checked against the visual-clue acceptance contract in the brief.

This hides most AI latency before the game starts. If preparation is not finished when the countdown ends, the game still starts and the hunter's screen shows the mascot "warming up" until the clue is ready. Announcement audio uses short templated lines and may be pre-generated once per voice.

### 5.3 Provider fallbacks
- ElevenLabs fails: the clue is shown as text in the mascot's speech bubble.
- Fal fails or the hint fails the acceptance contract: the visual challenger keeps the short voice clue for that target.
- Gemma fails during verification: see 3.4.

### 5.4 Verification spike and backup provider
Gemma multimodal comparison is untested. The first implementation step is a throwaway spike: send pairs of same-object and lookalike photos through Gemma directly and via Mastra, measure accuracy and latency, and tune the prompt and threshold before building on it.

The vision model sits behind a core port, so the provider can be swapped by configuration (`VISION_MODEL`). Primary: `google/gemma-4-31b-it` (Google AI Studio, `GOOGLE_AI_API_KEY`). Fallback, used only if Gemma fails the spike or proves unreliable: `nebius/Qwen/Qwen3.8-27B` (Nebius Token Factory, `NEBIUS_API_KEY`; open-weight, Apache 2.0, image input). Switching off Gemma weakens the "Best Use of Gemma" story, so the fallback is a last resort.

## 6. Screens and Feel

Style: bright, rounded, bouncy, encouraging; big tap targets usable outdoors in sunlight; short text. Frontend design work goes through Impeccable.

Mascot host: a 2D illustrated character with state-based animation. States at least: idle, talking (while audio plays), thinking (verifying), celebrating (find), sad/encouraging (failed attempt), shocked (elimination), countdown, trophy (winner). The art set is created once during the build and committed as static assets **(builder call; generating the pose set with Fal and animating with CSS is acceptable)**.

Screens:
1. **Home**: create room or join with code.
2. **Create**: nickname, time limit.
3. **Join**: code, nickname.
4. **Lobby**: room code to share, players and ready state, take/retake target photo.
5. **Countdown**: 5-second mascot countdown.
6. **Hunt**: mascot, current clue (play/replay, text, second-clue button with its point cost), visual clue card when held, camera button, attempts left, timer, small live scoreboard.
7. **Verifying / result**: mascot thinking, then success or try-again.
8. **Spectator**: live scoreboard, feed of finds with photos, and active clues (voice text and visual hints).
9. **Results and recap**: ranking, winner celebration, and a gallery per target: owner's original photo (revealed now), the finder's photo, voice clue text/audio, visual hint, who found it, and points.

Mobile audio: browsers block autoplay, so the first tap (join/create) unlocks audio, and every clue has a visible play button.

## 7. Technical Shape

Follows `docs/architecture.md` (bun monorepo, `apps/web` Next.js + HeroUI v3, `apps/api` Express, `packages/core|infra|contracts`, Drizzle on Supabase Postgres, Supabase Storage, Zod at boundaries), with these changes:

### 7.1 Deployment: Vercel for both
- Two Vercel projects from the monorepo: `apps/web` and `apps/api` (Express runs as one Vercel Function).
- Function duration is capped (300 s on Hobby), and instances share no memory, so:
  - **Live updates**: the SSE stream checks the room's state version in Postgres about once per second and pushes a fresh snapshot when it changes. Clients reconnect automatically when the stream closes and resync from the snapshot.
  - **Timers**: deadlines (countdown end, game end) are stored as timestamps and enforced whenever any request or stream poll touches the room. Transitions are conditional updates so they apply once.
  - **Background work**: preparation and announcements run after the response via Vercel `waitUntil`, are idempotent, and record status so a later request can resume unfinished work.
- **Sessions across domains**: web and API are on different domains, so the guest token is sent as a bearer header, and as a query parameter for the SSE stream; no cross-site cookies.
- **Uploads**: Vercel request bodies are limited to ~4.5 MB, so the client resizes photos (about 1280 px long side, JPEG) before upload.

### 7.2 Data shape (indicative; details left to the builder)
- `rooms`: code, status (lobby, countdown, active, finished), phase (races, solo), time limit, countdown end, game end, state version.
- `players`: room, nickname, session token hash, status (active, eliminated, out_of_attempts), failed attempts.
- `targets`: room, owner, private image path, validation status, clue texts, audio paths, hint image path, preparation status, found by, found at, points.
- `clues`: target, hunter, kind (voice, visual), issued at, second clue used, status (active, won, lost, cancelled).
- `submissions`: clue, image path, idempotency key, verdict, evidence.
- `events`: room, sequence, type, payload — the feed for announcements, spectators, and recap.

### 7.3 Privacy
- Reference photos live in a private storage bucket and are never sent to other players until the recap.
- Fal receives a short-lived signed URL; generated hints are copied into our bucket and shown only to their challenger (and to spectators/recap).
- All provider keys stay in `apps/api`.

## 8. Left to the Builder
- Exact Gemma prompts, evidence schema, and acceptance threshold (informed by the spike).
- Voice choice within "game-show host", and announcement wording.
- Mascot name and visual design (through Impeccable).
- Table and column details, API routes, event payloads.
- Breaking the work into small stacked PRs per `pr-sca`.
