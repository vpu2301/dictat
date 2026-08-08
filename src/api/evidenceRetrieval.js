// evidenceRetrieval.js — POST /retrieve on evidence-retrieval (:8011).
//
// The first evidence API module, and the shape every later one copies: a thin
// call through `apiAt(SERVICES.x, …)` plus a PURE request builder that the
// screens hand a form object. The builder is where the contract lives, so it
// can be tested without a browser, a server or a component.
//
// Payload shapes come from src/types/evidence (generated, EVA-S01). Nothing in
// this file redeclares them — see src/types/README.md.

import { apiAt } from "./client.js";
import { SERVICES } from "./services.js";

/** The reserved nil uuid: the global corpus partition every tenant may read. */
export const GLOBAL_TENANT = "00000000-0000-0000-0000-000000000000";

/**
 * Connector kinds the `sources` array accepts, in the order the playground
 * offers them. Mirrors the `ConnectorKind` union in src/types/evidence.d.ts —
 * a value list, not a type, and `evidenceRetrieval.test.js` asserts the two
 * are identical so a connector added by the backend cannot go unoffered.
 */
export const SOURCE_KINDS = [
  "local_corpus",
  "tenant_corpus",
  "pubmed",
  "guideline_registry",
  "web",
  "drug",
];

/** Authority values the filter offers, likewise mirrored from the contract. */
export const AUTHORITIES = ["tenant", "national", "international", "primary_literature", "other"];

/** What the playground starts with, and what "reset" restores. */
export const DEFAULT_FORM = {
  query: "",
  k: 10,
  sources: ["local_corpus"],
  tenantId: "",
  snapshotId: "",
  traceId: "",
  filters: {
    authority: [],
    jurisdiction: "",
    specialty: [],
    date_from: "",
    date_to: "",
    include_superseded: false,
  },
};

const trimmed = (v) => (typeof v === "string" ? v.trim() : v);
const nonEmpty = (list) => Array.isArray(list) && list.length > 0;

/**
 * Form state → RetrieveRequest body.
 *
 * Empty fields are OMITTED rather than sent as null. Both are accepted by the
 * backend (`anyOf: [..., null]`), but a body carrying eight nulls makes the
 * devtools' own request log unreadable — and reading the request is most of
 * why the playground exists. `include_superseded` is the exception: it is a
 * boolean with a default of false and is always sent, because "I deliberately
 * left it off" and "I forgot it existed" are different states to debug.
 *
 * `snapshot_id` is top-level in the contract, NOT a member of `filters`, even
 * though the UI groups it with them — pinning a snapshot selects which corpus
 * you search, it does not narrow results within one.
 */
export function buildRetrieveRequest(form) {
  const f = { ...DEFAULT_FORM.filters, ...(form.filters || {}) };
  const filters = { include_superseded: !!f.include_superseded };
  if (nonEmpty(f.authority)) filters.authority = [...f.authority];
  // Trim BEFORE the emptiness test: a specialty list holding one blank entry
  // (the state a half-typed chip input is in) would otherwise send `[]`, which
  // reads as "filtered to nothing" rather than "not filtered".
  const specialty = (f.specialty || []).map(trimmed).filter(Boolean);
  if (specialty.length) filters.specialty = specialty;
  if (trimmed(f.jurisdiction)) filters.jurisdiction = trimmed(f.jurisdiction);
  if (trimmed(f.date_from)) filters.date_from = trimmed(f.date_from);
  if (trimmed(f.date_to)) filters.date_to = trimmed(f.date_to);

  const k = Number.parseInt(form.k, 10);
  const body = {
    query: trimmed(form.query) || "",
    k: Number.isFinite(k) && k >= 1 ? k : DEFAULT_FORM.k,
    sources: nonEmpty(form.sources) ? [...form.sources] : ["local_corpus"],
    filters,
  };
  if (trimmed(form.tenantId)) body.tenant_id = trimmed(form.tenantId);
  if (trimmed(form.snapshotId)) body.snapshot_id = trimmed(form.snapshotId);
  if (trimmed(form.traceId)) body.trace_id = trimmed(form.traceId);
  return body;
}

/** POST /retrieve. `body` is what buildRetrieveRequest returned. */
export function retrieve(body) {
  return apiAt(SERVICES.evidenceRetrieval, "/retrieve", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * The retrieval service is down or its mandatory engine (pgvector) is:
 * a 503 the operator can retry, not a request the caller got wrong. The
 * playground shows retry for this and only this.
 */
export function isRetrievalUnavailable(error) {
  if (!error) return false;
  const code = error.problem?.code || error.problem?.detail?.code;
  return error.status === 503 || code === "retrieval_unavailable";
}

/**
 * `degraded: true` means the answer is real but incomplete — a connector
 * timed out or the lexical engine was unavailable and the response came back
 * on dense alone. Distinct from an error in the one way that matters: there
 * are results, and they are usable if you know what is missing.
 */
export function degradedConnectors(response) {
  return (response?.connector_meta || []).filter((c) => c.status !== "ok");
}
