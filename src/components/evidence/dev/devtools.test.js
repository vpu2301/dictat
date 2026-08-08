// devtools.test.js — EVA-S03: the retrieval playground's view models.
//
// The components draw; these decide. Everything a reviewer would want proven
// about the playground — that a filter reaches the wire, that a connector's
// status is reported rather than averaged away, that a null rerank score reads
// as "did not run" — lives in a pure module and is asserted here, with the S02
// corpus fixtures as input so the assertions run against contract-valid data
// rather than hand-made passages.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildRetrieveRequest } from "../../../api/evidenceRetrieval.js";
import { AUTHORITIES, SOURCE_KINDS } from "../../../api/evidenceRetrieval.js";
import {
  canSubmit, describeApplied, emptyForm, formIssues, parseSpecialty,
  setField, setFilter, specialtyText, toggleAuthority, toggleIn, toggleSource,
} from "./filtersModel.js";
import { CONNECTOR_STATUSES, connectorChips, connectorSummary } from "./connectorMeta.js";
import {
  excerpt, formatScore, identity, looksLikeTable, metaBadges,
  offsetLabel, scoreRows, sectionCrumbs, stateChips,
} from "./passageView.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../..");
const passages = JSON.parse(readFileSync(path.join(repoRoot, "e2e/fixtures/corpus/passages.json"), "utf8"));
const dts = readFileSync(path.join(repoRoot, "src/types/evidence.d.ts"), "utf8");
const byId = (suffix) => passages.find((p) => p.id.endsWith(suffix));

// ── FiltersEditor → request body ──────────────────────────────────────
test("editing every RR2 field through the model reaches the request body", () => {
  let form = emptyForm();
  form = setField(form, "query", "hypertension first line");
  form = setField(form, "k", 25);
  form = toggleSource(form, "web", SOURCE_KINDS);
  form = toggleSource(form, "pubmed", SOURCE_KINDS);
  form = toggleAuthority(form, "national", AUTHORITIES);
  form = toggleAuthority(form, "international", AUTHORITIES);
  form = setFilter(form, "specialty", parseSpecialty("cardiology, endocrinology"));
  form = setFilter(form, "jurisdiction", "UA");
  form = setFilter(form, "date_from", "2020-01-01");
  form = setFilter(form, "date_to", "2026-01-01");
  form = setFilter(form, "include_superseded", true);
  form = setField(form, "snapshotId", "22222222-2222-4222-8222-222222222222");
  form = setField(form, "tenantId", "11111111-1111-4111-8111-111111111111");
  form = setField(form, "traceId", "t-1");

  assert.deepEqual(buildRetrieveRequest(form), {
    query: "hypertension first line",
    k: 25,
    // Offered order, not click order: two people who tick the same boxes send
    // the same body, and a diff of two request logs stays readable.
    sources: ["local_corpus", "pubmed", "web"],
    tenant_id: "11111111-1111-4111-8111-111111111111",
    snapshot_id: "22222222-2222-4222-8222-222222222222",
    trace_id: "t-1",
    filters: {
      include_superseded: true,
      authority: ["national", "international"],
      specialty: ["cardiology", "endocrinology"],
      jurisdiction: "UA",
      date_from: "2020-01-01",
      date_to: "2026-01-01",
    },
  });
});

test("toggling is symmetric — off returns the untouched body", () => {
  let form = setField(emptyForm(), "query", "q");
  const before = buildRetrieveRequest(form);
  form = toggleAuthority(form, "tenant", AUTHORITIES);
  form = toggleAuthority(form, "tenant", AUTHORITIES);
  form = toggleSource(form, "drug", SOURCE_KINDS);
  form = toggleSource(form, "drug", SOURCE_KINDS);
  assert.deepEqual(buildRetrieveRequest(form), before);
});

test("toggleIn keeps the offered order regardless of click order", () => {
  assert.deepEqual(toggleIn(["web"], "local_corpus", SOURCE_KINDS), ["local_corpus", "web"]);
});

test("specialties are typed, de-duplicated and trimmed", () => {
  assert.deepEqual(parseSpecialty(" cardiology , endocrinology ,, cardiology "), ["cardiology", "endocrinology"]);
  assert.deepEqual(parseSpecialty(""), []);
  assert.deepEqual(parseSpecialty(null), []);
  assert.equal(specialtyText(["a", "b"]), "a, b");
});

