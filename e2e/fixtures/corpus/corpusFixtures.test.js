// corpusFixtures.test.js — EVA-S02 AC-S02-F-1.
//
// The corpus fixtures are the mock data every later evidence suite renders. If
// they drift from the contracts, every one of those suites passes against a
// shape the backend never sends — the most expensive kind of green.
//
// So this test validates them against the GENERATED types
// (src/types/evidence.d.ts, EVA-S01), not against a hand-kept copy of the
// shapes. The d.ts is parsed into field/enum descriptors and the fixtures are
// checked field by field: unknown keys, missing required keys, wrong
// primitives, values outside a closed enum.
//
// Why parse the d.ts instead of type-checking the JSON with tsc: TypeScript
// widens JSON string values to `string`, so `source_authority: "national"` is
// not assignable to the SourceAuthority union and the compile check cannot be
// written at all. The parse is also strictly stronger in one way — tsc does no
// excess-property checking on an imported JSON module, and an unknown key is
// exactly how a fixture goes stale after a contract drops a field.
//
// The second half is the edge-state inventory. A regeneration that quietly
// loses the retracted document or the superseded pair would leave S04/S08 with
// no way to reach the states they must render, and nothing else would notice.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const DTS = path.join(repoRoot, "src/types/evidence.d.ts");

const readJson = (name) => JSON.parse(readFileSync(path.join(here, name), "utf8"));
const { documents, versions } = readJson("documents.json");
const passages = readJson("passages.json");
const webPages = readJson("web-pages.json");

// ── the contract, parsed out of the generated types ───────────────────
const dts = readFileSync(DTS, "utf8");

const aliases = new Map();
for (const m of dts.matchAll(/^export type (\w+) =([^;]+);/gm)) {
  aliases.set(m[1], m[2].trim().replace(/\s+/g, " "));
}
const interfaces = new Map();
for (const m of dts.matchAll(/^export interface (\w+) \{([^}]*)\}/gm)) {
  const fields = [];
  for (const line of m[2].split("\n")) {
    const f = line.match(/^\s*(\w+)(\?)?:\s*(.+);\s*$/);
    if (f) fields.push({ name: f[1], optional: !!f[2], type: f[3].trim() });
  }
  interfaces.set(m[1], fields);
}
assert.ok(interfaces.has("Document"), "evidence.d.ts has no Document interface — run `npm run contracts:types`");

const PRIMITIVES = new Set(["string", "number", "boolean", "null", "unknown", "any"]);

/** Resolve a type expression to { primitives, literals, arrayOf, object }. */
function resolve(expr, depth = 0) {
  if (depth > 12) throw new Error(`type alias cycle at ${expr}`);
  const out = { primitives: new Set(), literals: new Set(), arrayOf: null, object: null };
  for (let part of expr.split("|").map((s) => s.trim())) {
    part = part.replace(/^\((.*)\)$/, "$1").trim();
    if (part.endsWith("[]")) {
      out.arrayOf = resolve(part.slice(0, -2), depth + 1);
    } else if (/^"[^"]*"$/.test(part)) {
      out.literals.add(part.slice(1, -1));
    } else if (PRIMITIVES.has(part)) {
      out.primitives.add(part);
    } else if (aliases.has(part)) {
      const inner = resolve(aliases.get(part), depth + 1);
      inner.primitives.forEach((p) => out.primitives.add(p));
      inner.literals.forEach((l) => out.literals.add(l));
      out.arrayOf = out.arrayOf ?? inner.arrayOf;
      out.object = out.object ?? inner.object;
    } else if (interfaces.has(part)) {
      out.object = part;
    } else {
      throw new Error(`unresolvable type "${part}" (from "${expr}")`);
    }
  }
  return out;
}

