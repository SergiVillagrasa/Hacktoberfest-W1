# SnapHunt Product Brief

## Hackathon Context

SnapHunt is being built for the **Hacktoberfest Open-Source AI Challenge: Week 1**. The challenge runs from October 5 through **October 11, 2026 at 11:59 PM PDT** (October 12 at 06:59 UTC). Its **Touch Grass** prompt asks for a new project with open-source AI at its core that gets people away from screens and into the physical world.

The project is a strong thematic match because the phone is used briefly to receive clues and capture evidence while most play happens by moving through a real place and interacting with friends.

Challenge requirements and judging priorities:

- Build a new project during the challenge window; work on an existing project does not qualify.
- Open-source or open-weight AI must be central to how the project works. Fal and ElevenLabs can complement the project, but proprietary hosted APIs alone do not satisfy this requirement.
- Publish one DEV submission using the challenge template and the required `#hf26challenge` tag.
- Explain why the open approach matters and where it is better than a closed alternative.
- Writing quality is weighted most heavily, followed by relevance, creativity, technical execution, and optional partner usage.
- Testing the game in the physical world and reporting what happened earns bonus consideration.
- The project can qualify for the overall prize and every partner category it genuinely uses, but can win only once in this challenge.
- Relevant partner categories include **Best Use of ElevenLabs**, **Best Use of Mastra**, **Best Use of MongoDB Atlas**, **Best Use of Render**, **Best Use of DigitalOcean**, and **Best Use of Gemma**.
- Saving and embedding the development agent session with DevRelay is optional but can help judges understand the process.

