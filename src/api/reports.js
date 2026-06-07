// reports.js — structured diagnostic reports (sprint 08): list, read, version
// history / diff, amendment, and signing handoff.
//
// A report is produced from a finalized dictation session against a structured
// template. Versioning and amendments are first-class (medico-legal trail).

import { apiAt } from "./client.js";
import { SERVICES } from "./services.js";

const a = (p, init) => apiAt(SERVICES.core, p, init);

// GET /reports?status=&template=&query=&limit=&cursor=
export async function listReports({ status, template, query, limit = 50, cursor } = {}) {
  const qs = new URLSearchParams();
  if (status)   qs.set("status", status);
  if (template) qs.set("template", template);
  if (query)    qs.set("query", query);
  if (limit)    qs.set("limit", String(limit));
  if (cursor)   qs.set("cursor", cursor);
  const tail = qs.toString() ? `?${qs}` : "";
  return a(`/reports${tail}`, { method: "GET" });
}

export async function getReport(id) {
  return a(`/reports/${encodeURIComponent(id)}`, { method: "GET" });
}

// Create a new draft report from the live dictation editor.
// body: { template, language, body, patient_ref?, session_id? }
export async function createReport(body) {
  return a(`/reports`, { method: "POST", body: JSON.stringify(body) });
}

// Version history for the diff view.
export async function listReportVersions(id) {
  return a(`/reports/${encodeURIComponent(id)}/versions`, { method: "GET" });
}

export async function getReportVersion(id, version) {
  return a(`/reports/${encodeURIComponent(id)}/versions/${encodeURIComponent(version)}`, { method: "GET" });
}

// POST /reports/{id}/amend  body: { reason, body }
export async function amendReport(id, { reason, body }) {
  return a(`/reports/${encodeURIComponent(id)}/amend`, {
    method: "POST",
    body: JSON.stringify({ reason, body }),
  });
}

export async function updateReport(id, patch) {
  return a(`/reports/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) });
}