function checkValue(value, type, where, errors) {
  let d;
  try {
    d = resolve(type);
  } catch (err) {
    errors.push(`${where}: ${err.message}`);
    return;
  }
  if (value === null) {
    if (!d.primitives.has("null")) errors.push(`${where}: null, but the contract says ${type}`);
    return;
  }
  if (Array.isArray(value)) {
    if (!d.arrayOf) return errors.push(`${where}: array, but the contract says ${type}`);
    value.forEach((v, i) => checkValue(v, arrayElementType(type), `${where}[${i}]`, errors));
    return;
  }
  if (typeof value === "object") {
    if (!d.object) return errors.push(`${where}: object, but the contract says ${type}`);
    checkObject(value, d.object, where, errors);
    return;
  }
  if (d.literals.size) {
    if (!d.literals.has(value)) {
      errors.push(`${where}: "${value}" is not one of ${[...d.literals].join(" | ")}`);
    }
    return;
  }
  if (!d.primitives.has(typeof value)) {
    errors.push(`${where}: ${typeof value} (${JSON.stringify(value)}), contract says ${type}`);
  }
}

// `Specialty` resolves to string[]; the element type for the recursive call is
// the alias RHS with the [] stripped.
function arrayElementType(type) {
  const direct = type.trim();
  if (direct.endsWith("[]")) return direct.slice(0, -2);
  const alias = aliases.get(direct);
  if (alias) return arrayElementType(alias);
  return "unknown";
}

function checkObject(obj, interfaceName, where, errors) {
  const fields = interfaces.get(interfaceName);
  if (!fields) return errors.push(`${where}: no interface ${interfaceName} in the contract`);
  const known = new Set(fields.map((f) => f.name));
  for (const key of Object.keys(obj)) {
    if (!known.has(key)) {
      errors.push(`${where}.${key}: not a field of ${interfaceName} — the contract may have dropped it`);
    }
  }
  for (const f of fields) {
    if (!(f.name in obj)) {
      if (!f.optional) errors.push(`${where}.${f.name}: required by ${interfaceName}, missing`);
      continue;
    }
    checkValue(obj[f.name], f.type, `${where}.${f.name}`, errors);
  }
}

function validateAll(rows, interfaceName, label) {
  const errors = [];
  rows.forEach((row, i) => checkObject(row, interfaceName, `${label}[${i}]`, errors));
  assert.deepEqual(errors, [], `\n  ${errors.join("\n  ")}\n`);
}

// ── the validator itself ──────────────────────────────────────────────
// A checker that cannot fail proves nothing about the fixtures it passes, so
// every rejection path is exercised on a deliberately broken copy of a real row.
test("the contract validator rejects what it is supposed to reject", () => {
  const good = documents[0];
  const cases = [
    [{ ...good, license_class: "open" }, /not one of/, "value outside a closed enum"],
    [{ ...good, retracted: "false" }, /contract says/, "wrong primitive"],
    [{ ...good, source_kind: "web" }, /not a field of Document/, "unknown key"],
    [{ ...good, title: undefined, ...{} }, /required by Document, missing/, "missing required key"],
    [{ ...good, specialty: [7] }, /contract says/, "wrong array element"],
    [{ ...good, published_at: 2024 }, /contract says/, "date as a number"],
  ];
  for (const [row, pattern, what] of cases) {
    if (row.title === undefined) delete row.title;
    const errors = [];
    checkObject(row, "Document", "case", errors);
    assert.equal(errors.length >= 1, true, `validator missed: ${what}`);
    assert.match(errors.join(" "), pattern, what);
  }
  // …and passes the row it was cloned from.
  const clean = [];
  checkObject(good, "Document", "case", clean);
  assert.deepEqual(clean, []);
});

// ── contract validation ───────────────────────────────────────────────
test("documents.json validates against the Document contract", () => {
  validateAll(documents, "Document", "documents");
});

test("documents.json versions validate against the DocumentVersion contract", () => {
  validateAll(versions, "DocumentVersion", "versions");
  // The version number is an integer on the wire. It reads as a string in the
  // generated types unless the typegen keeps clashing declarations apart —
  // this fixture is what makes that regression visible.
  for (const v of versions) assert.equal(Number.isInteger(v.version), true, `${v.id} version`);
});

test("passages.json validates against the EvidencePassage contract", () => {
  validateAll(passages, "EvidencePassage", "passages");
});