test("the form refuses questions the service would reject or answer emptily", () => {
  const base = setField(emptyForm(), "query", "q");
  assert.equal(canSubmit(base), true);
  assert.deepEqual(formIssues(emptyForm()), ["query is required"]);
  assert.deepEqual(formIssues(setField(base, "k", 0)), ["k must be a positive integer"]);
  assert.deepEqual(formIssues({ ...base, sources: [] }), ["pick at least one source"]);
  assert.deepEqual(
    formIssues(setFilter(setFilter(base, "date_from", "2026-01-01"), "date_to", "2020-01-01")),
    ["date range ends before it starts"],
  );
  assert.deepEqual(formIssues(setField(base, "query", "x".repeat(2001))), ["query is capped at 2000 characters"]);
});

test("the empty state can echo exactly what was asked", () => {
  const body = buildRetrieveRequest({
    ...emptyForm(),
    query: "q",
    filters: { authority: ["national"], specialty: ["cardiology"], jurisdiction: "UA", date_from: "2020-01-01", date_to: "", include_superseded: true },
    snapshotId: "22222222-2222-4222-8222-222222222222",
  });
  assert.deepEqual(describeApplied(body), [
    "k=10",
    "sources: local_corpus",
    "authority: national",
    "specialty: cardiology",
    "jurisdiction: UA",
    "published 2020-01-01 → …",
    "including superseded versions",
    "snapshot 22222222-2222-4222-8222-222222222222",
  ]);
});

// ── ConnectorMetaBar ──────────────────────────────────────────────────
test("CONNECTOR_STATUSES is exactly the contract's ConnectorStatus union", () => {
  const m = dts.match(/export type ConnectorStatus =([^;]+);/);
  assert.ok(m, "ConnectorStatus missing from the generated types");
  assert.deepEqual([...CONNECTOR_STATUSES].sort(), [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]).sort());
});

const META = [
  { connector_id: "local_corpus@v1", kind: "local_corpus", status: "ok", latency_ms: 42, count: 5 },
  { connector_id: "web@v1", kind: "web", status: "unavailable", latency_ms: 3000, count: 0 },
  { connector_id: "pubmed@v1", kind: "pubmed", status: "degraded", latency_ms: 1900, count: 1 },
];

test("each connector gets a chip carrying status, count and latency in text", () => {
  const chips = connectorChips(META);
  assert.deepEqual(chips.map((c) => c.tone), ["ok", "bad", "warn"]);
  assert.equal(chips[0].label, "local_corpus@v1 · 5");
  assert.match(chips[0].title, /answered; 5 passages in 42 ms/);
  assert.match(chips[1].title, /did not answer; 0 passages in 3000 ms/);
  assert.match(chips[2].title, /answered partially/);
  // A connector that returned nothing is the one worth seeing — never dropped.
  assert.equal(chips.length, META.length);
});

test("an unknown status is treated as unavailable, not rendered raw", () => {
  const [chip] = connectorChips([{ connector_id: "x@v1", kind: "web", status: "wat", latency_ms: 1, count: 0 }]);
  assert.equal(chip.status, "unavailable");
  assert.equal(chip.tone, "bad");
});

test("the summary separates 'service says degraded' from 'a connector was quiet'", () => {
  const both = connectorSummary({ degraded: true, connector_meta: META });
  assert.equal(both.warn, true);
  assert.equal(both.passages, 6);
  assert.equal(both.slowestMs, 3000);
  assert.match(both.headline, /Degraded result .* web@v1 \(unavailable\), pubmed@v1 \(degraded\)/);

  const quietOnly = connectorSummary({ degraded: false, connector_meta: META.slice(0, 2) });
  assert.equal(quietOnly.degraded, false);
  assert.equal(quietOnly.warn, true);
  assert.match(quietOnly.headline, /^Complete result, but web@v1 \(unavailable\) contributed nothing\./);

  const clean = connectorSummary({ degraded: false, connector_meta: META.slice(0, 1) });
  assert.equal(clean.warn, false);
  assert.equal(clean.headline, "");
});

test("connector_meta may be absent entirely", () => {
  const s = connectorSummary({ passages: [] });
  assert.deepEqual(s.chips, []);
  assert.equal(s.warn, false);
  assert.equal(connectorChips(undefined).length, 0);
});

