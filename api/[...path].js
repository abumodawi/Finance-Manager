// Vercel serverless catch-all for the API.
//
// Vercel natively routes every request under `/api/*` to this file and passes
// the ORIGINAL request URL (e.g. `/api/summary/account-breakdown`) unchanged,
// which is exactly what the Express app expects (it mounts its router at
// `/api`). No `vercel.json` rewrite is needed for the API path.
//
// The actual Express app is bundled at deploy time into `./_server.cjs` by
// `pnpm --filter @workspace/api-server run build:vercel`. The leading
// underscore keeps Vercel from treating that bundle as its own function while
// still tracing and including it as a dependency of this entry.
module.exports = require("./_server.cjs");
