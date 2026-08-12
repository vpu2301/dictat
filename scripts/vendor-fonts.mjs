#!/usr/bin/env node
// vendor-fonts.mjs — download the webfonts into public/fonts and regenerate
// src/fonts.css. Run after changing a family or a weight:
//
//     npm run fonts:vendor
//
// Why this exists at all: sprint 16's CSP is `default-src 'self'` with no
// third-party origins, and the app used to pull three families from
// fonts.googleapis.com / fonts.gstatic.com. See the header of src/fonts.css.
//
// Two things this does that a naive download does not:
//
//  1. DEDUPE. Geist, Geist Mono and Manrope are variable fonts. Google's CSS
//     emits one @font-face per requested weight, but every one of them points
//     at the SAME woff2 (byte-identical — verified by hash). Storing four
//     copies of one file and shipping four <link>s worth of @font-face is
//     pure waste, so each (family, subset) is fetched once and declared with
//     a weight RANGE.
//  2. SUBSET. Google offers latin, latin-ext, cyrillic, cyrillic-ext,
//     vietnamese and a symbols subset. src/i18n.js ships uk/en/pl/de/ro/cs/
//     sr/hu — the first four subsets cover every one of them. The other two
//     are dropped rather than vendored and never used.
//
// `unicode-range` is copied verbatim from Google's CSS, so the browser still
// downloads only the subsets a given page actually needs.

import { mkdir, readdir, rm, writeFile, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FONT_DIR = join(ROOT, "public", "fonts");
const CSS_OUT = join(ROOT, "src", "fonts.css");

// A modern desktop UA — Google serves woff2 only to browsers it recognises.
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// The families, exactly as styles.css asks for them. `range` is the CSS
// font-weight range declared for the variable file.
const SPECS = [
  {
    url:
      "https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700" +
      "&family=Geist+Mono:wght@400;500&display=swap",
    families: { Geist: "300 700", "Geist Mono": "400 500" },
  },
  {
    url: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap",
    families: { Manrope: "400 800" },
  },
];

const SUBSETS = ["cyrillic-ext", "cyrillic", "latin-ext", "latin"];

// Licensed faces that are NOT downloadable — the file arrives with a purchase
// and is committed to public/fonts by hand. They are listed here for one
// reason: the sweep at the end of main() deletes every file in public/fonts
// that this script did not itself put there, so a hand-placed woff2 that the
// script does not know about disappears on the next `npm run fonts:vendor`.
// Declaring them keeps them, and emits their @font-face into the same
// generated stylesheet so there is still exactly one place fonts are declared.
const LOCAL = [
  {
    family: "Galgo",
    file: "galgo-condensed.woff2",
    weight: "200 700",
    // The OFL requires the licence to travel with any redistributed copy, and
    // serving the woff2 from /fonts IS redistribution — so it ships beside the
    // font and is kept from the sweep for the same reason the font is.
    license: "GALGO-LICENSE.txt",
    // No `unicode-range` split, unlike the Google faces above. Those ship one
    // file per subset because the full family is ~100KB a subset; Galgo is a
    // single 28KB variable file covering Latin AND Cyrillic, so splitting it
    // would trade one request for two to save nothing.
    note:
      "Galgo Condensed Variable by Giulia Boggio (giuliaboggio.xyz), SIL OFL —\n" +
      "   marketing display headlines only, see public/fonts/GALGO-LICENSE.txt.",
  },
];

const HEADER = `/* fonts.css — self-hosted webfonts. NOT a style choice: a CSP one.
 *
 * These three families used to arrive as two \`@import url(fonts.googleapis…)\`
 * rules in styles.css plus a <link> in index.html. That is three things the
 * sprint-16 policy cannot allow and one it should not want:
 *
 *   · \`style-src\` would have to name fonts.googleapis.com (Google serves the
 *     @font-face CSS) and \`font-src\` fonts.gstatic.com — two third-party
 *     origins in the policy of a platform that handles patient data, and two
 *     more places an XSS could be staged from.
 *   · every clinician's IP and User-Agent would reach Google on every page
 *     load of a medical record system. No consent covers that.
 *   · a clinic behind an egress proxy loses its typography entirely.
 *
 * Self-hosting removes all four problems and lets the policy stay
 * \`font-src 'self'\` with nothing else in it.
 *
 * GENERATED, not hand-written — regenerate with \`npm run fonts:vendor\` after
 * changing a family or a weight. All three families are VARIABLE fonts, so
 * Google returns one identical woff2 for every weight in the range: the
 * generator dedupes those (24 files → 12) and declares a weight RANGE per
 * face. Subsets are latin, latin-ext, cyrillic and cyrillic-ext — the eight
 * languages in src/i18n.js LANGS need exactly those; vietnamese and the
 * symbols subset are dropped. \`unicode-range\` is preserved verbatim, so a
 * Ukrainian page still downloads only the Cyrillic files.
 *
 * Galgo is the exception to every line above: a LICENSED file that was bought,
 * not fetched, so it lives in public/fonts as a committed artefact and is only
 * DECLARED here. It is the marketing site's display face — headlines under
 * \`.lp\` — and the logged-in platform never asks for it, so no clinician ever
 * downloads it. Licence: SIL OFL, public/fonts/GALGO-LICENSE.txt.
 */
`;

const slugOf = (family) => family.toLowerCase().replace(/\s+/g, "-");

async function fetchText(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`GET ${url} → ${r.status}`);
  return r.text();
}

