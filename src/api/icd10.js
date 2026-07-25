// icd10.js — ICD-10 code search (Sprint 13, backend step 03).
//
// GET /v1/icd10/search?q=<1..80>&limit=<1..20, default 10> on the
// report-service, scope report.read → { results: [{code, display, is_leaf}] }.
// Ranking is server-side (exact-code first, then prefix, then FTS) and p95
// ≤ 50 ms — the FE still debounces (the picker in step 05 reuses the
// sprint-10 useSuggestions debounce/cancel pattern) and passes an
// AbortSignal so a stale keystroke's request is cancelled, not raced.
//
// GATED: the endpoint ships with backend step 03. Until it lands this
// returns the transport's 404 as a normal ApiError — callers (step 05)
// treat that as "search unavailable", never mock.
//
// Only `is_leaf: true` rows are selectable as a diagnosis code; non-leaf
// rows are category headers the picker may show but must not confirm.

import { apiAt } from "./client.js";
import { SERVICES } from "./services.js";

export const ICD10_QUERY_MIN = 1;
export const ICD10_QUERY_MAX = 80;
export const ICD10_LIMIT_DEFAULT = 10;
export const ICD10_LIMIT_MAX = 20;

// Pure path builder (unit-tested): clamps limit to 1..20, truncates the
// query to the backend's 80-char bound. Returns null for an empty query —
// the caller should simply not search.
export function icd10SearchPath(q, limit = ICD10_LIMIT_DEFAULT) {
  const query = String(q ?? "").trim().slice(0, ICD10_QUERY_MAX);
  if (query.length < ICD10_QUERY_MIN) return null;
  const lim = Math.min(ICD10_LIMIT_MAX, Math.max(1, Math.trunc(limit) || ICD10_LIMIT_DEFAULT));
  const qs = new URLSearchParams({ q: query, limit: String(lim) });
  return `/v1/icd10/search?${qs}`;
}

// → { results: [{code, display, is_leaf}] }. Pass an AbortSignal to cancel
// superseded requests (the fetch init is forwarded verbatim by the client).
export async function searchIcd10(q, { limit, signal } = {}) {
  const path = icd10SearchPath(q, limit);
  if (!path) return { results: [] };
  return apiAt(SERVICES.report, path, { method: "GET", signal });
}