Authoritative challenge source: [Hacktoberfest Open-Source AI Challenge: Week 1](https://dev.to/events/challenges/hacktoberfest-week1-2026-10-05), retrieved through DevRelay on October 11, 2026.

Hacktoberfest 2026 no longer rewards pull-request counts. Participation centers on events, DEV Challenges, Global Hack Week, and open-source AI activities. General program source: [Hacktoberfest 2026](https://hacktoberfest.com), verified by the DevRelay knowledge guide on September 30, 2026.

## Product Pitch

SnapHunt is a real-world, multiplayer photo scavenger hunt moderated by an AI agent. Friends secretly photograph nearby objects, receive clues for one another's targets, race to identify and photograph those objects, and unlock transformed visual clues that create interference and risk for other players.

The design goal is to make the screen the shortest part of the experience: look at or listen to a clue, put the phone down, search the room or outdoor location, and return only to submit a photograph.

## Core Game Loop

### 1. Create targets

Each player joins a room and photographs one object in the shared play area. A target belongs to its creator, but the creator never receives their own target as an assignment.

Before play begins, the backend validates that every target:

- contains one sufficiently clear primary object;
- is safe and appropriate for the game;
- is not a duplicate of another submitted target;
- does not expose a target image to unauthorized players.

### 2. Assign hunters

Once every player is ready, the moderator randomly assigns each player another participant's target. The assignment must be a derangement: nobody can be assigned their own object. The backend, rather than an AI agent or client, is authoritative for assignments.

### 3. Deliver voice clues

The AI moderator analyzes each target and writes an indirect clue that describes it without naming it or revealing its exact location. ElevenLabs converts the clue to speech. Initially, each hunter receives only the voice clue for their assigned target.

### 4. Find and verify

A hunter searches the physical area, photographs what they believe is the target, and submits the image. Gemma 4 31B IT compares the submission with the private reference image and returns structured evidence. A match requires the exact physical object, not merely another object of the same category. Each player may make at most five failed verification attempts in a round. The backend applies the acceptance threshold, enforces the attempt limit, and owns the final game-state transition.

A verified discovery:

- marks the target as found exactly once;
- awards one point to the successful hunter;
- records evidence for later review;
- triggers generation of a visual clue for another unresolved target.

### 5. Unlock visual interference clues

After a successful discovery, Fal transforms the reference photo of another unresolved target into an indirect visual hint. The transformed image should preserve enough of the target's silhouette or identity to be inferable while hiding its exact appearance and surroundings.

The moderator randomly chooses the visual clue's target from the legally eligible unresolved targets and assigns it to the successful hunter, creating a race against the player who holds that target's original voice clue. Players cannot choose the next target. A successful player can chain through multiple visual clues, but can hold only one active visual clue at a time.

- If the original hunter finds the target first, the successful hunter remains active and may later receive a visual clue for a different unresolved target.
- If the player holding the Fal visual clue finds the target first, the player holding the original voice clue is eliminated for the remainder of the round.
- When too few active players or eligible targets remain to create a legal clue race, the game switches to a final solo-hunt phase. Remaining active players continue pursuing their assigned unresolved targets without visual challengers or further eliminations.
- A resolved target cannot produce another claim or score.

### 6. Finish and rank

The round ends when every target has been found or when no active player can legally pursue an unresolved target. The player with the most verified discoveries wins. Ties require a deterministic rule before implementation; suggested default: earliest final successful discovery wins.

## Roles and Responsibilities

### Host

- Creates the room and starts the round.
- Can remove players before the round starts.
- Can review disputed verification results.
- Cannot manually choose assignments or clues.

### Player

- Submits one target image.
- Receives one initial voice-clue assignment that is not their own target.
- Searches, submits candidate photographs, earns points, and may unlock visual clues.
- Can be eliminated from active searching but remains able to view round progress.

### AI moderator

- Identifies target attributes and drafts non-revealing clues.
- Produces structured similarity evidence for candidate verification.
- Requests ElevenLabs speech and Fal visual-clue generation through backend adapters.
- Never directly changes scores, assignments, elimination state, or ownership.

## AI and Provider Strategy

The challenge requires open AI at the project's core. **Gemma 4 31B IT** is the selected open-weight multimodal model for central target understanding, clue writing, and exact-object photo verification. Mastra orchestrates this path. The submission must document Gemma's license, inference provider or deployment mode, and why its replaceable open-weight role is preferable to putting the core mechanic behind a proprietary model.

Provider roles:

- **Gemma 4 31B IT:** central target understanding, textual clue generation, and exact-instance candidate/reference comparison.
- **Mastra:** moderator-agent orchestration and structured tool flow.
- **ElevenLabs:** TTS rendering of the moderator's clue; this supports the Best Use of ElevenLabs category but is not the open-AI core.
- **Fal:** image-to-image transformation for visual hints.

Fal MCP research found no candidate that could guarantee both identity/composition preservation and an end-to-end response under 15 seconds. `fal-ai/nano-banana-2/edit` is a practical prototype candidate because it accepts image references and one generated output; observed execution latency was p50 11,764 ms and p90 20,881 ms over successful mixed workloads, excluding queue and startup time. It therefore needs real-device testing and a loading/fallback state rather than a hard 15-second promise. The visual hint shows the pug mascot host doing a playful action with a simplified cartoon of the object, using the target photo plus one canonical pug image as references (about 13-15 s observed for one image). The recommended prototype settings are one image, 0.5K or 1K resolution, WebP output, web search disabled, and a prompt that removes location-specific details while preserving the object's silhouette and distinctive non-text features.

Generated clues must be treated as private game data. Original target photos must never be sent to clients other than through an authorized transformed clue, and provider retention controls should be disabled where available.

## Visual-Clue Acceptance Contract

Before using a Fal output in a round, verify that it:

- contains the same target category and recognizable silhouette;
- does not include readable labels, serial numbers, faces, or exact location cues;
- does not reveal the original photograph unchanged;
- remains readable at a small mobile size;
- has only one intended target;
- can be rejected and regenerated without changing game state.

A generated image is not accepted merely because it looks attractive. It must survive the next production step: functioning as a fair, indirect clue.

## Fairness and State Invariants

- Each player submits exactly one target before assignments are created.
- No player receives their own target as the initial assignment.
- Every target has at most one initial voice-clue hunter.
- Every unresolved target has at most one active visual-clue challenger.
- Visual-clue targets are selected randomly by the moderator from legally eligible unresolved targets.
- A player may earn multiple visual clues sequentially but can hold at most one active visual clue.
- A player cannot simultaneously hold the voice and visual clue for the same target.
- When no legal clue race can be created, the game enters solo-hunt mode and disables further eliminations.
- A target can be claimed exactly once, enforced transactionally by the backend.
- A successful submission awards at most one point.
- Verification requires the exact physical target, not a semantically equivalent object.
- Each player can make at most five failed verification attempts per round.
- Eliminated players cannot submit new discoveries during that round.
- Disconnects do not erase identity, assignments, score, or elimination state.
- Provider retries are idempotent and cannot duplicate clues or points.
- Timers and delayed AI jobs are room-scoped and cancelled when the round ends.

## Minimum Viable Demo

The hackathon demo should prioritize one complete, understandable round over breadth:

1. Three or more guest players join one room.
2. Each captures one target.
3. The server creates valid non-self assignments.
4. Each player receives an AI-written ElevenLabs voice clue.
5. One player submits a matching photo and receives a point.
6. Fal produces one visual clue for another unresolved target.
7. Two players race for that target and the loser of the clue race is eliminated.
8. The remaining targets are resolved and the leaderboard names a winner.
9. The team plays it in a real location and captures evidence for the DEV write-up.

## Submission Narrative

The DEV post should lead with the physical playtest and explain how SnapHunt makes AI a moderator rather than the activity itself. It should explicitly show:

- how little screen time the loop requires;
- why open-weight vision and clue generation are central;
- how private object photos and locations are protected;
- how provider adapters allow models to be swapped;
- how ElevenLabs improves accessibility and social play;
- how Fal turns an already-found object into a new game mechanic rather than decorative output;
- what failed or changed during the real-world playtest;
- an architecture diagram and short video or screenshots of the full round.

## Sponsor and Event Findings

The connected account is registered for Hacktoberfest 2026 and the Week 1 challenge. DevRelay returned no event-specific claimable offers and no sponsor Agent Skills for the Week 1 event on October 11, 2026. The challenge page nevertheless states that some partner credits, including ElevenLabs credits, may be available through the Hacktoberfest participant dashboard, so the team should check that dashboard manually before purchasing usage.

## Resolved Product Decisions

All core game rules are now locked:

1. **Eliminated players:** spectator-only; they cannot submit discoveries, disputes, or reviews.
2. **Failed-attempt cooldown:** none; the five-attempt limit per round is the only throttle.
3. **Verification threshold:** must be the same physical object photographed from a different position or angle. The model compares distinctive features, wear marks, labels, surroundings, and object-specific details to confirm identity rather than mere category similarity.
4. **Tie-breaker:** earliest timestamp of the final successful discovery wins.
5. **Play setting:** primarily outdoors; any shared physical space is allowed, but the game is designed for and best demonstrated in outdoor environments.
6. **Gemma 4 31B IT inference:** hosted through Google AI Studio with a user-provided API key. The backend calls the Gemini API with the `gemma-4-31b-it` model identifier.

## Community References

- [The Two-Map Party Game Server: Building GameNight Without a Database](https://dev.to/abhijat_chaturvedi/the-two-map-party-game-server-building-gamenight-without-a-database-4phb), by [Abhijat Chaturvedi](https://dev.to/abhijat_chaturvedi): useful patterns include room-scoped timers, server-authoritative state, deliberate reconnect identity, and deriving win conditions from current state instead of maintaining duplicate flags.
- [A six-asset acceptance test for AI game art generators](https://dev.to/framesprite/a-six-asset-acceptance-test-for-ai-game-art-generators-5enj), by [FrameSprite](https://dev.to/framesprite): generated media should be judged by whether it remains predictable and usable in the downstream game mechanic, not by visual polish alone.
