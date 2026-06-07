// patients.js — clinical/core-service calls for the patient roster and the
// per-patient record (timeline, encounters, consents). Flat REST, same auth
// flow as the other services via apiAt().

import { apiAt } from "./client.js";
import { SERVICES } from "./services.js";

const a = (p, init) => apiAt(SERVICES.core, p, init);

// GET /patients?query=&limit=&cursor=
// Returns the backend payload as-is. Callers should accept either a bare
// array or { items, next_cursor }.
export async function listPatients({ query, limit = 50, cursor } = {}) {
  const qs = new URLSearchParams();
  if (query)  qs.set("query", query);
  if (limit)  qs.set("limit", String(limit));
  if (cursor) qs.set("cursor", cursor);
  const tail = qs.toString() ? `?${qs}` : "";
  return a(`/patients${tail}`, { method: "GET" });
}

export async function getPatient(id) {
  return a(`/patients/${encodeURIComponent(id)}`, { method: "GET" });
}

// POST /patients — body: { name, dob, sex, mrn, summary?, tags? }
export async function createPatient(body) {
  return a(`/patients`, { method: "POST", body: JSON.stringify(body) });
}

// Mixed clinical timeline (scribe consults + dictate reports + notes).
export async function getPatientTimeline(id) {
  return a(`/patients/${encodeURIComponent(id)}/timeline`, { method: "GET" });
}
