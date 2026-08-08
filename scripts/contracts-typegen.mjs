#!/usr/bin/env node
// EVA-S01 — generate src/types/evidence.d.ts from the evidence-backend contract
// schemas. From S03 onward no evidence type is ever hand-written: every shape a
// screen touches comes out of this pipeline, and the ESLint rule
// `evidence/no-handwritten-contract-types` fails the build on any local
// redeclaration of a contract name.
//
//   npm run contracts:types              regenerate (writes src/types/evidence.d.ts)
//   npm run contracts:types -- --check   CI: regenerate to a temp buffer and fail
//                                        if the committed file differs
//
// ── Where the schemas come from ───────────────────────────────────────
// In order, first hit wins:
//   1. EVIDENCE_CONTRACTS_TARBALL   a local evidence-contracts-{sha}.tar.gz
//   2. .contracts-cache/<artifact>  a previously downloaded copy of the pin
//   3. EVIDENCE_CONTRACTS_ARTIFACT_URL / contracts.pin.json artifactBaseUrl
//                                   downloaded, then cached
//   4. EVIDENCE_CONTRACTS_DIR, else the sibling backend checkout
//
// (4) is the developer path and is deliberately *unpinned* — it reads whatever
// is in the working tree next door. `--require-artifact` (what CI passes)
// refuses it, so a release can never be cut against someone's local edits.
//
// This script NEVER stale-compiles. A missing artifact, an empty schema dir, a
// schema that fails to compile: all hard failures with the reason printed. A
// generated types file that is silently a sprint behind is the single failure
// this whole pipeline exists to prevent.

import { compile } from "json-schema-to-typescript";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const outFile = path.join(repoRoot, "src/types/evidence.d.ts");
const usageFile = path.join(repoRoot, "src/types/evidence.usage.ts");
const cacheDir = path.join(repoRoot, ".contracts-cache");
const permissionsCsv = path.join(repoRoot, "docs/auth/permissions.csv");

const argv = process.argv.slice(2);
const checkOnly = argv.includes("--check");
const requireArtifact = argv.includes("--require-artifact");

const die = (msg) => {
  console.error(`\ncontracts:types FAILED\n  ${msg.replace(/\n/g, "\n  ")}\n`);
  process.exit(1);
};

// ── 0. the pin ────────────────────────────────────────────────────────
let pin;
try {
  pin = JSON.parse(await readFile(path.join(repoRoot, "contracts.pin.json"), "utf8"));
} catch (err) {
  die(`contracts.pin.json unreadable — the pipeline has no idea which backend build to generate from.\n${err.message}`);
}
const artifactName = String(pin.artifact ?? "evidence-contracts-{sha}.tar.gz").replace("{sha}", pin.sha);

// ── 1. resolve a directory of *.schema.json ───────────────────────────
const temps = [];
async function extractTarball(tarball) {
  if (!existsSync(tarball)) return null;
  const dir = await mkdtemp(path.join(tmpdir(), "evidence-contracts-"));
  temps.push(dir);
  try {
    await run("tar", ["-xzf", tarball, "-C", dir]);
  } catch (err) {
    die(`could not extract ${tarball}\n${err.message}`);
  }
  // The artifact may carry a top-level directory; find the level holding schemas.
  const stack = [dir];
  while (stack.length) {
    const at = stack.shift();
    const entries = await readdir(at, { withFileTypes: true });
    if (entries.some((e) => e.isFile() && e.name.endsWith(".schema.json"))) return at;
    stack.push(...entries.filter((e) => e.isDirectory()).map((e) => path.join(at, e.name)));
  }
  die(`${tarball} contains no *.schema.json`);
}

async function download(url, to) {
  console.log(`fetching ${url}`);
  const res = await fetch(url).catch((err) => die(`download failed: ${url}\n${err.message}`));
  if (!res.ok) die(`download failed: ${url} → HTTP ${res.status}`);
  await mkdir(path.dirname(to), { recursive: true });
  await writeFile(to, Buffer.from(await res.arrayBuffer()));
  return to;
}

