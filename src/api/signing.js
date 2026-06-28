// signing.js — qualified e-signature of reports (sprint 09).
//
// Two paths, both server-driven:
//   Дія.Підпис — backend returns a QR payload + deeplink; the FE polls status.
//   Local KEP  — download the unsigned PDF, sign it with local software, upload.
//
// Served by the signing-service (:8008) per the integration guide §3:
//   POST /signing/sessions     — initiate (requires report.write)
//   GET  /verify/{token}       — PUBLIC signature verification (no auth)
//   GET  /verify/{token}/pdf   — PUBLIC signed-PDF download
// The unsigned PDF handed to local signing software comes from the
// report-service (the document owner), not the signing-service.

import { apiAt } from "./client.js";
import { SERVICES } from "./services.js";

const a = (p, init) => apiAt(SERVICES.signing, p, init);

// POST /signing/sessions  (InitiateSessionRequest)
// Initiates a signing session for a report. Returns
// { signing_id, method, qr_data?, deeplink?, expires_in?, status }.
export async function initSigning(reportId, { method }) {
  return a(`/signing/sessions`, {
    method: "POST",
    body: JSON.stringify({ report_id: reportId, method }),
  });
}

// GET /signing/sessions/{id} → { status, envelope_id?, signer?, signed_at? }
// status ∈ initiated | awaiting_user | signing | complete | expired | cancelled
export async function getSigningStatus(signingId) {
  return a(`/signing/sessions/${encodeURIComponent(signingId)}`, { method: "GET" });
}

export async function cancelSigning(signingId) {
  return a(`/signing/sessions/${encodeURIComponent(signingId)}`, { method: "DELETE" });
}

// Certificates available for the Local KEP path.
export async function listCertificates() {
  return a(`/signing/certificates`, { method: "GET" });
}

// Upload a locally-signed PDF for a signing session (multipart).
export async function uploadSignedPdf(signingId, file) {
  const fd = new FormData();
  fd.append("file", file);
  return a(`/signing/sessions/${encodeURIComponent(signingId)}/upload`, { method: "POST", body: fd });
}

// Absolute URL of the unsigned PDF to hand to local signing software. The
// report document lives on the report-service (:8006).
export function unsignedPdfUrl(reportId) {
  return `${SERVICES.report}/v1/reports/${encodeURIComponent(reportId)}/pdf`;
}

// Absolute URL of the PUBLIC signed-PDF download (GET /verify/{token}/pdf).
export function verifiedPdfUrl(token) {
  return `${SERVICES.signing}/verify/${encodeURIComponent(token)}/pdf`;
}

// Public signature verification (no auth — used by the anonymous /verify page).
// GET /verify/{token} → { valid, signerName, certIssuer, ... }.
export async function verifyEnvelope(token) {
  const r = await fetch(`${SERVICES.signing}/verify/${encodeURIComponent(token)}`, { method: "GET" });
  if (!r.ok) {
    let problem = null;
    try { problem = await r.json(); } catch {}
    const detail = problem && (problem.detail || problem.title);
    throw new Error(detail || `verify_failed_${r.status}`);
  }
  return r.json();
}
