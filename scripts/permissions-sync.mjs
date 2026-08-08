#!/usr/bin/env node
// EVA-S01: keep dictat's vendored docs/auth/permissions.csv byte-identical to
// the backend's copy (medical-dictation-backend/docs/auth/permissions.csv).
//
// The CSV is the *fixture* the drift test (src/auth/permissionsDrift.test.js)
// reads. A vendored copy that has quietly fallen behind the backend turns that
// test into theatre: it would prove the MATRIX matches a file nobody updates.
// So there are two guards, and this script is the outer one —
//
//   npm run auth:permissions -- --check   → CI: fail if the vendored copy drifts
//   npm run auth:permissions              → dev: pull the backend copy over it
//
// …and the drift test is the inner one (CSV ↔ MATRIX). Both must hold.
//
// The backend checkout is a sibling of this repo by default; override with
// PERMISSIONS_CSV_SRC when it lives elsewhere. If the backend is not checked
// out, --check SKIPS (exit 0, loud message) rather than failing: a frontend-only
// CI runner has nothing to compare against, and the drift test still runs.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dest = path.resolve(here, "../docs/auth/permissions.csv");
const src =
  process.env.PERMISSIONS_CSV_SRC ??
  path.resolve(here, "../../dictate/medical-dictation-backend/docs/auth/permissions.csv");

const check = process.argv.includes("--check");

let upstream;
try {
  upstream = await readFile(src, "utf8");
} catch {
  const msg = `permissions.csv source not readable: ${src}`;
  if (check) {
    console.log(`SKIP — ${msg}\n      (frontend-only checkout; the CSV↔MATRIX drift test still runs)`);
    process.exit(0);
  }
  console.error(`${msg}\nSet PERMISSIONS_CSV_SRC to the backend's docs/auth/permissions.csv.`);
  process.exit(1);
}

const vendored = await readFile(dest, "utf8").catch(() => null);

if (check) {
  if (vendored === upstream) {
    console.log(`ok — docs/auth/permissions.csv matches ${src}`);
    process.exit(0);
  }
  console.error(
    `DRIFT — docs/auth/permissions.csv differs from the backend copy.\n` +
      `  backend:  ${src}\n  vendored: ${dest}\n` +
      `Run \`npm run auth:permissions\`, then re-run the drift test: the MATRIX in\n` +
      `src/auth/roles.js may need new rows.`,
  );
  process.exit(1);
}

if (vendored === upstream) {
  console.log("ok — already in sync, nothing written");
  process.exit(0);
}
await writeFile(dest, upstream);
console.log(`wrote ${dest} from ${src}`);
