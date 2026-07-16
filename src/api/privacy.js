// privacy.js — GDPR / data-subject rights against the core service.
//
//   DSAR    — data subject access request (export a copy of all PHI held).
//   Erasure — right to be forgotten; TWO-PERSON workflow: requested → review
//             → approved (grace window starts HERE, not at request time) →
//             executing → completed, or rejected at any pre-executing stage.
//
// Contract re-pinned S11 step 01 against the as-built core-service. Both
// calls return PrivacyRequestOut: { id, patient_id, kind, reason, status,
//   requested_by, requested_at, scheduled_for, reviewed_by, reviewed_at,
//   rejection_reason, completed_at }.
//
import { apiAt, getAccessToken } from "./client.js";
import { SERVICES } from "./services.js";

const a = (p, init) => apiAt(SERVICES.core, p, init);

// POST /patients/{id}/dsar — body: { reason }. 202 (not 201): the export job
// starts immediately, so the request arrives already status="executing".
// Requires scope patient.dsar (tenant_admin). 409 code=dsar_already_running
// (problem carries request_id) / 409 code=patient_erased.
export async function requestDsar(patientId, { reason } = {}) {
  return a(`/patients/${encodeURIComponent(patientId)}/dsar`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

// POST /patients/{id}/erasure — body: { reason }. 201, status="requested",
// scheduled_for=null. Erasure only becomes scheduled when a SECOND person
// holding privacy.approve approves it (403 code=two_person_rule if the
// approver is the requester).
export async function scheduleErasure(patientId, { reason } = {}) {
  return a(`/patients/${encodeURIComponent(patientId)}/erasure`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

// ── S11 step 06: the admin queue + two-person workflow ──────────────────

// GET /privacy-requests?status=&kind= → PrivacyRequestOut[] (admin queue).
export async function listPrivacyRequests({ status, kind } = {}) {
  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  if (kind) qs.set("kind", kind);
  const tail = qs.toString() ? `?${qs}` : "";
  return a(`/privacy-requests${tail}`, { method: "GET" });
}

// GET /privacy-requests/{id} → PrivacyRequestStatus (scope patient.dsar).
// Completed DSAR adds { download: {url, expires_at}, package_expired,
// manifest_summary }. Every call that mints a download pointer is audited
// server-side — that is WHY the UI re-fetches per click (fresh mint).
export async function getPrivacyRequest(id) {
  return a(`/privacy-requests/${encodeURIComponent(id)}`, { method: "GET" });
}

// POST /privacy-requests/{id}/review — 'requested' → 'review'.
export async function reviewPrivacyRequest(id) {
  return a(`/privacy-requests/${encodeURIComponent(id)}/review`, { method: "POST" });
}

// POST /privacy-requests/{id}/approve — 'requested'|'review' → 'approved';
// sets scheduled_for = now + grace. Scope privacy.approve; the backend
// 403s code=two_person_rule when approver == requester.
export async function approvePrivacyRequest(id) {
  return a(`/privacy-requests/${encodeURIComponent(id)}/approve`, { method: "POST" });
}

// POST /privacy-requests/{id}/reject — also the cancel-during-grace path
// ('approved' → 'rejected'). rejection_reason is REQUIRED (422 otherwise).
export async function rejectPrivacyRequest(id, { rejection_reason }) {
  return a(`/privacy-requests/${encodeURIComponent(id)}/reject`, {
    method: "POST",
    body: JSON.stringify({ rejection_reason }),
  });
}

// GET /privacy-requests/{id}/download — the authenticated DSAR zip.
// Raw fetch (not the JSON wrapper): the body is binary. 410 = package
// past TTL and deleted. Returns a Blob for an object-URL download.
export async function downloadDsarPackage(id) {
  const token = getAccessToken();
  const r = await fetch(`${SERVICES.core}/privacy-requests/${encodeURIComponent(id)}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
  });
  if (!r.ok) {
    const problem = await r.json().catch(() => ({ title: `HTTP ${r.status}` }));
    const err = new Error(problem.detail || problem.title || `HTTP ${r.status}`);
    err.status = r.status;
    err.problem = problem;
    throw err;
  }
  return r.blob();
}
