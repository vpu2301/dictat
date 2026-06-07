// signing.js — qualified e-signature of reports (sprint 09).
//
// Two paths, both server-driven:
//   Дія.Підпис — backend returns a QR payload + deeplink; the FE polls status.
//   Local KEP  — download the unsigned PDF, sign it with local software, upload.
//
// Endpoints live on the core service alongside reports.

import { apiAt } from "./client.js";
import { SERVICES } from "./services.js";

const a = (p, init) => apiAt(SERVICES.core, p, init);

// POST /reports/{id}/signing  body: { method: "diia" | "local" }
// Returns { signing_id, method, qr_data?, deeplink?, expires_in?, status }.
export async function initSigning(reportId, { method }) {
  return a(`/reports/${encodeURIComponent(reportId)}/signing`, {
    method: "POST",
    body: JSON.stringify({ method }),
  });
}

// GET /signing/{signingId} → { status, envelope_id?, signer?, signed_at? }
// status ∈ initiated | awaiting_user | signing | complete | expired | cancelled
export async function getSigningStatus(signingId) {
  return a(`/signing/${encodeURIComponent(signingId)}`, { method: "GET" });
}

export async function cancelSigning(signingId) {
  return a(`/signing/${encodeURIComponent(signingId)}`, { method: "DELETE" });
}

// Certificates available for the Local KEP path.
export async function listCertificates() {
  return a(`/signing/certificates`, { method: "GET" });
}

// Upload a locally-signed PDF for a signing session (multipart).
export async function uploadSignedPdf(signingId, file) {
  const fd = new FormData();
  fd.append("file", file);
  return a(`/signing/${encodeURIComponent(signingId)}/upload`, { method: "POST", body: fd });
}

// Absolute URL of the unsigned PDF to hand to local signing software.
export function unsignedPdfUrl(reportId) {
  return `${SERVICES.core}/reports/${encodeURIComponent(reportId)}/pdf`;
}

// Public signature verification (no auth — used by the anonymous /verify page).
// GET /verify/{envelopeId} → { valid, signerName, certIssuer, ... }.
export async function verifyEnvelope(envelopeId) {
  const r = await fetch(`${SERVICES.core}/verify/${encodeURIComponent(envelopeId)}`, { method: "GET" });
  if (!r.ok) {
    let problem = null;
    try { problem = await r.json(); } catch {}
    const detail = problem && (problem.detail || problem.title);
    throw new Error(detail || `verify_failed_${r.status}`);
  }
  return r.json();
}
