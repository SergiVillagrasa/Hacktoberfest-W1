---
name: pr-sca
description: Keep every pull request Small, Concise, and Atomic. Use when planning work into branches, before opening a PR, and when a change grows large enough to need splitting or stacking.
---

# PR SCA: Small, Concise, Atomic

Check every PR against all three before opening it:

- **Small:** about 200 lines of code net or less (`git diff --shortstat main...HEAD`). Generated files such as `bun.lock` and migration snapshots don't count toward the limit.
- **Concise:** one responsibility. A reviewer can describe it in one sentence. Don't mix refactors, formatting, or unrelated fixes into feature work.
- **Atomic:** revert-safe and deployable on its own. `main` builds and its tests pass after merging it, and reverting it doesn't break other merged work.

When a change is too large:

1. Split by layer along the dependency direction: `contracts` → `core` (models, use cases, ports, tests) → `infra` adapters → `api` routes/controllers → `web` UI.
2. If later pieces depend on earlier unmerged ones, stack branches: each branch targets its parent branch, and each PR is reviewed on its own diff.
3. Land behind unused code paths rather than half-wired features: a port and its use case can merge before any route calls them.
