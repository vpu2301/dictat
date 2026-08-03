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

// NoteCreate is Pydantic extra="forbid" and `patient_id` is REQUIRED — a
// note with no patient is not a note the server will take. `sections` is a
// LIST of {key, content} (see src/notes/noteShape.js for the conversion),
// and `structure` is the lowercase enum soap|apso|dap|free. Everything
// crossing this boundary goes through the pickers so a stray editor key
// (or an uppercase "SOAP") cannot 422 the save.
export function noteCreateBody({ patient_id, encounter_id, structure, title, sections, source_session_id } = {}) {
  const b = { patient_id };
  if (encounter_id !== undefined) b.encounter_id = encounter_id;
  if (structure !== undefined) b.structure = structure;
  if (title !== undefined) b.title = title;
  if (sections !== undefined) b.sections = sections;
  if (source_session_id !== undefined) b.source_session_id = source_session_id;
  return b;
}

// NotePatch: title / structure / sections, all optional. patient_id is NOT
// patchable — a note does not move between patients.
export function notePatchBody({ title, structure, sections } = {}) {
  const b = {};
  if (title !== undefined) b.title = title;
  if (structure !== undefined) b.structure = structure;
  if (sections !== undefined) b.sections = sections;
  return b;
}

export async function createNote(body) {
  return a(`/notes`, { method: "POST", body: JSON.stringify(noteCreateBody(body)) });
}

export async function updateNote(id, patch) {
  return a(`/notes/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(notePatchBody(patch)),
  });
}

export async function signNote(id) {
  return a(`/notes/${encodeURIComponent(id)}/sign`, { method: "POST" });
}

// GET /note-structures — available note structures (SOAP, APSO, …) with
// their section scaffolding. Replaces the old hard-coded template list.
export async function listNoteStructures() {
  return a(`/note-structures`, { method: "GET" });
}
