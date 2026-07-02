import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import { rm } from "node:fs/promises";

// Plugins/resolvers may use `require`.
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
// artifacts/api-server -> repo root
const repoRoot = path.resolve(artifactDir, "..", "..");
// The committed Vercel function entry (api/[...path].js) requires this
// generated, self-contained bundle. The leading underscore makes Vercel treat
// it as a private helper (not its own function), while it is still traced and
// included as a dependency of the catch-all function.
const outfile = path.resolve(repoRoot, "api", "_server.cjs");

async function buildVercel() {
  await rm(outfile, { force: true });

  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/vercel.ts")],
    platform: "node",
    target: "node20",
    bundle: true,
    format: "cjs",
    outfile,
    logLevel: "info",
    // Native/dynamically-loaded modules that cannot be bundled. `pg-native`
    // is optional for `pg` and is not used (we rely on the pure-JS driver).
    external: [
      "*.node",
      "pg-native",
      "sharp",
      "better-sqlite3",
      "sqlite3",
      "canvas",
      "bcrypt",
      "argon2",
      "fsevents",
      "cpu-features",
    ],
    // Re-export the Express app as `module.exports` so Vercel's Node runtime
    // picks it up regardless of ESM/CJS interop.
    footer: {
      js: "if (module.exports && module.exports.default) { module.exports = module.exports.default; }",
    },
  });
}

buildVercel().catch((err) => {
  console.error(err);
  process.exit(1);
});
