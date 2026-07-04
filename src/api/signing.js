// signing.js — qualified e-signature of reports (sprint 09, S09 revision).
//
// One signing surface owned by the report-service — it builds the canonical
// bytes the signature legally binds to and fans out to signing-service:
//
//   POST /v1/reports/{id}/sign          (report-service :8006)
//     provider "file_key"     → 200 InlineSignResponse   (level "qualified")
//     provider "dev_password" → 200 InlineSignResponse   (level "dev"; the
//                                account-password path — simple e-signature)
//     provider "diia"         → 202 SignSessionResponse  (poll the session)
//
//   GET    /signing/sessions/{id}       (signing-service :8008) — poll Дія
//   DELETE /signing/sessions/{id}       — cancel a not-yet-committed session
//   GET    /readyz                      — advertised (wired) providers
//   GET    /verify/{token}              — PUBLIC envelope verification
//   GET    /verify/{token}/pdf          — PUBLIC signed-artifact download
//
// The key container + key password pass through this module in memory only;
// nothing here logs, stores, or echoes them.

import { apiAt } from "./client.js";
import { SERVICES } from "./services.js";

// POST /v1/reports/{id}/sign.
// Returns { kind: "envelope", envelope } on a 200 (inline providers) or
// { kind: "session", session } on a 202 (Дія). The two response bodies are
// disjoint — an inline envelope always carries envelope_id, a session never
// does — so the shape, not the status code, discriminates.
export async function signReport(reportId, body) {
  const res = await apiAt(
    SERVICES.report,
    `/v1/reports/${encodeURIComponent(reportId)}/sign`,
    { method: "POST", body: JSON.stringify(body) },
  );
  if (res && res.envelope_id) return { kind: "envelope", envelope: res };
  return { kind: "session", session: res };
}

// GET /signing/sessions/{id} → { session_id, status, provider, expires_at,
//   redirect_url?, qr_payload?, signed_envelope_id?, failure_reason?,
//   verification_token?, signed_at?, signer_full_name? }
// status ∈ initiating | awaiting_user | verifying | signed | failed |
//          expired | cancelled  (backend enum verbatim)
export async function getSigningSession(sessionId) {
  return apiAt(SERVICES.signing, `/signing/sessions/${encodeURIComponent(sessionId)}`, {
    method: "GET",
  });
}

export async function cancelSigningSession(sessionId) {
  return apiAt(SERVICES.signing, `/signing/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  });
}

// GET /readyz (public) → { status, providers: ["diia", "file_key", ...] }.
// The list of providers wired on this deployment — the dialog only offers
// what the backend advertises. Failure degrades to the file_key default.
export async function getAdvertisedProviders() {
  const r = await fetch(`${SERVICES.signing}/readyz`, { method: "GET" });
  if (!r.ok) throw new Error(`readyz_${r.status}`);
  const body = await r.json();
  return Array.isArray(body.providers) ? body.providers : [];
}

// Public signature verification (no auth — used by the anonymous /verify page).
// GET /verify/{token} → { status: "valid" | "dev_not_qualified",
//   signature_level, provider, resource_type, signed_at, signer_full_name,
//   is_qualified, certificate_issuer_cn, certificate_serial,
//   signature_algorithm, document_hash_sha256_hex, valid, verification_token }
export async function verifyEnvelope(token) {
  const r = await fetch(`${SERVICES.signing}/verify/${encodeURIComponent(token)}`, {
    method: "GET",
  });
  if (!r.ok) {
    let problem = null;
    try { problem = await r.json(); } catch {}
    const detail = problem && (problem.detail || problem.title);
    throw new Error(typeof detail === "string" ? detail : `verify_failed_${r.status}`);
  }
  return r.json();
}

// Absolute URL of the PUBLIC signed-artifact download (GET /verify/{token}/pdf).
// Serves application/pdf for PAdES/dev artifacts, .p7s for detached CMS.
export function verifiedPdfUrl(token) {
  return `${SERVICES.signing}/verify/${encodeURIComponent(token)}/pdf`;
}

// SPA route of the public verify page for a verification token — what the
// "copy verify link" button puts on the clipboard.
export function verifyPageUrl(token) {
  const base = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "";
  return `${base}#/verify/${encodeURIComponent(token)}`;
}