async function resolveContractsDir() {
  if (process.env.EVIDENCE_CONTRACTS_TARBALL) {
    const dir = await extractTarball(path.resolve(process.env.EVIDENCE_CONTRACTS_TARBALL));
    if (!dir) die(`EVIDENCE_CONTRACTS_TARBALL does not exist: ${process.env.EVIDENCE_CONTRACTS_TARBALL}`);
    return { dir, source: `tarball ${process.env.EVIDENCE_CONTRACTS_TARBALL}`, pinned: true };
  }

  const cached = path.join(cacheDir, artifactName);
  const fromCache = await extractTarball(cached);
  if (fromCache) return { dir: fromCache, source: `cached artifact ${artifactName}`, pinned: true };

  const base = process.env.EVIDENCE_CONTRACTS_ARTIFACT_URL ?? pin.artifactBaseUrl;
  if (base) {
    const url = `${String(base).replace(/\/$/, "")}/${artifactName}`;
    const dir = await extractTarball(await download(url, cached));
    if (dir) return { dir, source: url, pinned: true };
  }

  const local =
    process.env.EVIDENCE_CONTRACTS_DIR ??
    path.resolve(repoRoot, "../dictate/evidence-backend/docs/api/evidence-contracts");
  if (requireArtifact) {
    die(
      `no pinned artifact for ${pin.repo}@${pin.sha}.\n` +
        `Looked for: ${cached}\n` +
        `and EVIDENCE_CONTRACTS_ARTIFACT_URL / contracts.pin.json artifactBaseUrl (unset).\n` +
        `--require-artifact refuses to fall back to the local checkout (${local}).`,
    );
  }
  if (!existsSync(local)) {
    die(
      `no contracts anywhere.\n` +
        `  artifact:  ${cached} (absent, no download URL configured)\n` +
        `  checkout:  ${local} (absent)\n` +
        `Set EVIDENCE_CONTRACTS_DIR, EVIDENCE_CONTRACTS_TARBALL, or contracts.pin.json artifactBaseUrl.`,
    );
  }
  return { dir: local, source: `local checkout ${local}`, pinned: false };
}

const { dir: contractsDir, source, pinned } = await resolveContractsDir();

let files;
try {
  files = (await readdir(contractsDir)).filter((f) => f.endsWith(".schema.json")).sort();
} catch (err) {
  die(`contracts dir unreadable: ${contractsDir}\n${err.message}`);
}
if (files.length === 0) die(`no *.schema.json in ${contractsDir} — refusing to emit an empty d.ts`);
if (pin.schemaCount && files.length !== pin.schemaCount) {
  console.warn(
    `warning: ${files.length} schemas found, contracts.pin.json expects ${pin.schemaCount}. ` +
      `Update the pin if the backend added or removed a contract.`,
  );
}

// ── 2. the permission vocabulary ──────────────────────────────────────
// `EvidenceAction` is not a JSON-Schema contract — it is the evidence slice of
// docs/auth/permissions.csv, hoisted into the same generated file so that a
// permission string and a payload shape are imported from one place and both
// fail the build the same way when they go stale. The drift test asserts this
// union equals the MATRIX keys.
async function evidencePermissionTypes() {
  let csv;
  try {
    csv = await readFile(permissionsCsv, "utf8");
  } catch (err) {
    die(`docs/auth/permissions.csv unreadable — cannot emit EvidenceAction.\n${err.message}`);
  }
  const actions = new Set();
  const targets = new Set();
  for (const line of csv.trim().split(/\r?\n/).slice(1)) {
    const [, action, target_kind] = line.split(",", 4);
    if (!action?.startsWith("evidence.")) continue;
    actions.add(action);
    targets.add(target_kind);
  }
  if (actions.size === 0) die(`docs/auth/permissions.csv carries no evidence.* rows`);
  const union = (xs) => [...xs].sort().map((x) => `"${x}"`).join(" | ");
  seen.set("EvidenceAction", "");
  seen.set("EvidenceTargetKind", "");
  return [
    "/* ── permissions (docs/auth/permissions.csv, evidence.* rows) ── */",
    "",
    "/**",
    " * Every evidence permission the backend knows. Gate on these, never on a",
    " * string literal: `usePermission(action, target_kind)` is string-keyed at",
    " * runtime, so this union is the only thing that catches a typo before it",
    " * ships as a silently-denied button.",
    " */",
    `export type EvidenceAction = ${union(actions)};`,
    "",
    "/** The target_kind half of the pair. Both are required by usePermission. */",
    `export type EvidenceTargetKind = ${union(targets)};`,
  ].join("\n");
}

// ── 3. compile ────────────────────────────────────────────────────────
const banner = [
  "/* GENERATED — do not edit.",
  " *",
  " * Produced by scripts/contracts-typegen.mjs from the evidence-backend",
  ` * contract schemas (${pin.repo}@${pin.sha.slice(0, 12)}, contracts ${pin.contractsVersion}).`,
  " * Hand edits are overwritten by the next run and rejected by CI",
  " * (`npm run contracts:types -- --check`).",
  " *",
  " * Regenerate: npm run contracts:types */",
  "",
].join("\n");