async function fetchBytes(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`GET ${url} → ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

// Google's CSS is a flat list of `/* subset */ @font-face { … }` pairs.
function parseFaces(css) {
  const out = [];
  const re = /\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[\s\S]*?\})/g;
  for (const [, subset, block] of css.matchAll(re)) {
    out.push({
      subset,
      family: /font-family:\s*'([^']+)'/.exec(block)[1],
      unicodeRange: /unicode-range:\s*([^;]+);/.exec(block)[1].trim(),
      url: /url\((https:\/\/[^)]+)\)/.exec(block)[1],
    });
  }
  return out;
}

const exists = (p) => access(p).then(() => true, () => false);

async function main() {
  await mkdir(FONT_DIR, { recursive: true });

  const kept = new Set();
  const faces = [];

  // Licensed local faces first — they are declared, not fetched. A missing
  // file is a hard error rather than a silent skip: the alternative is a
  // stylesheet that quietly stops mentioning the brand display face and a
  // marketing site that silently falls back to Geist.
  for (const l of LOCAL) {
    if (!(await exists(join(FONT_DIR, l.file)))) {
      throw new Error(
        `${l.file} is missing from public/fonts — it is a licensed file, not a ` +
          `download. Restore it from the purchase before regenerating.`,
      );
    }
    kept.add(l.file);
    if (l.license) kept.add(l.license);
    faces.push(
      [
        `/* ${l.note} */`,
        "@font-face {",
        `  font-family: '${l.family}';`,
        "  font-style: normal;",
        `  font-weight: ${l.weight};`,
        "  font-display: swap;",
        `  src: url('/fonts/${l.file}') format('woff2');`,
        "}",
      ].join("\n"),
    );
  }

  for (const spec of SPECS) {
    const parsed = parseFaces(await fetchText(spec.url));
    for (const subset of SUBSETS) {
      for (const [family, weightRange] of Object.entries(spec.families)) {
        const face = parsed.find((f) => f.subset === subset && f.family === family);
        if (!face) continue;
        const file = `${slugOf(family)}-${subset}.woff2`;
        const path = join(FONT_DIR, file);
        if (!kept.has(file)) {
          if (!(await exists(path))) await writeFile(path, await fetchBytes(face.url));
          kept.add(file);
        }
        faces.push(
          [
            "@font-face {",
            `  font-family: '${family}';`,
            "  font-style: normal;",
            `  font-weight: ${weightRange};`,
            "  font-display: swap;",
            `  src: url('/fonts/${file}') format('woff2');`,
            `  unicode-range: ${face.unicodeRange};`,
            "}",
          ].join("\n"),
        );
      }
    }
  }

  // Anything left behind by an earlier run with a different family list is a
  // file the CSS no longer references — remove it rather than ship dead bytes.
  // LOCAL files were added to `kept` above, so this does not eat them.
  for (const f of await readdir(FONT_DIR)) {
    if (!kept.has(f)) await rm(join(FONT_DIR, f));
  }

  await writeFile(CSS_OUT, `${HEADER}\n${faces.join("\n\n")}\n`);
  console.log(`vendor-fonts: ${kept.size} files, ${faces.length} @font-face rules → src/fonts.css`);
}

main().catch((e) => {
  console.error(`vendor-fonts: ${e.message}`);
  process.exit(1);
});
