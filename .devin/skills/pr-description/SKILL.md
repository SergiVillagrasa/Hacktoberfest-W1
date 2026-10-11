---
name: pr-description
description: Write pull request titles and bodies for this repo. Use whenever creating or updating a PR: conventional-commit title without eng-N, body with only "## What" and "## Why".
---

# PR description

## Title

Conventional commits: `type(optional-scope): outcome`

- `type` is one of `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`, `ci`, `perf`.
- `scope` is optional and names the area: `api`, `web`, `core`, `infra`, `contracts`, `db`.
- `outcome` is lowercase, imperative, and says what changes for the user or system, not how.
- Never include `eng-N` or the branch name in the title.

Examples: `feat(core): assign targets as a derangement`, `fix(api): reject claims on already-found targets`.

## Body

Exactly two sections, in this order, and nothing else (no test plan, checklist, or screenshots section):

```md
## What
<1–4 bullets: the concrete changes>

## Why
<1–3 sentences: the problem or goal this serves>
```

Keep it short; reviewers read the diff for details.
