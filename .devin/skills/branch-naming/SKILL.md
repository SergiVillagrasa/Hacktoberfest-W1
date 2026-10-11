---
name: branch-naming
description: Name implementation branches for this repo as {username}/eng-{n}-{short-slug}. Use before creating any branch or changing code for a feature, fix, component, backend, or frontend change.
---

# Branch naming

Every implementation branch is named:

```txt
{username}/eng-{n}-{short-slug}
```

- `username`: the GitHub login of the author, e.g. `gh api user --jq .login` (`SergiVillagrasa`).
- `n`: the next free number. Run `git fetch origin` and `git ls-remote --heads origin`, find the highest `eng-{n}` on any remote branch, and add 1. Start at `eng-1` if none exist. Never reuse a number, even from a merged or deleted branch you know about.
- `short-slug`: 2–5 lowercase, hyphen-separated words describing the change, e.g. `guest-sessions`, `assignment-derangement`.

Examples: `SergiVillagrasa/eng-1-monorepo-scaffold`, `SergiVillagrasa/eng-2-core-game-models`.

Rules:

- Do not use `feat/`, `fix/`, or `chore/` prefixes.
- Do not omit the `eng-{n}` segment.
- One branch per feature, fix, component, backend change, or frontend change.
- Branch from `main` unless the work depends on another unmerged branch; then stack on that branch and target it in the PR.
