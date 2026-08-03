// patientDocuments.js — files attached to a patient's record (migration 0065).
//
//   GET    /patients/{id}/documents                      → { items, total }
//   POST   /patients/{id}/documents          multipart   → 201 DocumentOut
//   GET    /patients/{id}/documents/{doc}/content        → the decrypted bytes
//   DELETE /patients/{id}/documents/{doc}                → 204
//
// Two things about the download are load-bearing:
//
//   * There is no URL a browser can follow on its own. The endpoint needs the
//     bearer token, and the object in MinIO is ciphertext — a pre-signed URL
//     would hand the browser bytes it cannot decrypt (ADR-0011). So we fetch
//     with auth, get a Blob, and drive the download from an object URL.
//   * The blob URL must be revoked. It holds PHI in memory for as long as it
//     lives, and a leaked one survives the page.

import { ApiError, apiAt, getAccessToken, tryRefresh } from "./client.js";
import { SERVICES } from "./services.js";

const a = (p, init) => apiAt(SERVICES.core, p, init);

// What the upload form offers. The server enforces the same list — this is
// the labelled copy, in file order.
export const DOCUMENT_CATEGORIES = ["referral", "lab", "imaging", "discharge", "consent", "other"];

// Mirrors ALLOWED_CONTENT_TYPES in core-service routers/patient_documents.py.
// Used for the file picker's `accept` and to fail fast before an upload that
// the server would 415.
export const ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/tiff",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/dicom",
];
export const ACCEPT_ATTR = ".pdf,.jpg,.jpeg,.png,.heic,.tif,.tiff,.txt,.doc,.docx,.dcm";

// MDX_PATIENT_DOCUMENT_MAX_BYTES — kept in sync so the modal can refuse a
// 60 MB scan before spending a minute uploading it.
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

export async function listPatientDocuments(patientId) {
  return a(`/patients/${encodeURIComponent(patientId)}/documents`, { method: "GET" });
}

// `file` is a File/Blob from an <input type=file> or a drop event.
export async function uploadPatientDocument(patientId, { file, category = "other", note = "" }) {
  const fd = new FormData();
  fd.append("file", file, file.name);
  fd.append("category", category);
  if (note) fd.append("note", note);
  // No Content-Type header on purpose: the browser must set the multipart
  // boundary itself, and apiAt() leaves FormData bodies alone.
  return a(`/patients/${encodeURIComponent(patientId)}/documents`, { method: "POST", body: fd });
}

export async function deletePatientDocument(patientId, documentId) {
  return a(
    `/patients/${encodeURIComponent(patientId)}/documents/${encodeURIComponent(documentId)}`,
    { method: "DELETE" },
  );
}

// Fetch the decrypted bytes and hand them to the browser as a download.
// Returns nothing; throws the same ApiError shape as the rest of the client
// on a non-2xx so callers can render it inline.
export async function downloadPatientDocument(patientId, doc) {
  const url =
    `${SERVICES.core}/patients/${encodeURIComponent(patientId)}` +
    `/documents/${encodeURIComponent(doc.id)}/content`;
  const send = () => {
    const token = getAccessToken();
    return fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
    });
  };
  // Raw fetch rather than apiAt(), because the response is bytes and the
  // shared client parses JSON/text. That means re-implementing exactly one
  // thing it does for us: the single silent refresh on an expired token.
  let res = await send();
  if (res.status === 401 && getAccessToken()) {
    try {
      await tryRefresh();
      res = await send();
    } catch { /* fall through to the error below */ }
  }
  if (!res.ok) {
    const problem = await res.json().catch(() => ({ title: `HTTP ${res.status}` }));
    throw new ApiError(res.status, problem);
  }
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = href;
    link.download = doc.filename || "document";
    link.click();
  } finally {
    // The blob holds PHI; do not leave it reachable from the page.
    setTimeout(() => URL.revokeObjectURL(href), 0);
  }
}

// ── display helpers ──────────────────────────────────────────────────────

export function formatBytes(n) {
  const size = Number(n) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

// A per-type glyph, so a list of eight attachments is scannable without
// reading every filename.
export function documentIcon(contentType = "") {
  if (contentType.startsWith("image/")) return "scan";
  if (contentType === "application/pdf") return "fileText";
  if (contentType === "application/dicom") return "activity";
  return "fileText";
}
