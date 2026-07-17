// consents.js — AI-scribe consent records per patient.
//
// Consent is required before any recording starts. The backend stamps the
// actor (created_by from the token), links the encounter, and — for
// method "digital" — returns a signing hint for the S09 signing dialog.
// Contract re-pinned S11 step 01 against the as-built core-service.
//
// ConsentOut: { id, patient_id, encounter_id, type, method, version, status,
//   granted_at, withdrawn_at, signed_envelope_id }. The 201 create response
// additionally carries `signing` — null unless method === "digital", else
// { resource_type: "consent", resource_id, resource_version_id,
//   canonical_hash_hex } (422 code=consent_text_version_unknown when the
// (type, version) pair has no approved consent text).

import { apiAt } from "./client.js";
import { SERVICES } from "./services.js";

const a = (p, init) => apiAt(SERVICES.core, p, init);

export async function listConsents(patientId) {
  return a(`/patients/${encodeURIComponent(patientId)}/consents`, { method: "GET" });
}

// POST /patients/{id}/consents → 201. Conventional values: type "ai_scribe",
// method "verbal" | "digital", status "granted". extra="forbid" — only the
// keys below may go on the wire; encounter_id is dropped when unset.
export async function recordConsent(patientId, { type = "ai_scribe", method, version, encounter_id, status = "granted" }) {
  const b = { type, method, version, status };
  if (encounter_id !== undefined && encounter_id !== null) b.encounter_id = encounter_id;
  return a(`/patients/${encodeURIComponent(patientId)}/consents`, {
    method: "POST",
    body: JSON.stringify(b),
  });
}

// POST /patients/{pid}/consents/{cid}/sign → sign a method="digital"
// consent via the S09 signing stack (core-service proxies to
// signing-service with resource_type="consent").
//   provider "file_key"     → { key_container_b64, key_password } → 200
//   provider "dev_password" → { password } (dev-only scaffold)   → 200
//   provider "diia"         → 202 signing-session JSON (QR flow)
// 200 = ConsentSignedResponse { consent, envelope_id, signature_level,
// verification_token, signed_at, signer_full_name, is_qualified }.
// Errors: 422 consent_not_digital, 409 consent_already_signed,
// 409 consent_canonical_changed (re-capture), 400 missing_credentials.
export async function signConsent(patientId, consentId, { provider, key_container_b64, key_password, password }) {
  const b = { provider };
  if (key_container_b64 !== undefined) b.key_container_b64 = key_container_b64;
  if (key_password !== undefined) b.key_password = key_password;
  if (password !== undefined) b.password = password;
  return a(
    `/patients/${encodeURIComponent(patientId)}/consents/${encodeURIComponent(consentId)}/sign`,
    { method: "POST", body: JSON.stringify(b) }
  );
}

// POST /patients/{pid}/consents/{cid}/withdraw → 200 ConsentOut (status
// "withdrawn", withdrawn_at stamped). The nested path is the as-built one —
// there is no top-level /consents/{id}/withdraw. Withdrawing a signed
// consent keeps signed_envelope_id: both facts are retained.
export async function withdrawConsent(patientId, consentId) {
  return a(
    `/patients/${encodeURIComponent(patientId)}/consents/${encodeURIComponent(consentId)}/withdraw`,
    { method: "POST" }
  );
}