test("web-pages.json refs validate against the WebSourceRef contract", () => {
  validateAll(webPages.map((p) => p.ref), "WebSourceRef", "web-pages[].ref");
  // The wrapper around the ref is a fixture convenience, not a contract: it
  // carries what a mocked S04 source card renders beside the link.
  for (const [i, page] of webPages.entries()) {
    for (const key of ["id", "title", "lang", "excerpt", "publisher", "published_at", "ref"]) {
      assert.ok(key in page, `web-pages[${i}] missing ${key}`);
    }
  }
});

// ── referential integrity ─────────────────────────────────────────────
test("every passage points at a document and a version that exist", () => {
  const docIds = new Set(documents.map((d) => d.id));
  const versionById = new Map(versions.map((v) => [v.id, v]));
  for (const p of passages) {
    if (p.document_id === null) {
      // Web and registry hits carry no corpus document — they must carry a ref.
      assert.ok(p.web_ref, `${p.id}: no document_id and no web_ref`);
      assert.equal(p.document_version_id, null, `${p.id}: version without a document`);
      continue;
    }
    assert.ok(docIds.has(p.document_id), `${p.id}: unknown document ${p.document_id}`);
    const version = versionById.get(p.document_version_id);
    assert.ok(version, `${p.id}: unknown version ${p.document_version_id}`);
    assert.equal(version.document_id, p.document_id, `${p.id}: version belongs to another document`);
  }
});

test("document-level metadata is copied onto its passages, as the projection does", () => {
  // `_row_to_passage` (evidence-retrieval/adapters/pg.py) joins chunks to
  // documents and copies tier/authority/licence/retracted/published_at. A
  // fixture where those disagree would let a screen render a passage as
  // public-domain while its document says restricted.
  const byId = new Map(documents.map((d) => [d.id, d]));
  for (const p of passages) {
    const doc = byId.get(p.document_id);
    if (!doc) continue;
    for (const field of ["evidence_tier", "source_authority", "license_class", "published_at", "retracted"]) {
      assert.equal(p[field], doc[field], `${p.id}.${field} disagrees with its document`);
    }
  }
});

// ── the edge-state inventory ──────────────────────────────────────────
// Each entry is a state a later sprint has to render. Losing one in a
// regeneration would leave that screen with no way to reach it.
const enumValues = (name) => [...resolve(name).literals];
const isTable = (text) => /\|\s*---\s*\|/.test(text);
const cyrillic = (text) => (text.match(/[Ѐ-ӿ]/g) || []).length;
const latin = (text) => (text.match(/[A-Za-z]/g) || []).length;

test("every licence class the contract knows appears at least once", () => {
  const present = new Set(documents.map((d) => d.license_class));
  for (const cls of enumValues("LicenseClass")) {
    assert.ok(present.has(cls), `no document with license_class "${cls}"`);
  }
});

test("every evidence tier and source authority appears at least once", () => {
  const tiers = new Set(documents.map((d) => d.evidence_tier));
  for (const tier of enumValues("EvidenceTier")) {
    assert.ok(tiers.has(tier), `no document with evidence_tier "${tier}"`);
  }
  const authorities = new Set(documents.map((d) => d.source_authority));
  for (const a of enumValues("SourceAuthority")) {
    assert.ok(authorities.has(a), `no document with source_authority "${a}"`);
  }
});

test("every connector kind and web trust tier appears at least once", () => {
  const kinds = new Set(passages.map((p) => p.source_kind));
  for (const kind of enumValues("ConnectorKind")) {
    assert.ok(kinds.has(kind), `no passage with source_kind "${kind}"`);
  }
  const tiers = new Set(webPages.map((p) => p.ref.trust_tier));
  for (const tier of enumValues("WebTrustTier")) {
    assert.ok(tiers.has(tier), `no cached web page with trust_tier "${tier}"`);
  }
});

test("a retracted document is present, with passages", () => {
  const retracted = documents.filter((d) => d.retracted);
  assert.ok(retracted.length >= 1, "no retracted document");
  for (const doc of retracted) {
    const own = passages.filter((p) => p.document_id === doc.id);
    assert.ok(own.length >= 1, `retracted ${doc.canonical_id} has no passages`);
    // Retrieval filters `NOT d.retracted`, so these never arrive from a search.
    // They exist because a citation resolved months later still has to render
    // as withdrawn — that is the S08 retraction alert.
    assert.ok(own.every((p) => p.retracted === true), "retracted flag not copied to passages");
  }
});

