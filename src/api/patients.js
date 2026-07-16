// patients.js — clinical/core-service calls for the patient roster and the
// per-patient record (timeline, encounters, consents). Flat REST, same auth
// flow as the other services via apiAt().
//
// Contract pinned S11 step 01 against the as-built core-service (:8003,
// branch S11). Every request model is Pydantic extra="forbid" — unknown keys
// 422 — so bodies are built through the strict pickers below, never by
// spreading caller objects onto the wire.
//
//   GET  /patients?query=&limit=&cursor=   → { items: PatientOut[], next_cursor }
//   POST /patients                          PatientCreate → 201 PatientOut
//   GET  /patients/{id}                     → PatientOut
//   PUT  /patients/{id}                     PatientUpdate → PatientOut
//   GET  /patients/{id}/timeline            → { items: TimelineItem[] }

import { apiAt } from "./client.js";
import { SERVICES } from "./services.js";

const a = (p, init) => apiAt(SERVICES.core, p, init);

/**
 * @typedef {{ uk: string, en: string }} NameI18n
 *
 * @typedef {Object} PatientOut
 * @property {string} id                     UUID
 * @property {NameI18n} name
 * @property {string|null} dob               "YYYY-MM-DD" — lists must never
 *                                           render this; use yearOfBirth()
 * @property {"M"|"F"|"U"} sex
 * @property {string} mrn
 * @property {NameI18n} summary
 * @property {string[]} tags
 * @property {"active"|"inactive"|"deceased"|"erased"} status
 * @property {string|null} last_visit        ISO datetime
 * @property {string} created_at
 * @property {string} updated_at
 * @property {boolean} has_ipn               РНОКПП presence flag — the raw
 *                                           ІПН is NEVER echoed by the API
 *
 * @typedef {Object} TimelineItem
 * @property {string} id
 * @property {"dictate"|"recording"} kind    dictate = report row; recording =
 *                                           encounter-linked audio (metadata
 *                                           only — no media URL by design)
 * @property {string} title
 * @property {string} date                   ISO datetime, newest first
 * @property {string|null} status
 * @property {string|null} by
 * @property {string|null} encounter_id
 * @property {number|null} duration_s
 */

// ── strict wire pickers (unit-tested; extra="forbid" on the server) ──────

// PatientCreate: name is required; ipn is the raw РНОКПП (spaces/dashes ok,
// server validates + HMAC-tokenizes; 422 ipn_invalid, 409 patient_ipn_exists
// with problem.existing_patient_id). Undefined keys are dropped so the wire
// carries exactly what the caller set.
export function patientCreateBody({ name, dob, sex, mrn, summary, tags, ipn } = {}) {
  const b = { name };
  if (dob !== undefined) b.dob = dob;
  if (sex !== undefined) b.sex = sex;
  if (mrn !== undefined) b.mrn = mrn;
  if (summary !== undefined) b.summary = summary;
  if (tags !== undefined) b.tags = tags;
  if (ipn !== undefined) b.ipn = ipn;
  return b;
}

// PatientUpdate: all optional. ipn semantics: undefined = unchanged,
// "" = clear, digits = set. status "erased" is engine-only — the server
// rejects it 422 code=status_immutable_erased (archive = "inactive").
export function patientUpdateBody({ name, dob, sex, mrn, summary, tags, status, ipn } = {}) {
  const b = {};
  if (name !== undefined) b.name = name;
  if (dob !== undefined) b.dob = dob;
  if (sex !== undefined) b.sex = sex;
  if (mrn !== undefined) b.mrn = mrn;
  if (summary !== undefined) b.summary = summary;
  if (tags !== undefined) b.tags = tags;
  if (status !== undefined) b.status = status;
  if (ipn !== undefined) b.ipn = ipn;
  return b;
}

// ── PII-hygiene display primitives (the ONLY derivations lists may use) ──

// Bilingual display name: prefer the UI language, fall back across uk/en.
// Mirrors the backend convention (uk primary, en fallback when uk blank).
export function displayName(patient, lang = "uk") {
  const n = (patient && patient.name) || {};
  const pick = (s) => (typeof s === "string" && s.trim() ? s.trim() : null);
  return pick(n[lang]) || pick(n.uk) || pick(n.en) || "";
}

// Year of birth — the ONLY DOB derivative allowed outside the patient page
// header (lists show "name + year of birth", never the full date).
export function yearOfBirth(patient) {
  const dob = patient && patient.dob;
  if (typeof dob !== "string") return null;
  const m = /^(\d{4})-\d{2}-\d{2}$/.exec(dob.trim());
  return m ? Number(m[1]) : null;
}

// ── client functions ─────────────────────────────────────────────────────

// GET /patients?query=&limit=&cursor= → { items, next_cursor }
// `query` matches name/MRN; a query that IS a valid ІПН auto-dispatches to
// exact HMAC lookup server-side (no separate search endpoint).
// `includeErased` is tenant_admin-only. `init` lets the roster search pass
// { signal } for AbortController cancellation of stale requests.
export async function listPatients({ query, limit = 50, cursor, includeErased } = {}, init = {}) {
  const qs = new URLSearchParams();
  if (query)  qs.set("query", query);
  if (limit)  qs.set("limit", String(limit));
  if (cursor) qs.set("cursor", cursor);
  if (includeErased) qs.set("include_erased", "true");
  const tail = qs.toString() ? `?${qs}` : "";
  return a(`/patients${tail}`, { method: "GET", ...init });
}

// Wire page → the shape useCursorPages() consumes.
export function toPage(r) {
  return { items: (r && r.items) || [], nextCursor: (r && r.next_cursor) || null };
}

// Cursor-page fetcher in the shape useCursorPages() consumes:
//   const pg = useCursorPages(patientsPageFetcher({ query, limit: 25 }), [query]);
export function patientsPageFetcher(params = {}) {
  return (cursor) => listPatients({ ...params, cursor }).then(toPage);
}

export async function getPatient(id) {
  return a(`/patients/${encodeURIComponent(id)}`, { method: "GET" });
}

// POST /patients → 201 PatientOut
export async function createPatient(body) {
  return a(`/patients`, { method: "POST", body: JSON.stringify(patientCreateBody(body)) });
}

// PUT /patients/{id} → PatientOut. Archive = updatePatient(id, { status:
// "inactive" }) — the as-built API has no separate archive route.
export async function updatePatient(id, body) {
  return a(`/patients/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(patientUpdateBody(body)),
  });
}

// GET /patients/{id}/timeline → { items: TimelineItem[] } — dictate report
// rows + encounter-linked recording rows ONLY. Encounters / notes / consents
// are fetched from their own endpoints and merged client-side (the backend
// excludes them here to avoid double-counting).
export async function getPatientTimeline(id) {
  return a(`/patients/${encodeURIComponent(id)}/timeline`, { method: "GET" });
}