// name → normalized declaration text, so a repeat can be told from a clash.
const seen = new Map();
const renamed = [];
const declaredName = (block) => block.match(/^export (?:interface|type) (\w+)/)?.[1];
// Compare declarations by their code, ignoring doc comments and whitespace.
const normalize = (block) =>
  block.replace(/\/\*\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").trim();

const parts = [banner];
for (const file of files) {
  let schema;
  try {
    schema = JSON.parse(await readFile(path.join(contractsDir, file), "utf8"));
  } catch (err) {
    die(`${file} is not valid JSON\n${err.message}`);
  }
  let ts;
  try {
    ts = await compile(schema, schema.title ?? file, { bannerComment: "", additionalProperties: false });
  } catch (err) {
    die(`${file} failed to compile\n${err.message}`);
  }
  // Contracts share $defs — `Segment` appears in AnswerEnvelope and standalone,
  // `Id` in nearly every file — so the same declaration arrives many times and
  // only the first copy is emitted.
  //
  // But a *name* can also be reused for a genuinely different type: chunk.v1
  // declares `Version` as an integer and connector_descriptor.v1 as a string;
  // `CharStart` is a plain integer on a Chunk and nullable on an EvidencePassage.
  // Dropping those as duplicates silently mistypes the wire — a fixture with
  // `version: 1` would fail to validate against a `version: string` field, and
  // worse, code reading `chunk.char_start` would be told it might be null.
  // So a clash is renamed per contract (`DocumentVersionVersion`) rather than
  // dropped, and every rename is printed.
  let blocks = ts.split(/\n(?=export )/);
  const prefix = String(schema.title ?? "").replace(/[^A-Za-z0-9]/g, "");
  const renames = new Map();
  for (const block of blocks) {
    const name = declaredName(block);
    if (!name) continue;
    const previous = seen.get(name);
    if (previous === undefined || previous === normalize(block)) continue;
    let alt = `${prefix}${name}`;
    for (let n = 2; seen.has(alt) || renames.has(alt); n += 1) alt = `${prefix}${name}${n}`;
    renames.set(name, alt);
    renamed.push(`${name} → ${alt}  (${file})`);
  }
  if (renames.size) {
    let text = ts;
    for (const [from, to] of renames) text = text.replace(new RegExp(`\\b${from}\\b`, "g"), to);
    blocks = text.split(/\n(?=export )/);
  }

  const kept = [];
  for (const block of blocks) {
    const name = declaredName(block);
    if (name) {
      if (seen.has(name)) continue;
      seen.set(name, normalize(block));
    }
    kept.push(block);
  }
  if (kept.length) {
    parts.push(`/* ── ${file} ${"─".repeat(Math.max(2, 60 - file.length))} */\n\n${kept.join("\n")}`);
  }
}
parts.push(await evidencePermissionTypes());

const emitted = parts.join("\n") + "\n";

// ── 4. the compile fixture ────────────────────────────────────────────
// `tsc --noEmit` over a .d.ts alone proves the file parses. It does not prove
// the types can be *imported and used* — a name that collides, a $ref that
// compiled to something unresolvable, a duplicate dropped by the de-dup pass
// above all survive a parse and fail the first time a screen imports them.
// So the pipeline emits a fixture that touches every exported name, and CI
// compiles that. Generated, not hand-kept, because a hand-kept exhaustive list
// stops being exhaustive on the first contract the backend adds.
const exportedNames = [...seen.keys()].sort();
const usage = [
  "/* GENERATED — do not edit.",
  " *",
  " * Compile fixture for src/types/evidence.d.ts: it references every exported",
  " * contract type, so `npm run contracts:check` fails if any of them stops",
  " * resolving. Nothing imports this file at runtime.",
  " *",
  " * Regenerate: npm run contracts:types */",
  "",
  "import type {",
  ...exportedNames.map((n) => `  ${n},`),
  '} from "./evidence";',
  "",
  "type Resolves<T> = [T] extends [never] ? never : true;",
  "",
  "export type ContractTypesResolve = [",
  ...exportedNames.map((n) => `  Resolves<${n}>,`),
  "];",
  "",
  "// The type-usage convention, in three lines: permission strings and segment",
  "// kinds are gated on the generated unions, never on a bare string literal.",
  "// A typo in any of these is a compile error rather than a silently dead",
  "// button or an unstyled segment.",
  'export const SAMPLE_ACTION: EvidenceAction = "evidence.ask";',
  'export const SAMPLE_TARGET_KIND: EvidenceTargetKind = "evidence";',
  'export const SAMPLE_SEGMENT_KIND: SegmentKind = "evidence";',
  "",
].join("\n");

for (const dir of temps) await rm(dir, { recursive: true, force: true });

// ── 5. write, or check ────────────────────────────────────────────────
if (checkOnly) {
  const stale = [];
  for (const [file, want] of [[outFile, emitted], [usageFile, usage]]) {
    const committed = await readFile(file, "utf8").catch(() => null);
    if (committed !== want) stale.push(`${path.relative(repoRoot, file)} — ${committed === null ? "missing" : "stale or hand-edited"}`);
  }
  if (stale.length === 0) {
    console.log(`ok — generated types are current (${seen.size} types, source: ${source})`);
    process.exit(0);
  }
  die(`${stale.join("\n")}\nRun \`npm run contracts:types\` and commit the result.\n(generated from ${source})`);
}

await mkdir(path.dirname(outFile), { recursive: true });
await writeFile(outFile, emitted);
await writeFile(usageFile, usage);
if (renamed.length) {
  console.log(`renamed ${renamed.length} clashing declaration(s):\n  ${renamed.join("\n  ")}`);
}
console.log(
  `wrote ${path.relative(repoRoot, outFile)} — ${seen.size} types from ${files.length} contracts` +
    `\nwrote ${path.relative(repoRoot, usageFile)} — compile fixture over ${exportedNames.length} types` +
    `\n  source: ${source}${pinned ? "" : "  (UNPINNED local checkout — CI uses --require-artifact)"}`,
);
