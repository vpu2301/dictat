// evidenceRetrieval.test.js — EVA-S03 AC-S03-F-2.
//
// Every RR2 filter must round-trip into the request body. The playground is a
// debugging tool: a filter that renders but never reaches the wire would send
// someone hunting a retrieval bug that is really a form bug, which is the
// exact failure this screen exists to prevent.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  AUTHORITIES,
  DEFAULT_FORM,
  GLOBAL_TENANT,
  SOURCE_KINDS,
  buildRetrieveRequest,
  degradedConnectors,
  isRetrievalUnavailable,
} from "./evidenceRetrieval.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const dts = readFileSync(path.resolve(here, "../types/evidence.d.ts"), "utf8");
const unionOf = (name) => {
  const m = dts.match(new RegExp(`export type ${name} =([^;]+);`));
  assert.ok(m, `${name} missing from the generated types`);
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
};

// ── the vocabulary the form offers ────────────────────────────────────
test("SOURCE_KINDS is exactly the contract's ConnectorKind union", () => {
  assert.deepEqual([...SOURCE_KINDS].sort(), unionOf("ConnectorKind").sort());
});

test("AUTHORITIES is exactly the contract's SourceAuthority union", () => {
  assert.deepEqual([...AUTHORITIES].sort(), unionOf("SourceAuthority").sort());
});

// ── the request body ──────────────────────────────────────────────────
test("an untouched form asks the smallest legal question", () => {
  const body = buildRetrieveRequest({ ...DEFAULT_FORM, query: "metformin in ckd" });
  assert.deepEqual(body, {
    query: "metformin in ckd",
    k: 10,
    sources: ["local_corpus"],
    filters: { include_superseded: false },
  });
  // No nulls: an empty field is absent, not present-and-null. The one
  // exception is include_superseded — see the builder's comment.
  assert.equal(Object.values(body.filters).includes(null), false);
});

test("every RR2 filter reaches the wire", () => {
  const body = buildRetrieveRequest({
    query: "  гіпертензія  ",
    k: "25",
    sources: ["local_corpus", "tenant_corpus", "web"],
    tenantId: "11111111-1111-4111-8111-111111111111",
    snapshotId: "22222222-2222-4222-8222-222222222222",
    traceId: "trace-abc",
    filters: {
      authority: ["national", "international"],
      jurisdiction: "UA",
      specialty: ["cardiology", " endocrinology "],
      date_from: "2020-01-01",
      date_to: "2026-01-01",
      include_superseded: true,
    },
  });
  assert.deepEqual(body, {
    query: "гіпертензія",
    k: 25,
    sources: ["local_corpus", "tenant_corpus", "web"],
    tenant_id: "11111111-1111-4111-8111-111111111111",
    snapshot_id: "22222222-2222-4222-8222-222222222222",
    trace_id: "trace-abc",
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

test("snapshot_id is top-level, not a filter", () => {
  // The UI groups it with the filters; the contract does not. Pinning a
  // snapshot chooses WHICH corpus is searched — it does not narrow results
  // within one — and a body that nested it would 422 on additionalProperties.
  const body = buildRetrieveRequest({
    ...DEFAULT_FORM,
    query: "q",
    snapshotId: "22222222-2222-4222-8222-222222222222",
  });
  assert.equal(body.snapshot_id, "22222222-2222-4222-8222-222222222222");
  assert.equal("snapshot_id" in body.filters, false);
});

test("blank filters are omitted, not sent empty", () => {
  const body = buildRetrieveRequest({
    ...DEFAULT_FORM,
    query: "q",
    tenantId: "   ",
    snapshotId: "",
    filters: { authority: [], specialty: [""], jurisdiction: "  ", date_from: "", date_to: "" },
  });
  assert.deepEqual(Object.keys(body).sort(), ["filters", "k", "query", "sources"]);
  assert.deepEqual(body.filters, { include_superseded: false });
});

test("k is coerced, and nonsense falls back to the default", () => {
  const k = (v) => buildRetrieveRequest({ ...DEFAULT_FORM, query: "q", k: v }).k;
  assert.equal(k("25"), 25);
  assert.equal(k(3.7), 3);
  assert.equal(k(0), 10, "k has a minimum of 1 in the contract");
  assert.equal(k(-4), 10);
  assert.equal(k(""), 10);
  assert.equal(k("abc"), 10);
});

test("an empty source list falls back to the corpus rather than asking for nothing", () => {
  const body = buildRetrieveRequest({ ...DEFAULT_FORM, query: "q", sources: [] });
  assert.deepEqual(body.sources, ["local_corpus"]);
});

test("the builder copies its inputs — a resubmit cannot mutate form state", () => {
  const form = {
    ...DEFAULT_FORM,
    query: "q",
    sources: ["local_corpus"],
    filters: { ...DEFAULT_FORM.filters, authority: ["national"] },
  };
  const body = buildRetrieveRequest(form);
  body.sources.push("web");
  body.filters.authority.push("tenant");
  assert.deepEqual(form.sources, ["local_corpus"]);
  assert.deepEqual(form.filters.authority, ["national"]);
});

test("the nil-uuid global partition is the documented default", () => {
  assert.match(GLOBAL_TENANT, /^0{8}-0{4}-0{4}-0{4}-0{12}$/);
  // Omitted from the body: the backend's own default is this same value, and
  // sending it explicitly would hide the fact that nothing was chosen.
  assert.equal("tenant_id" in buildRetrieveRequest({ ...DEFAULT_FORM, query: "q" }), false);
});

// ── response classification ───────────────────────────────────────────
test("retrieval_unavailable is told apart from an ordinary rejection", () => {
  assert.equal(isRetrievalUnavailable({ status: 503, problem: {} }), true);
  assert.equal(isRetrievalUnavailable({ status: 500, problem: { code: "retrieval_unavailable" } }), true);
  assert.equal(isRetrievalUnavailable({ status: 422, problem: { code: "invalid_filter" } }), false);
  assert.equal(isRetrievalUnavailable({ status: 403, problem: {} }), false);
  assert.equal(isRetrievalUnavailable(null), false);
});

test("degraded connectors are the ones that did not answer cleanly", () => {
  const response = {
    degraded: true,
    connector_meta: [
      { connector_id: "local_corpus@v1", kind: "local_corpus", status: "ok", latency_ms: 42, count: 5 },
      { connector_id: "web@v1", kind: "web", status: "unavailable", latency_ms: 3000, count: 0 },
      { connector_id: "pubmed@v1", kind: "pubmed", status: "degraded", latency_ms: 1900, count: 1 },
    ],
  };
  assert.deepEqual(degradedConnectors(response).map((c) => c.connector_id), ["web@v1", "pubmed@v1"]);
  assert.deepEqual(degradedConnectors({ connector_meta: [] }), []);
  assert.deepEqual(degradedConnectors(null), []);
});
