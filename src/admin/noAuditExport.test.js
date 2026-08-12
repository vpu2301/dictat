// noAuditExport.test.js — the admin audit viewer must offer NO way to take
// the log out of the app as a file. The DSAR/legal paths own exports; a
// casual file drop from an admin screen is a data-leak surface, deliberately
// absent (sprint 17). This pins the absence by grepping the source, the same
// technique as src/company/noInlineMocks.test.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const GUARDED = [
  join(here, "pages", "AuditAdmin.jsx"),
  join(here, "AdminRoutes.jsx"),
];

// The tokens any file-egress affordance would need. Checked case-insensitively
// so a translated label cannot slip an English mechanism through.
const FORBIDDEN = [
  /\bexport\w*\s*\(/i,     // exportCsv(, exportJson( …
  /csv/i,
  /\bdownload\b/i,
  /createObjectURL/i,
  /new Blob\(/i,
  /\.click\(\)/i,          // the a.click() trick behind every file drop
  /вивантаж(ити|ення)\b/i, // a Ukrainian-labelled affordance is still one
];

for (const file of GUARDED) {
  test(`no file-egress affordance in ${file.split("/").slice(-2).join("/")}`, () => {
    const src = readFileSync(file, "utf8");
    for (const pattern of FORBIDDEN) {
      const hit = src.match(pattern);
      assert.equal(
        hit,
        null,
        `found ${pattern} → "${hit && hit[0]}" — the admin audit surface must not offer file egress`,
      );
    }
  });
}
