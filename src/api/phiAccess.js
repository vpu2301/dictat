// phiAccess.js — break-glass access to a single report (S14).
//
// A tenant_admin holds no standing clinical read. When one genuinely
// needs a specific report, the flow is two calls:
//
//   1. reauth(password)                  → reauth_ticket   (auth-service)
//   2. requestPhiAccess({ ..., ticket }) → a time-limited grant
//
// After step 2 the ordinary getReport(id) / report PDF calls succeed for
// that ONE report until the grant expires. Every read under it is
// counted, audited at `sec` severity, and notified to the report's
// authors — so treat this as a visible act, not a workaround.
//
// Lives on report-service, which owns both the reports and the grants.

import { apiAt } from "./client.js";
import { SERVICES } from "./services.js";

const a = (p, init) => apiAt(SERVICES.report, p, init);

/**
 * GET /v1/phi-access-requests/reasons — the dropdown vocabulary plus the
 * grant window, served rather than hard-coded here: the reason codes are
 * pinned by a DB CHECK, so a client that invented an option would only
 * find out at submit time.
 *
 * → { reasons: [{ code, label_uk, label_en, requires_note }],
 *     grant_ttl_minutes, note_min_chars }
 */
export async function listAccessReasons() {
  return a("/v1/phi-access-requests/reasons", { method: "GET" });
}

/**
 * POST /v1/phi-access-requests — spend the ticket, mint the grant.
 *
 * Throws ApiError:
 *   401 code=reauth_required     ticket stale/spent/forged → re-enter password
 *   422 code=reason_note_required `other` needs a written justification
 *   404                           no such report in this tenant
 */
export async function requestPhiAccess({
  resourceId,
  reasonCode,
  reasonNote = "",
  reauthTicket,
}) {
  return a("/v1/phi-access-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // The backend models are `extra="forbid"` — send exactly these keys.
    body: JSON.stringify({
      resource_id: resourceId,
      reason_code: reasonCode,
      reason_note: reasonNote,
      reauth_ticket: reauthTicket,
    }),
  });
}

/**
 * GET /v1/phi-access-requests — the oversight log. `activeOnly` narrows to
 * grants that are still open, which is the "who can read what right now"
 * question rather than the historical one.
 */
export async function listPhiAccessRequests({
  resourceId,
  requestedBy,
  activeOnly = false,
  limit = 50,
} = {}) {
  const qs = new URLSearchParams();
  if (resourceId) qs.set("resource_id", resourceId);
  if (requestedBy) qs.set("requested_by", requestedBy);
  if (activeOnly) qs.set("active_only", "true");
  qs.set("limit", String(limit));
  return a(`/v1/phi-access-requests?${qs}`, { method: "GET" });
}

/** POST /v1/phi-access-requests/{id}/revoke — close an open grant early. */
export async function revokePhiAccess(grantId) {
  return a(`/v1/phi-access-requests/${grantId}/revoke`, { method: "POST" });
}

/**
 * True when an ApiError is the backend saying "you have no clinical read,
 * but you MAY break glass on this" — the signal to open the request modal
 * on the very resource the user just tried to open.
 */
export function isPhiAccessRequired(err) {
  return Boolean(err && err.status === 403 && err.problem?.code === "phi_access_required");
}

/** The resource id carried by such a 403, so the modal opens pre-targeted. */
export function phiAccessResourceId(err) {
  return err?.problem?.resource_id || null;
}
