#!/usr/bin/env node
// EVA-S02 — regenerate e2e/fixtures/corpus/* from a dev evidence corpus.
//
//   npm run fixtures:corpus              rewrite the fixture files
//   npm run fixtures:corpus -- --check   nightly smoke: export, validate, write nothing
//
// WHY THIS EXISTS. Hand-invented mocks drift from the contracts in ways nobody
// notices until a screen meets real data: an offset that is always zero, a
// section path that never nests, a licence class that only ever takes the easy
// value. Deriving the fixtures from documents that were actually ingested keeps
// every later Playwright suite honest about metadata, offsets and edge cases.
//
// WHY THE COMMITTED FILES ARE NOT ITS OUTPUT (yet). This script needs a dev
// backend with an ingested corpus. There is none in CI, and the S02 corpus
// lives only on a developer's machine after `make evidence-up` and an ingest
// run — so the committed fixtures were authored to mirror the backend's own
// parser fixtures (services/evidence-ingest/tests/fixtures/generate_fixtures.py)
// and the canonical ids its eval seed grades against. The moment a dev corpus
// exists, this script replaces them with the real rows and the shape test
// (e2e/fixtures/corpus/corpusFixtures.test.js) says whether anything was lost.
// See e2e/fixtures/corpus/README.md.
//
// SOURCE OF TRUTH. Postgres, not the retrieval API (ADR-0003: OpenSearch is a
// projection). Two deliberate differences from what /retrieve would return:
//   · retracted documents are INCLUDED — the fixtures must carry that state,
//     and retrieval filters it out (`NOT d.retracted`)
//   · superseded versions are INCLUDED — retrieval keeps only the latest
//     version unless asked for more
// Both are edge states later screens have to render, which is the whole point.
//
// Requires `psql` on PATH and EVIDENCE_DB_URL. Everything else is a hard exit:
// a fixture export that silently writes an empty corpus is worse than no export.

import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const outDir = path.join(repoRoot, "e2e/fixtures/corpus");

const argv = process.argv.slice(2);
const checkOnly = argv.includes("--check");
const dbUrl = process.env.EVIDENCE_DB_URL;
// The corpus partition to export. `global` is the reserved nil uuid the ingest
// CLI writes to by default; pass a tenant uuid to export a tenant corpus.
const tenant = process.env.EVIDENCE_CORPUS_TENANT ?? "00000000-0000-0000-0000-000000000000";

const die = (msg) => {
  console.error(`\nfixtures:corpus FAILED\n  ${msg.replace(/\n/g, "\n  ")}\n`);
  process.exit(1);
};

if (!dbUrl) {
  die(
    `EVIDENCE_DB_URL is unset — nothing to export from.\n` +
      `Bring a dev corpus up first (evidence-backend/docs/runbooks/evidence-ingest.md):\n` +
      `  cd ../dictate/medical-dictation-backend && make dev-up && make migrate-up\n` +
      `  cd ../evidence-backend && make evidence-up && make run-model-gateway\n` +
      `  uv run --project services/evidence-ingest evidence-ingest ingest dir \\\n` +
      `      services/evidence-ingest/tests/fixtures --set license_class=public_domain\n` +
      `then: EVIDENCE_DB_URL=postgres://…/mdx npm run fixtures:corpus`,
  );
}

async function query(sql) {
  // -A -t -X: unaligned, tuples only, no psqlrc. The SQL wraps its result in
  // json_agg, so one row comes back holding the whole array.
  let stdout;
  try {
    ({ stdout } = await run("psql", [dbUrl, "-A", "-t", "-X", "-v", "ON_ERROR_STOP=1", "-c", sql], {
      maxBuffer: 64 * 1024 * 1024,
    }));
  } catch (err) {
    if (err.code === "ENOENT") die("psql is not on PATH — install the postgres client");
    die(`query failed\n${(err.stderr || err.message).trim()}`);
  }
  const text = stdout.trim();
  return text && text !== "" ? JSON.parse(text) : [];
}

