// chat/noHostImports.test.js — the embed contract as a tripwire.
//
// The Definition of Done says: no feature screen imports auth/shell/account
// code, identity never comes from storage, nothing is fixed to the viewport,
// navigation never reloads the host, and no real PHI is in the repo. All of
// those are easy to say in review and easy to lose in the third sprint after
// this one, so they are tests instead of conventions.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const CHAT = dirname(fileURLToPath(import.meta.url));

// The one sanctioned adapter. It exists precisely so nothing else has to know
// which host this is.
const ADAPTER_DIR = "host";

const ALLOWED_PACKAGES = new Set(["react", "react-dom"]);

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js|jsx)$/.test(name)) out.push(p);
  }
  return out;
};

const moduleFiles = () => walk(CHAT).filter((p) => !p.endsWith(".test.js"));

// Comments are prose: a rule that fires on the sentence describing the rule is
// a rule nobody can write about.
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const importsOf = (src) => {
  const out = [];
  const re = /(?:from\s*|import\s*)["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(src))) out.push(m[1]);
  return out;
};

const isAdapter = (p) => relative(CHAT, p).split(sep)[0] === ADAPTER_DIR;

test("nothing in the module imports outside the module (the adapter aside)", () => {
  const offenders = [];
  for (const p of moduleFiles()) {
    if (isAdapter(p)) continue;
    const src = stripComments(readFileSync(p, "utf8"));
    for (const spec of importsOf(src)) {
      if (spec.startsWith(".")) {
        const target = resolve(dirname(p), spec);
        if (!target.startsWith(CHAT + sep)) offenders.push(`${relative(CHAT, p)} → ${spec}`);
      } else if (!ALLOWED_PACKAGES.has(spec)) {
        offenders.push(`${relative(CHAT, p)} → package "${spec}"`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test("the adapter is the only file that knows about host auth", () => {
  const offenders = [];
  for (const p of moduleFiles()) {
    if (isAdapter(p)) continue;
    const src = stripComments(readFileSync(p, "utf8"));
    // `claims` as a property access or assignment — the auth-token shape.
    // The bare English word is fine: an evidence tool talks about claims.
    if (/\bAuthContext\b|\buseAuth\b|\bclaims\s*[.?[=]/.test(src)) offenders.push(relative(CHAT, p));
  }
  assert.deepEqual(offenders, []);
});

test("identity is never read from storage or cookies", () => {
  const offenders = [];
  for (const p of moduleFiles()) {
    const src = stripComments(readFileSync(p, "utf8"));
    if (/document\.cookie/.test(src)) offenders.push(`${relative(CHAT, p)} → document.cookie`);
    // localStorage is allowed for feature settings and nowhere else — in
    // particular, never for the attached patient.
    if (/localStorage/.test(src) && !p.endsWith("useSettings.js")) {
      offenders.push(`${relative(CHAT, p)} → localStorage outside useSettings.js`);
    }
  }
  assert.deepEqual(offenders, []);
});

test("patient context reaches the module only through prop, callback or dialog", () => {
  const embed = stripComments(readFileSync(join(CHAT, "ChatEmbed.jsx"), "utf8"));
  // The three sanctioned doors, all visible in the entry component.
  assert.match(embed, /patient: injectedPatient/);
  assert.match(embed, /onRequestPatient/);
  assert.match(embed, /attachPatient/);
  // A host-injected patient is fixed for the session.
  assert.match(embed, /if \(patientLocked\)\s*return;/);

  // Settings persistence must never carry a patient into storage.
  const settings = stripComments(readFileSync(join(CHAT, "data", "useSettings.js"), "utf8"));
  assert.equal(/patient/i.test(settings), false, "useSettings must not know about patients");
});

test("nothing is fixed to the viewport unless the host asked for it", () => {
  const css = stripComments(readFileSync(join(CHAT, "chat.css"), "utf8"));

  // `position: fixed` is legal in exactly one place: the scrim, and only once
  // the host has opted in with modalHost="page" (`.ec-root-portal`). Anywhere
  // else, an embedded module would be covering chrome that isn't its own.
  const fixedRules = css
    .split("}")
    .filter((block) => /position:\s*fixed/.test(block))
    .map((block) => block.split("{")[0].trim());
  assert.deepEqual(fixedRules, [".ec-root-portal .ec-scrim"]);

  // …and the default must still be panel-scoped.
  assert.match(css, /\.ec-scrim\s*\{[^}]*position:\s*absolute/);
  assert.equal(/\b\d+vh\b|\b\d+vw\b/.test(css), false, "chat.css sizes to the viewport");

  const offenders = [];
  for (const p of moduleFiles()) {
    const src = stripComments(readFileSync(p, "utf8"));
    if (/position:\s*["']?fixed/.test(src)) offenders.push(relative(CHAT, p));
    // Viewport units are the adapter's business: it knows how tall this host's
    // content area is and passes it in as `--ec-fill`. The module itself only
    // ever reads that token, so it cannot guess at a page it does not own.
    if (isAdapter(p)) continue;
    if (/\b\d+vh\b|\b\d+vw\b/.test(src)) offenders.push(`${relative(CHAT, p)} → viewport units`);
  }
  assert.deepEqual(offenders, []);

  // …and the module must express its height as that token, not as a unit.
  assert.match(css, /height:\s*var\(--ec-fill/);
});

test("every rule in the stylesheet is scoped to the module root", () => {
  const css = stripComments(readFileSync(join(CHAT, "chat.css"), "utf8"));
  const offenders = [];
  for (const block of css.split("}")) {
    const selector = block.split("{")[0].trim();
    if (!selector || selector.startsWith("@") || !block.includes("{")) continue;
    for (const one of selector.split(",")) {
      const s = one.trim();
      if (!s) continue;
      if (/^\d+%$/.test(s) || s === "from" || s === "to") continue;   // keyframe steps
      if (!s.startsWith(".ec-")) offenders.push(s);
    }
  }
  assert.deepEqual(offenders, []);
});

test("every class the components render is styled", () => {
  // Three times now, a block-level CSS edit has silently taken rules that other
  // components still used (the drop-up menu, the agent cards). The markup is
  // the source of truth: if a component renders `ec-foo`, the stylesheet must
  // define it.
  const css = stripComments(readFileSync(join(CHAT, "chat.css"), "utf8"));
  const used = new Set();
  for (const p of moduleFiles()) {
    if (p.endsWith(".css")) continue;
    const src = stripComments(readFileSync(p, "utf8"))
      // `id="ec-…"` and `aria-labelledby="ec-…"` are identifiers, not classes.
      .replace(/(?:id|aria-labelledby)=["'{][^"'}]*["'}]/g, "");
    for (const m of src.matchAll(/\bec-[a-z0-9-]+/g)) {
      const cls = m[0];
      // `ec-theme` is the data attribute; a trailing dash is a template
      // literal's static prefix (`ec-dropup-${align}`), not a class.
      if (cls === "ec-theme" || cls.endsWith("-")) continue;
      used.add(cls);
    }
  }
  const missing = [...used]
    // Data-attribute variants and JS-only tokens are not selectors.
    .filter((cls) => !new RegExp(`\\.${cls}[\\s,{:.\\[]`).test(css))
    .sort();
  assert.deepEqual(missing, []);
});

test("internal navigation never uses an <a href> that would reload the host", () => {
  const offenders = [];
  for (const p of moduleFiles()) {
    const src = stripComments(readFileSync(p, "utf8"));
    if (/<a\s[^>]*href=/.test(src)) offenders.push(relative(CHAT, p));
    if (/\blocation\.(hash|href|assign|replace)\b/.test(src)) offenders.push(`${relative(CHAT, p)} → location`);
  }
  assert.deepEqual(offenders, []);
});

test("screens reach data only through the hooks seam", () => {
  const offenders = [];
  for (const p of walk(join(CHAT, "features"))) {
    if (p.endsWith(".test.js")) continue;
    const src = stripComments(readFileSync(p, "utf8"));
    if (/from\s+["'][^"']*mockClient\.js["']/.test(src)) offenders.push(`${relative(CHAT, p)} → mockClient`);
    if (/from\s+["'][^"']*fixtures\.js["']/.test(src)) offenders.push(`${relative(CHAT, p)} → fixtures`);
  }
  assert.deepEqual(offenders, []);
});

test("no patient is hardcoded outside the fixtures", () => {
  const fixtures = readFileSync(join(CHAT, "data", "fixtures.js"), "utf8");
  // The fixtures file is the ONLY place patient records may be written by hand,
  // and it says out loud that they are fictional.
  assert.match(fixtures, /FICTIONAL/i);

  const offenders = [];
  for (const p of moduleFiles()) {
    if (p.endsWith(join("data", "fixtures.js"))) continue;
    const src = stripComments(readFileSync(p, "utf8"));
    // A literal date of birth anywhere is a hardcoded person — including in the
    // adapter. (An ICD-shaped regex is not usable here: SVG path data like
    // "M12.5" matches it, which is how this check first failed.)
    if (/\b(19|20)\d{2}-\d{2}-\d{2}\b/.test(src)) offenders.push(`${relative(CHAT, p)} → date of birth`);
    // The adapter MAPS the host's real roster into the module's patient shape,
    // so it legitimately writes these keys. Nothing else may.
    if (isAdapter(p)) continue;
    if (/\b(medications|allergies|diagnoses)\s*:\s*\[/.test(src)) {
      offenders.push(`${relative(CHAT, p)} → inline patient record`);
    }
  }
  assert.deepEqual(offenders, []);
});

test("real patients reach the module only through the host callback", () => {
  // The module never calls a patient API. It asks for a search function, and
  // the adapter is the only thing that knows one exists.
  const offenders = [];
  for (const p of moduleFiles()) {
    if (isAdapter(p)) continue;
    const src = stripComments(readFileSync(p, "utf8"));
    if (/\blistPatients\b|\bgetPatientTimeline\b|api\/patients/.test(src)) {
      offenders.push(relative(CHAT, p));
    }
  }
  assert.deepEqual(offenders, []);

  // …and the hook takes that function as an argument rather than reaching for
  // a client itself.
  const hooks = stripComments(readFileSync(join(CHAT, "data", "hooks.js"), "utf8"));
  assert.match(hooks, /usePatients\(search = "", source = null\)/);
  assert.match(hooks, /source \? source\(search\)/);
});