// ── PassageResultRow ──────────────────────────────────────────────────
test("badges are derived, and a missing tier says so", () => {
  const corpus = byId("000000000002");
  assert.deepEqual(metaBadges(corpus).map((b) => b.label), ["guideline", "international", "licensed internal", "local corpus"]);
  const web = byId("000000000040");
  const tier = metaBadges(web).find((b) => b.key === "tier");
  assert.deepEqual([tier.label, tier.muted, tier.value], ["tier unknown", true, null]);
});

test("a retracted passage is a warning, not another attribute", () => {
  const chips = stateChips(byId("000000000027"));
  assert.deepEqual(chips.map((c) => [c.label, c.tone]), [["retracted", "bad"]]);
  assert.match(chips[0].title, /do not rely/);
  // …and a restricted licence is a warning too: the NICE passages never ship
  // in a snapshot, which is why a result carrying one needs saying.
  assert.deepEqual(stateChips(byId("000000000004")).map((c) => c.label), ["restricted licence"]);
  assert.deepEqual(stateChips(byId("000000000001")), []);
});

test("a web passage names its domain, tier and access date", () => {
  const [chip] = stateChips(byId("000000000040"));
  assert.deepEqual([chip.key, chip.label], ["web", "who.int"]);
  assert.match(chip.title, /government, accessed 2026-07-28T09:14:00Z \(snapshot cached\)/);
  const registry = stateChips(byId("000000000042")).find((c) => c.key === "web");
  assert.match(registry.title, /\(no cached snapshot\)/);
});

test("section paths render as a breadcrumb", () => {
  assert.deepEqual(sectionCrumbs("2 Recommendations > 2.1 Monitoring"), ["2 Recommendations", "2.1 Monitoring"]);
  assert.deepEqual(sectionCrumbs("Abstract"), ["Abstract"]);
  assert.deepEqual(sectionCrumbs(null), []);
});

test("a stage that did not run reads as '—', not as zero", () => {
  const rows = scoreRows(byId("000000000001"));
  assert.deepEqual(rows.map((r) => r.stage), ["dense", "lexical", "fused", "rerank", "final"]);
  const rerank = rows.find((r) => r.stage === "rerank");
  assert.deepEqual([rerank.ran, rerank.display], [false, "—"]);
  // RRF output is ~0.016; two decimal places would print every one of them as
  // "0.02" and make the fusion column useless.
  assert.equal(rows.find((r) => r.stage === "fused").display, "0.0161");
  assert.deepEqual(scoreRows({}).every((r) => !r.ran), true);
});

test("score formatting keeps small numbers legible", () => {
  assert.equal(formatScore(0.0161), "0.0161");
  assert.equal(formatScore(0.00123456), "0.00123");
  assert.equal(formatScore(0.9), "0.9");
  assert.equal(formatScore(0), "0");
  assert.equal(formatScore(null), "—");
});

test("offsets, excerpts and table detection", () => {
  assert.equal(offsetLabel(byId("000000000001")), "chars 0–148");
  assert.equal(offsetLabel(byId("000000000040")), null, "web passages carry no offsets");

  const short = excerpt("abc", 10);
  assert.deepEqual([short.text, short.truncated], ["abc", false]);
  const long = excerpt("x".repeat(40), 10);
  assert.deepEqual([long.text.length, long.truncated], [11, true]);

  assert.equal(looksLikeTable(byId("000000000009").text), true);
  assert.equal(looksLikeTable(byId("000000000008").text), false);
});

test("identity rows are what you paste into psql", () => {
  assert.deepEqual(identity(byId("000000000001")).map((r) => r.label), ["passage", "document", "version", "connector"]);
  // A web hit has no document — the row shows what exists, not empty slots.
  assert.deepEqual(identity(byId("000000000040")).map((r) => r.label), ["passage", "connector"]);
});

test("every fixture passage survives the view model", () => {
  for (const p of passages) {
    assert.doesNotThrow(() => {
      metaBadges(p); stateChips(p); scoreRows(p); sectionCrumbs(p.section_path);
      offsetLabel(p); excerpt(p.text); identity(p);
    }, `${p.id} broke a view model`);
  }
});
