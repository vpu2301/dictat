#!/usr/bin/env node
// check-prod-bundle.mjs — what is allowed to reach a clinic.
//
//     npm run verify:bundle              # check ./dist
//     npm run verify:bundle -- --selftest  # prove the check can fail
//
// Sprint 16, extending the sprint-09 dev-signing gate (which lives in the
// BACKEND's `make ci` and only ever looked at backend config). Nothing had
// ever looked at this repo's build output, and the first run found something:
// SigningFlow.jsx carried a comment claiming the dev_password dialog was
// "tree-shaken out of production builds entirely", and it was not — hiding the
// radio button that opens a component does not remove the component, and
// `provider:"dev_password"` was sitting in the shipped bundle.
//
// WHAT IS CHECKED, AND WHY EACH ONE
//
//  · DEV SEAMS. `window.__mdxClient` exposes setAccessToken and tryRefresh to
//    anything running on the page. It is gated on import.meta.env.DEV; this
//    proves the gate works rather than trusting it.
//  · DEV SIGNING. `dev_password` issues signature_level='dev' envelopes — not
//    qualified, no legal weight. A dialog offering it inside a hospital is a
//    way to produce a signature that looks real and is not.
//  · DEV FLAG OVERRIDES. `mdx.flag.` is the localStorage seam that turns
//    feature flags on from the console. In production a flag is a build-time
//    constant, and it must stay one.
//  · THE EMBED HARNESS. A fake chat host running on fixtures, with no session
//    and no gate. Fine on a laptop, not on a domain a clinician trusts.
//  · index.html. No inline <script> or <style> (the CSP forbids them, and one
//    slipping in would force `unsafe-inline` back into the policy); no `nonce`
//    (the dev nonce is a constant — published, it would be a permanent
//    script-src bypass); no third-party origin.
//  · THE EMITTED POLICY. dist/_headers and dist/security-headers.nginx.conf
//    must exist, must ENFORCE rather than report, and must contain none of the
//    escape hatches.
//
// A string search is a blunt instrument, and deliberately so: it cannot be
// argued with, and it fails loudly in CI the moment a refactor puts one of
// these back. Where the marker could plausibly appear in innocent content
// (translation tables carry the words "dev signature" as UI copy), the marker
// chosen is the machine-readable one that only real code produces.

