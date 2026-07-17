// encounters.js — clinical encounters and the day's scheduled visit queue.

import { apiAt } from "./client.js";
import { SERVICES } from "./services.js";

const a = (p, init) => apiAt(SERVICES.core, p, init);

// GET /patients/{id}/encounters — chronological encounter history.
export async function listEncounters(patientId) {
  return a(`/patients/${encodeURIComponent(patientId)}/encounters`, { method: "GET" });
}

export async function getEncounter(id) {
  return a(`/encounters/${encodeURIComponent(id)}`, { method: "GET" });
}

// POST /patients/{id}/encounters — body: { kind, datetime?, reason, status? }.
// kind: visit|phone|video|scribe|followup|other; status: scheduled|
// in_progress|completed|cancelled (server default "completed"; anything but
// "scheduled" bumps the patient's last_visit). extra="forbid" — send only
// what the caller set.
export async function createEncounter(patientId, { kind, datetime, reason, status } = {}) {
  const b = { kind, reason };
  if (datetime !== undefined) b.datetime = datetime;
  if (status !== undefined) b.status = status;
  return a(`/patients/${encodeURIComponent(patientId)}/encounters`, {
    method: "POST",
    body: JSON.stringify(b),
  });
}

// GET /schedule?date=YYYY-MM-DD — the clinician's visit queue for a day.
// Omit `date` to let the backend default to today in the tenant's timezone.
export async function listSchedule({ date } = {}) {
  const qs = new URLSearchParams();
  if (date) qs.set("date", date);
  const tail = qs.toString() ? `?${qs}` : "";
  return a(`/schedule${tail}`, { method: "GET" });
}
