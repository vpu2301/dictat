// notes.js — clinical notes (sprint 12) and the note-structure catalogue.
//
// A note is the typed/dictated clinical document (SOAP, APSO, DAP, free…)
// attached to a patient and, optionally, an encounter or scribe session.

import { apiAt } from "./client.js";
import { SERVICES } from "./services.js";

const a = (p, init) => apiAt(SERVICES.core, p, init);

// GET /notes?patient_id=&status=&limit=&cursor= — cross-patient feed or,
// with patient_id, a single patient's notes.
export async function listNotes({ patient_id, status, limit = 50, cursor } = {}) {
  const qs = new URLSearchParams();
  if (patient_id) qs.set("patient_id", patient_id);
  if (status)     qs.set("status", status);
  if (limit)      qs.set("limit", String(limit));
  if (cursor)     qs.set("cursor", cursor);
  const tail = qs.toString() ? `?${qs}` : "";
  return a(`/notes${tail}`, { method: "GET" });
}

export async function getNote(id) {
  return a(`/notes/${encodeURIComponent(id)}`, { method: "GET" });
}

// body: { patient_id, encounter_id?, structure, title, sections }
export async function createNote(body) {
  return a(`/notes`, { method: "POST", body: JSON.stringify(body) });
}

export async function updateNote(id, patch) {
  return a(`/notes/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export async function signNote(id) {
  return a(`/notes/${encodeURIComponent(id)}/sign`, { method: "POST" });
}

// GET /note-structures — available note structures (SOAP, APSO, …) with
// their section scaffolding. Replaces the old hard-coded template list.
export async function listNoteStructures() {
  return a(`/note-structures`, { method: "GET" });
}