// Column lists mirror the contract projections exactly: documents ↔ Document,
// document_versions ↔ DocumentVersion, and the chunk→passage join is the same
// one evidence-retrieval/adapters/pg.py performs in `_row_to_passage`.
const DOCUMENTS_SQL = `
SELECT coalesce(json_agg(row_to_json(t) ORDER BY t.canonical_id), '[]'::json) FROM (
  SELECT d.id::text, d.canonical_id, d.title, d.source_authority, d.evidence_tier,
         d.jurisdiction, d.specialty, to_char(d.published_at, 'YYYY-MM-DD') AS published_at,
         to_char(d.valid_until, 'YYYY-MM-DD') AS valid_until, d.license_class, d.retracted
  FROM documents d WHERE d.tenant_id = '${tenant}'
) t`;

const VERSIONS_SQL = `
SELECT coalesce(json_agg(row_to_json(t) ORDER BY t.document_id, t.version), '[]'::json) FROM (
  SELECT v.id::text, v.document_id::text, v.version, v.content_ref, v.parsed_ref, v.checksum
  FROM document_versions v WHERE v.tenant_id = '${tenant}'
) t`;

// No NOT d.retracted, no latest-version-only: see the header.
const PASSAGES_SQL = `
SELECT coalesce(json_agg(row_to_json(t) ORDER BY t.document_id, t.char_start), '[]'::json) FROM (
  SELECT c.id::text AS id, c.id::text AS chunk_id,
         CASE WHEN d.tenant_id = '00000000-0000-0000-0000-000000000000'
              THEN 'local_corpus@v1' ELSE 'tenant_corpus@v1' END AS connector_id,
         CASE WHEN d.tenant_id = '00000000-0000-0000-0000-000000000000'
              THEN 'local_corpus' ELSE 'tenant_corpus' END AS source_kind,
         d.id::text AS document_id, dv.id::text AS document_version_id,
         c.section_path, c.char_start, c.char_end, c.text,
         d.evidence_tier, d.source_authority, d.license_class,
         to_char(d.published_at, 'YYYY-MM-DD') AS published_at, d.retracted,
         NULL::numeric AS score, NULL::json AS scores
  FROM chunks c
  JOIN document_versions dv ON dv.id = c.document_version_id
  JOIN documents d ON d.id = dv.document_id
  WHERE c.tenant_id = '${tenant}'
) t`;

const documents = await query(DOCUMENTS_SQL);
const versions = await query(VERSIONS_SQL);
const passages = await query(PASSAGES_SQL);

if (documents.length === 0 || passages.length === 0) {
  die(
    `the corpus at ${tenant} is empty (${documents.length} documents, ${passages.length} passages).\n` +
      `Refusing to overwrite the committed fixtures with nothing — ingest a corpus first.`,
  );
}

// Retrieval scores are per-query, so the DB has none. Preserve the ones the
// committed fixtures carry (matched by chunk id) rather than emitting nulls a
// later mock would have to invent: `scores` is the provenance surface S03
// renders, and losing it would quietly delete that test coverage.
const existing = JSON.parse(await readFile(path.join(outDir, "passages.json"), "utf8").catch(() => "[]"));
const scoreById = new Map(existing.map((p) => [p.id, { score: p.score, scores: p.scores }]));
let scored = 0;
for (const p of passages) {
  const kept = scoreById.get(p.id);
  if (kept) {
    Object.assign(p, kept);
    scored += 1;
  }
}

const write = async (name, value) => {
  const file = path.join(outDir, name);
  const json = `${JSON.stringify(value, null, 2)}\n`;
  if (checkOnly) return console.log(`  would write ${name} (${json.length} bytes)`);
  await writeFile(file, json);
  console.log(`  wrote ${name}`);
};

console.log(
  `exported ${documents.length} documents / ${versions.length} versions / ${passages.length} passages` +
    ` from ${tenant}\n  ${scored} passage(s) kept their committed retrieval scores`,
);
await write("documents.json", { documents, versions });
await write("passages.json", passages);
// web-pages.json is NOT exported: cached web results are not corpus rows and
// there is no table holding them (migrations 0067/0068). They are authored for
// the S04/S08 mocks and edited by hand.
console.log("  web-pages.json left alone — cached web pages are not corpus rows");

console.log(
  checkOnly
    ? "\n--check: nothing written. Run the shape test against the export before committing:\n" +
        "  node --test e2e/fixtures/corpus/corpusFixtures.test.js"
    : "\nNow run: node --test e2e/fixtures/corpus/corpusFixtures.test.js",
);