test("a superseded pair is present: one document, two versions, passages from both", () => {
  const byDoc = new Map();
  for (const v of versions) {
    if (!byDoc.has(v.document_id)) byDoc.set(v.document_id, []);
    byDoc.get(v.document_id).push(v);
  }
  const multi = [...byDoc.entries()].filter(([, vs]) => vs.length >= 2);
  assert.ok(multi.length >= 1, "no document carries more than one version");
  for (const [docId, vs] of multi) {
    const latest = Math.max(...vs.map((v) => v.version));
    const superseded = vs.filter((v) => v.version < latest).map((v) => v.id);
    const own = passages.filter((p) => p.document_id === docId);
    assert.ok(
      own.some((p) => superseded.includes(p.document_version_id)),
      "no passage from the superseded version",
    );
    assert.ok(
      own.some((p) => vs.find((v) => v.id === p.document_version_id)?.version === latest),
      "no passage from the current version",
    );
  }
});

test("an expired document is present — valid_until in the past", () => {
  const expired = documents.filter((d) => d.valid_until && d.valid_until < "2026-01-01");
  assert.ok(expired.length >= 1, "no document with a lapsed valid_until");
});

test("table-bearing passages survive", () => {
  const tables = passages.filter((p) => isTable(p.text));
  assert.ok(tables.length >= 4, `only ${tables.length} table passages`);
  // In both scripts: a table renderer that only ever saw ASCII headers is one
  // that breaks on the first Ukrainian protocol.
  assert.ok(tables.some((p) => cyrillic(p.text) > 0), "no Ukrainian table passage");
  assert.ok(tables.some((p) => latin(p.text) > 0), "no Latin-script table passage");
});

test("both scripts are well represented (≥30% each)", () => {
  const ukr = passages.filter((p) => cyrillic(p.text) > latin(p.text)).length;
  const lat = passages.length - ukr;
  const share = (n) => Math.round((n / passages.length) * 100);
  assert.ok(share(ukr) >= 30, `Ukrainian passages only ${share(ukr)}%`);
  assert.ok(share(lat) >= 30, `Latin-script passages only ${share(lat)}%`);
});

test("the fixture set is the size the sprint specified", () => {
  assert.equal(documents.length, 12, "12 documents");
  assert.ok(passages.length >= 40, `${passages.length} passages — at least 40 expected`);
  assert.ok(webPages.length >= 5, `${webPages.length} cached web pages`);
});

test("passage ids are unique and equal their chunk id when they have one", () => {
  const ids = passages.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate passage id");
  for (const p of passages) {
    if (p.chunk_id !== null) assert.equal(p.id, p.chunk_id, `${p.id}: id must equal chunk_id`);
  }
});

test("char offsets are ordered where the contract carries them", () => {
  for (const p of passages) {
    if (p.char_start === null || p.char_end === null) continue;
    assert.ok(p.char_end > p.char_start, `${p.id}: char_end must exceed char_start`);
  }
});

// ── the canonical vocabulary ──────────────────────────────────────────
test("the seven backend eval documents are present, by canonical id", () => {
  // eval/seed/judgments.jsonl in evidence-backend grades retrieval against
  // these ids. Sharing them means an FE mock and a backend eval run talk about
  // the same corpus instead of two invented ones.
  const expected = [
    "doi:10.1234/who.2024.001",
    "doi:10.7777/nice.ng28",
    "doi:10.3333/moz.2022.15",
    "moz:1234",
    "doi:10.5555/pmc.2023.42",
    "pmid:36000002",
    "sha256:f31733ed1dd9e8ccd4b66a5b7b5ea1368207b4d371130d76f594a3b2841f86df",
  ];
  const present = new Set(documents.map((d) => d.canonical_id));
  for (const id of expected) assert.ok(present.has(id), `missing eval document ${id}`);
});
