// privacy.js — GDPR / data-subject rights against the core service (sprint 11).
//
//   DSAR  — data subject access request (export a copy of all PHI held).
//   Erasure — right to be forgotten; scheduled with a cancellation window.

import { apiAt } from "./client.js";
import { SERVICES } from "./services.js";

const a = (p, init) => apiAt(SERVICES.core, p, init);

// POST /patients/{id}/dsar — body: { reason? }. Backend kicks off the export
// job and returns { request_id, status }.
export async function requestDsar(patientId, { reason } = {}) {
  return a(`/patients/${encodeURIComponent(patientId)}/dsar`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

// POST /patients/{id}/erasure — body: { reason }. Returns { scheduled_at,
// cancel_until } so the UI can show the real cancellation deadline.
export async function scheduleErasure(patientId, { reason } = {}) {
  return a(`/patients/${encodeURIComponent(patientId)}/erasure`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}
