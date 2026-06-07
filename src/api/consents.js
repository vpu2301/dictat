// consents.js — AI-scribe consent records per patient (sprint 14).
//
// Consent is required before any recording starts. The backend stamps the
// actor, method (verbal/written/kiosk), version of the consent text shown,
// and links it to the encounter.

import { apiAt } from "./client.js";
import { SERVICES } from "./services.js";

const a = (p, init) => apiAt(SERVICES.core, p, init);

export async function listConsents(patientId) {
  return a(`/patients/${encodeURIComponent(patientId)}/consents`, { method: "GET" });
}

// POST /patients/{id}/consents
// body: { type, method, version, encounter_id, status }
export async function recordConsent(patientId, { type = "ai_scribe", method, version, encounter_id, status = "granted" }) {
  return a(`/patients/${encodeURIComponent(patientId)}/consents`, {
    method: "POST",
    body: JSON.stringify({ type, method, version, encounter_id, status }),
  });
}

export async function withdrawConsent(patientId, consentId) {
  return a(
    `/patients/${encodeURIComponent(patientId)}/consents/${encodeURIComponent(consentId)}/withdraw`,
    { method: "POST" }
  );
}
