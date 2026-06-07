// anamnesis.js — structured patient history (sprint 13): chief complaint, HPI,
// medications, allergies, conditions, review-of-systems, social/family history.

import { apiAt } from "./client.js";
import { SERVICES } from "./services.js";

const a = (p, init) => apiAt(SERVICES.core, p, init);

export async function getAnamnesis(patientId) {
  return a(`/patients/${encodeURIComponent(patientId)}/anamnesis`, { method: "GET" });
}

// Full replace of the structured record.
export async function updateAnamnesis(patientId, record) {
  return a(`/patients/${encodeURIComponent(patientId)}/anamnesis`, {
    method: "PUT",
    body: JSON.stringify(record),
  });
}
