---
name: Root package.json guard
description: The workspace root package.json and each artifact's package.json must not get swapped/clobbered.
---

# Root vs artifact package.json

The repo root `package.json` is the pnpm workspace orchestration manifest: `name: "workspace"`, holds only root scripts (`build`, `typecheck`, `typecheck:libs`, `preinstall`) and shared dev tooling (prettier, typescript). Each artifact keeps its OWN `package.json` (e.g. `artifacts/accounting-app/package.json`, `name: "@workspace/accounting-app"`).

**Symptom of corruption:** root `package.json` has `name: "@workspace/accounting-app"` and an artifact's deps, while `artifacts/accounting-app/package.json` is deleted (git `D`). This breaks workspace topology, `pnpm run typecheck` runs the wrong single project, and deploy/build behave wrongly.

**Why:** something (an errant edit/tool) overwrote root with the artifact manifest. Architect review caught it via git diff.

**How to apply:** recover both from git HEAD (`git show HEAD:package.json`, `git show HEAD:artifacts/<name>/package.json`) and write them back, then `pnpm install` + root `pnpm run typecheck` (should show "Scope: N of M workspace projects", not a single project). Always sanity-check `git --no-optional-locks status --short` for unexpected `package.json` M/D after big changes.
