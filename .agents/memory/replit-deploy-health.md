---
name: Replit autoscale deploy health checks
description: How the api-server deployment's promote/health probe works and how to debug "failed to publish" here.
---

# Replit autoscale promote / health behavior

- The promote gate uses the artifact's `[services.<name>.production.health.startup].path` (here `/api/healthz`, a trivial no-DB 200). It does NOT gate on the base service path `/api`.
- **Proof:** builds have promoted successfully while bare `GET /api` returned 404 (Express `app.use("/api", router)` had no base handler). So a 404/500 on `/api` does NOT fail promote.
- The recurring runtime log `healthcheck /api returned status 500` / `connection refused` is a separate, non-fatal router liveness probe during cold-start windows (autoscale scales to zero; `signal: terminated` on idle is normal). It is noise, not the promote failure cause.
- A base `GET /` handler was added to the health router so `/api` returns 200 too — good hygiene, quiets the noise, but was NOT the root cause of any promote failure.

**Why:** A "deployment build failed to publish" was misattributed to `/api` 404. Build phase actually succeeded every time; failures are at the promote step and are usually transient health-timeout, OR the failed build simply predates the fix commit.

**How to apply when debugging "failed to publish":**
1. `listDeploymentBuilds` → build phase almost always `success`; the failure is promote.
2. Compare the failed build's `timeCreated` against `git log` commit times — the failing build often predates your fix, so "it failed again" may just mean no new build was ever created. Have the user click Publish to create a fresh build, then re-check.
3. `getDeploymentInfo().hasSuccessfulBuild=true` means the live URL is still serving the last good build even while a newer one fails.
4. pino spawns its transport worker only when `NODE_ENV !== production`; in prod the logger uses no worker (not a startup-crash source).