import { readFile, readdir, mkdtemp, cp, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Markers that must not appear in ANY emitted .js/.css asset.
const FORBIDDEN_IN_ASSETS = [
  {
    marker: "__mdxClient",
    what: "the dev-only API-client seam (src/api/client.js)",
    why: "it hands setAccessToken/tryRefresh to any script on the page",
  },
  {
    marker: "dev_password",
    what: "the dev signing provider (components/DevPasswordSign.jsx)",
    why: "it mints signature_level='dev' envelopes that are not qualified signatures",
  },
  {
    marker: "mdx.flag.",
    what: "the localStorage feature-flag override (src/api/services.js devFlagOverride)",
    why: "production flags are build-time constants and must not be switchable from a console",
  },
  {
    marker: "/chat/harness",
    what: "the evidence-chat embed harness route (src/App.jsx)",
    why: "it is an ungated fake host serving fixture data",
  },
  {
    marker: "AUTH_BYPASS_DEV",
    what: "an auth-bypass switch",
    why: "there is no circumstance in which a shipped bundle should mention one",
  },
];

// Markers that must not appear in dist/index.html.
const FORBIDDEN_IN_HTML = [
  { pattern: /<script(?![^>]*\bsrc=)[^>]*>/i, what: "an inline <script> block", why: "script-src 'self' forbids it" },
  { pattern: /<style[\s>]/i, what: "an inline <style> block", why: "style-src 'self' forbids it" },
  { pattern: /\snonce\s*=/i, what: "a nonce attribute", why: "the dev nonce is a constant; published it is a permanent script-src bypass" },
  { pattern: /\son[a-z]+\s*=\s*["']/i, what: "an inline event handler attribute", why: "script-src 'self' forbids it" },
  { pattern: /(?:src|href)\s*=\s*["']https?:\/\//i, what: "a third-party origin", why: "default-src 'self' names no other host" },
];

// Escape hatches that must not appear in the emitted policy.
const FORBIDDEN_IN_POLICY = ["'unsafe-inline'", "'unsafe-eval'", "'unsafe-hashes'"];

const failures = [];
const fail = (msg) => failures.push(msg);

async function assetFiles(dist) {
  const dir = join(dist, "assets");
  if (!existsSync(dir)) {
    fail(`no ${dir} — did the build run?`);
    return [];
  }
  const names = await readdir(dir);
  return names.filter((n) => n.endsWith(".js") || n.endsWith(".css")).map((n) => join(dir, n));
}

async function checkAssets(dist) {
  for (const file of await assetFiles(dist)) {
    const text = await readFile(file, "utf8");
    for (const { marker, what, why } of FORBIDDEN_IN_ASSETS) {
      if (text.includes(marker)) {
        fail(`${file.replace(ROOT + "/", "")} contains "${marker}" — ${what}. ${why}.`);
      }
    }
  }
}

async function checkHtml(dist) {
  const file = join(dist, "index.html");
  if (!existsSync(file)) { fail("no dist/index.html"); return; }
  const html = await readFile(file, "utf8");
  // Comments are content, not code: the head carries an explanatory one that
  // legitimately contains the word "nonce".
  const stripped = html.replace(/<!--[\s\S]*?-->/g, "");
  for (const { pattern, what, why } of FORBIDDEN_IN_HTML) {
    if (pattern.test(stripped)) fail(`dist/index.html contains ${what} — ${why}.`);
  }
}

async function checkEmittedPolicy(dist) {
  for (const name of ["_headers", "security-headers.nginx.conf"]) {
    const file = join(dist, name);
    if (!existsSync(file)) {
      fail(`no dist/${name} — the build emits the deployment headers; a bundle without them ships no policy.`);
      continue;
    }
    const text = await readFile(file, "utf8");

    if (!/Content-Security-Policy[^-]/i.test(text)) {
      fail(`dist/${name} carries no enforcing Content-Security-Policy` +
           (/Content-Security-Policy-Report-Only/i.test(text)
             ? " — it is REPORT-ONLY. That is a valid rollout stage, but not a shippable one (VITE_CSP_MODE)."
             : "."));
    }
    for (const hatch of FORBIDDEN_IN_POLICY) {
      if (text.includes(hatch)) fail(`dist/${name} policy contains ${hatch}.`);
    }
    for (const header of ["X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "frame-ancestors"]) {
      if (!text.includes(header)) fail(`dist/${name} is missing ${header}.`);
    }
    if (!/microphone=\(self\)/.test(text)) {
      fail(`dist/${name} does not grant the microphone — dictation cannot work.`);
    }
    if (!/camera=\(\)/.test(text)) {
      fail(`dist/${name} does not deny the camera.`);
    }
  }
}

async function run(dist) {
  failures.length = 0;
  if (!existsSync(dist)) { fail(`no ${dist} — run \`npm run build\` first.`); return failures; }
  await checkAssets(dist);
  await checkHtml(dist);
  await checkEmittedPolicy(dist);
  return failures;
}

// ── self-test ──────────────────────────────────────────────────────────
//
// A gate nobody has watched fail is a gate nobody knows works. This copies the
// real dist, seeds one regression at a time, and asserts that each is caught —
// then asserts the untouched copy passes, so the check is not simply failing
// on everything.
async function selftest() {
  const dist = join(ROOT, "dist");
  if (!existsSync(dist)) {
    console.error("check-prod-bundle --selftest: build first (`npm run build`).");
    process.exit(1);
  }

  const seeds = [
    {
      name: "a dev client seam left in the bundle",
      apply: async (dir) => {
        const [asset] = await assetFiles(dir);
        await writeFile(asset, (await readFile(asset, "utf8")) + "\nwindow.__mdxClient={};\n");
      },
    },
    {
      name: "the dev_password signing component back in the bundle",
      apply: async (dir) => {
        const [asset] = await assetFiles(dir);
        await writeFile(asset, (await readFile(asset, "utf8")) + '\nconst p={provider:"dev_password"};\n');
      },
    },
    {
      name: "an inline <script> in index.html",
      apply: async (dir) => {
        const f = join(dir, "index.html");
        await writeFile(f, (await readFile(f, "utf8")).replace("</head>", "<script>window.x=1</script></head>"));
      },
    },
    {
      name: "a third-party stylesheet back in index.html",
      apply: async (dir) => {
        const f = join(dir, "index.html");
        await writeFile(f, (await readFile(f, "utf8"))
          .replace("</head>", '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist"></head>'));
      },
    },
    {
      name: "unsafe-inline slipped into the emitted policy",
      apply: async (dir) => {
        const f = join(dir, "_headers");
        await writeFile(f, (await readFile(f, "utf8")).replace("script-src 'self'", "script-src 'self' 'unsafe-inline'"));
      },
    },
    {
      name: "the policy shipped as report-only",
      apply: async (dir) => {
        const f = join(dir, "_headers");
        await writeFile(f, (await readFile(f, "utf8"))
          .replace("Content-Security-Policy:", "Content-Security-Policy-Report-Only:"));
      },
    },
    {
      name: "the deployment headers not emitted at all",
      apply: async (dir) => { await rm(join(dir, "_headers")); },
    },
  ];

  let bad = 0;
  const base = await mkdtemp(join(tmpdir(), "mdx-bundle-selftest-"));

  // Control: the real build must pass, or every "caught" below is meaningless.
  const clean = join(base, "clean");
  await cp(dist, clean, { recursive: true });
  const cleanFailures = await run(clean);
  if (cleanFailures.length) {
    console.error("  ✗ CONTROL the untouched build should pass, but:");
    for (const f of cleanFailures) console.error(`      ${f}`);
    bad++;
  } else {
    console.log("  ✓ CONTROL the untouched build passes");
  }

  for (const [i, seed] of seeds.entries()) {
    const dir = join(base, `seed-${i}`);
    await cp(dist, dir, { recursive: true });
    await seed.apply(dir);
    const found = await run(dir);
    if (found.length) {
      console.log(`  ✓ caught: ${seed.name}`);
    } else {
      console.error(`  ✗ MISSED: ${seed.name}`);
      bad++;
    }
  }

  await rm(base, { recursive: true, force: true });
  if (bad) {
    console.error(`\ncheck-prod-bundle --selftest: ${bad} case(s) the gate does not actually catch.`);
    process.exit(1);
  }
  console.log(`\ncheck-prod-bundle --selftest: OK — ${seeds.length} seeded regressions all caught.`);
}

// ── main ───────────────────────────────────────────────────────────────

if (process.argv.includes("--selftest")) {
  await selftest();
} else {
  const found = await run(join(ROOT, "dist"));
  if (found.length) {
    console.error("check-prod-bundle: the production build must not ship this.\n");
    for (const f of found) console.error(`  ✗ ${f}`);
    console.error("");
    process.exit(1);
  }
  console.log("check-prod-bundle: OK — no dev seams, no inline script or style, policy enforced.");
}
