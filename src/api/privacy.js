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
// The admin queue / review / approve / reject / status+download client fns
// land with the admin surfaces in S11 step 06.

import { apiAt } from "./client.js";
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
