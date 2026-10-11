# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (App Router, Turbopack), React, HeroUI v3 on Tailwind CSS v4, TypeScript, in a Bun workspace (`apps/web`). The web app talks only to the API in `apps/api` over HTTP and server-sent events and is deployed on Vercel. Mobile web is the target; there is no native wrapper.

## Users

Friends playing outdoors, 2 to 6 per game, each on their own phone. They join a shared room with a short code and a nickname, play a round of 10 to 30 minutes, and look at the screen mainly to hear or read a clue, take a photo, and see results. No accounts. The room creator sets the time limit and starts the game.

## Product Purpose

SnapHunt is a real-world photo scavenger hunt that gets people off their screens. Each player secretly photographs an object nearby; the game hands every player another player's object to find, using spoken and picture clues from an AI game-show host. Success is a full outdoor round that runs start to finish on phones without anyone touching a laptop, ending with a recap gallery of every find.

## Positioning

An open-weight AI judge decides whether a photo shows the exact same physical object as the secret reference photo, taken from a different angle, so lookalikes fail. The clues are given by a pug mascot host with a game-show voice, and clue races between players can knock a hunter out. A neighboring photo game that only matches categories or relies on human judging could not truthfully claim this.

## Operating Context

Outdoors, in daylight, standing or walking, often holding a phone in one hand. Connections may be flaky mobile data, so the screen resyncs from the server after reconnects and reloads. Photos come from the phone camera. Clues are spoken through the phone speaker and also shown as text. The game clock is server-authoritative. The host and moderator speak English.

## Capabilities and Constraints

- Create a room with a time limit of 10, 15, 20 or 30 minutes; join with a 5-character room code and a nickname; the creator can remove players before the start.
- Each player photographs one target; the game accepts or rejects it with a friendly reason and a retake. Start is enabled only with at least 2 players and every target accepted.
- A 5-second countdown precedes the hunt. Each hunter gets a voice clue, can replay it, and can ask once for a more specific second clue at a point cost. A picture-clue race gives a hunter a stylized picture of someone else's object; finding it first can eliminate the other hunter.
- Each player has 5 failed photo attempts for the whole game. If the AI judge is unavailable for about 20 seconds, the attempt does not count and the host gives an extra clue.
- Eliminated or out-of-attempts players spectate. Results show a ranking and a recap gallery with the original photo, the photo that found it, the clue and the hint.
- Original target photos stay private until the game ends. Provider keys never reach the browser.
- The full rule set is described in `docs/design_plans/2026-10-11-snaphunt-game-design.md`.

## Brand Commitments

- Name: SnapHunt.
- The host mascot is a pug, a flat 2D illustration with a plain red bow tie, the canonical image is `packages/infra/assets/pug-mascot.webp`. No blush cheeks and no whiskers.
- The host voice is a friendly game-show host (ElevenLabs, English).
- Friendly and kind, inspired by Kahoot and Duolingo. This was stated by the product owner and is recorded as a binding reference; its visual interpretation is not decided here.

## Evidence on Hand

- The canonical pug mascot image and five generated pug-with-object hint examples (local only, not committed).
- A working backend with real AI photo verification, speech and hint generation, deployed at https://snaphunt-api.vercel.app.
- A verification spike on one real object (a plush) comparing two vision models.
- No real playtest has happened yet and there are no testimonials, user counts or benchmarks to cite; none may be invented.

## Product Principles

- The physical world is the game board; the phone is a clue receiver and a camera, not the destination.
- Never leave a player stuck: every provider failure has a visible fallback, and text always accompanies audio.
- Secrets stay secret: other players' objects are never shown before the end.
- Fairness is enforced by the server, so a refresh, reconnect or closed phone never changes the outcome.
- Short, encouraging copy; the mascot reacts to what just happened.

## Accessibility & Inclusion

- Readable in bright sunlight: high contrast and large type.
- Big tap targets that work one-handed.
- Spoken clues are never audio-only; the text is always shown.
- Mascot motion and celebrations respect `prefers-reduced-motion`.
