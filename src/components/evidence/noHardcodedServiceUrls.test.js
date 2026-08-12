// noHardcodedServiceUrls.test.js — EVA-S03 AC-S03-F-3.
//
// Every evidence request must resolve its base URL through `SERVICES` in
// src/api/services.js. A hardcoded `http://localhost:8011` works perfectly on
// the machine it was written on and is unreachable everywhere else — and in
// production all of these collapse onto one same-origin gateway, so a literal
// host is not a shortcut, it is a build that cannot ship.
//
// A static check rather than a lint rule: it is one file's worth of intent,
// and it also guards the second half of the rule — that the ingest service
// never acquires a client at all.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    // `__`-prefixed files are transient fixtures — the lint-rule test plants
    // one here for the length of one eslint run, and `node --test` runs test
    // files concurrently.
    else if (/\.(js|jsx)$/.test(name) && !name.endsWith(".test.js") && !name.startsWith("__")) {
      out.push(full);
    }
  }
  return out;
}

const files = [
  ...walk(path.join(repoRoot, "src/components/evidence")),
  path.join(repoRoot, "src/api/evidenceRetrieval.js"),
  path.join(repoRoot, "src/api/evidenceAnswers.js"),
];
const read = (f) => ({ rel: path.relative(repoRoot, f), src: readFileSync(f, "utf8") });

test("no evidence module file hardcodes a host or a port", () => {
  const offenders = [];
  for (const { rel, src } of files.map(read)) {
    for (const [i, line] of src.split("\n").entries()) {
      // Comments and doc strings may name a port — that is documentation, and
      // handoff.md would be worse without it.
      const code = line.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");
      if (/https?:\/\/[^"'`\s]+/.test(code)) offenders.push(`${rel}:${i + 1} ${line.trim()}`);
      if (/:\s*(80|84)\d\d\b/.test(code) && !/data-testid/.test(code)) {
        offenders.push(`${rel}:${i + 1} ${line.trim()}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `\n  ${offenders.join("\n  ")}\n`);
});

test("evidence api modules reach the network only through apiAt(SERVICES.…)", () => {
  const { src } = read(path.join(repoRoot, "src/api/evidenceRetrieval.js"));
  assert.match(src, /apiAt\(SERVICES\.evidenceRetrieval,/);
  // No bare fetch: the shared client is what carries the bearer token, the
  // 401-refresh retry and the ApiError shape every screen renders.
  assert.doesNotMatch(src.replace(/\/\/.*$/gm, ""), /\bfetch\s*\(/);
});

// EVA-S04. The answer API adds a STREAM, and a stream is exactly where a
// bare `fetch` gets written by reflex — `EventSource` cannot carry a header,
// so the temptation is to reach for fetch directly and hand-roll the bearer.
// It must go through `streamAt`, which is the same auth path as everything
// else: in-memory token, single-flight refresh, ApiError shape.
test("the answer stream authenticates through the shared client, not a bare fetch", () => {
  const { src } = read(path.join(repoRoot, "src/api/evidenceAnswers.js"));
  const code = src.replace(/\/\/.*$/gm, "");
  assert.match(code, /apiAt\(SERVICES\.evidenceAnswer,/);
  assert.match(code, /streamAt\(SERVICES\.evidenceAnswer,/);
  assert.doesNotMatch(code, /\bfetch\s*\(/, "use streamAt(); it is where the bearer and the refresh live");
  // And the token must never reach a query string, where every proxy between
  // the clinic and the service logs it.
  assert.doesNotMatch(code, /access_token=|token=\$\{/);
  assert.doesNotMatch(code, /new EventSource/);
});

test("components never call the network directly — that is the api module's job", () => {
  for (const { rel, src } of walk(path.join(repoRoot, "src/components/evidence")).map(read)) {
    const code = src.replace(/\/\/.*$/gm, "");
    assert.doesNotMatch(code, /\bfetch\s*\(/, `${rel} calls fetch directly`);
    assert.doesNotMatch(code, /\bapiAt\s*\(/, `${rel} calls apiAt directly — put it in src/api/`);
  }
});

test("the ingest service has no client, and no entry in the service map", () => {
  const services = readFileSync(path.join(repoRoot, "src/api/services.js"), "utf8");
  // The comment block naming :8010 must survive; a SERVICES key must not appear.
  //
  // Read the keys out of `resolveServices` rather than off a fixed indent:
  // sprint 16 wrapped the map in that function (vite.config.js resolves the
  // same map in Node to derive the CSP `connect-src`), and an indent-sensitive
  // scan silently found zero keys — which passed the "no ingest" half of this
  // test while quietly stopping the other half from checking anything.
  const body = services.slice(
    services.indexOf("export function resolveServices"),
    services.indexOf("export const SERVICES"),
  );
  const keys = [...body.matchAll(/^\s+(\w+):\s/gm)].map((m) => m[1]);
  assert.ok(keys.length > 5, "no SERVICES keys found — the scan is looking in the wrong place");
  assert.equal(keys.includes("evidenceIngest"), false, "evidence-ingest is operator-only (EVA-S02)");
  assert.equal(keys.includes("ingest"), false);
  assert.ok(keys.includes("evidenceRetrieval"), "evidenceRetrieval must be in SERVICES");
  assert.ok(keys.includes("evidenceAnswer"));
  assert.ok(keys.includes("evidenceWebsearch"));

  const all = files.map(read).map((f) => f.src).join("\n");
  assert.doesNotMatch(all, /8010/, "nothing in the module may address the ingest port");
});

test("the dev flag override cannot be reached in a production build", () => {
  const services = readFileSync(path.join(repoRoot, "src/api/services.js"), "utf8");
  const fn = services.slice(services.indexOf("function devFlagOverride"));
  const body = fn.slice(0, fn.indexOf("\n}"));
  // The DEV guard must be the first statement: everything after it is dead
  // code in a build, which is the only reason a localStorage flag is tolerable.
  assert.match(body, /if \(!import\.meta\.env\?\.DEV\) return false;/);
  assert.ok(
    body.indexOf("import.meta.env") < body.indexOf("localStorage"),
    "the DEV check must precede the localStorage read",
  );
});
