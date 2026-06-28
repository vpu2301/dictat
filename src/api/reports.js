// reports.js — structured diagnostic reports (sprint 08): list/search, read,
// version diff, draft autosave, lifecycle (finalize / revert / cancel),
// amendment, and signing handoff.
//
// Lives on the report-service (:8006) under the /v1/reports prefix per the
// backend integration guide (2026-06-20 §3). NOT the legacy "core" service.
//
// A report is produced from a finalized dictation session against a structured
// template. Versioning and amendments are first-class (medico-legal trail).

import { apiAt } from "./client.js";
import { SERVICES } from "./services.js";

const a = (p, init) => apiAt(SERVICES.report, p, init);

// The guide exposes full-text search (GET /v1/reports/search) rather than a
// bare list; the Reports page uses it with empty filters to show everything.
export async function listReports({ status, template, query, limit = 50, cursor } = {}) {
  const qs = new URLSearchParams();
  if (status)   qs.set("status", status);
  if (template) qs.set("template", template);
  if (query)    qs.set("query", query);
  if (limit)    qs.set("limit", String(limit));
  if (cursor)   qs.set("cursor", cursor);
  const tail = qs.toString() ? `?${qs}` : "";
  return a(`/v1/reports/search${tail}`, { method: "GET" });
}

// GET /v1/reports/{id} → ReportEnvelope.
export async function getReport(id) {
  return a(`/v1/reports/${encodeURIComponent(id)}`, { method: "GET" });
}

// Create a new draft report from the live dictation editor.
// body: { template, language, body, patient_ref?, session_id? }
export async function createReport(body) {
  return a(`/v1/reports`, { method: "POST", body: JSON.stringify(body) });
}

// Draft autosave. The backend uses optimistic locking + body_hash idempotency,
// so callers may pass the current version / body_hash through `patch`.
// (PUT /v1/reports/{id}/draft)
export async function updateReport(id, patch) {
  return a(`/v1/reports/${encodeURIComponent(id)}/draft`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

// Version diff for the history view (GET /v1/reports/{id}/diff).
// Optional ?from=&to= version selectors.
export async function reportDiff(id, { from, to } = {}) {
  const qs = new URLSearchParams();
  if (from != null) qs.set("from", String(from));
  if (to != null)   qs.set("to", String(to));
  const tail = qs.toString() ? `?${qs}` : "";
  return a(`/v1/reports/${encodeURIComponent(id)}/diff${tail}`, { method: "GET" });
}

// Version history helpers. The diff view fetches two snapshots and renders the
// delta client-side; these read individual versions under the report resource.
export async function listReportVersions(id) {
  return a(`/v1/reports/${encodeURIComponent(id)}/versions`, { method: "GET" });
}

export async function getReportVersion(id, version) {
  return a(`/v1/reports/${encodeURIComponent(id)}/versions/${encodeURIComponent(version)}`, { method: "GET" });
}

// POST /v1/reports/{id}/amend  body: { reason, body }
export async function amendReport(id, { reason, body }) {
  return a(`/v1/reports/${encodeURIComponent(id)}/amend`, {
    method: "POST",
    body: JSON.stringify({ reason, body }),
  });
}

// ── Lifecycle transitions (guide §3) ───────────────────────────────────────
export async function finalizeReport(id) {
  return a(`/v1/reports/${encodeURIComponent(id)}/finalize`, { method: "POST" });
}

export async function revertReportToDraft(id) {
  return a(`/v1/reports/${encodeURIComponent(id)}/revert-to-draft`, { method: "POST" });
}

export async function cancelReport(id) {
  return a(`/v1/reports/${encodeURIComponent(id)}/cancel`, { method: "POST" });
}

// Mark the report signed (ties into signing-service).
export async function signReport(id, body = {}) {
  return a(`/v1/reports/${encodeURIComponent(id)}/sign`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
