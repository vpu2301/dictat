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
 * @property {string} phone                  normalized "+380671234567", "" when unset
 * @property {string} email                  normalized lower-case, "" when unset
 * @property {PatientAddress} address        components, each "" when unset
 *
 * @typedef {Object} PatientAddress
 * @property {string} street
 * @property {string} house                  building + apartment ("12, кв. 5")
 * @property {string} zip
 * @property {string} city
 * @property {string} country
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
export function patientCreateBody({ name, dob, sex, mrn, phone, email, address, summary, tags, ipn } = {}) {
  const b = { name };
  if (dob !== undefined) b.dob = dob;
  if (sex !== undefined) b.sex = sex;
  if (mrn !== undefined) b.mrn = mrn;
  if (phone !== undefined) b.phone = phone;
  if (email !== undefined) b.email = email;
  // Re-shaped rather than passed through: Address is extra="forbid" too, so a
  // stray key on a caller's object would 422 the whole request.
  if (address !== undefined) b.address = addressBody(address);
  if (summary !== undefined) b.summary = summary;
  if (tags !== undefined) b.tags = tags;
  if (ipn !== undefined) b.ipn = ipn;
  return b;
}

// PatientUpdate: all optional. ipn semantics: undefined = unchanged,
// "" = clear, digits = set. The contact fields follow the same convention
// (absent = unchanged, "" = clear). status "erased" is engine-only — the
// server rejects it 422 code=status_immutable_erased (archive = "inactive").
export function patientUpdateBody({ name, dob, sex, mrn, phone, email, address, summary, tags, status, ipn } = {}) {
  const b = {};
  if (name !== undefined) b.name = name;
  if (dob !== undefined) b.dob = dob;
  if (sex !== undefined) b.sex = sex;
  if (mrn !== undefined) b.mrn = mrn;
  if (phone !== undefined) b.phone = phone;
  if (email !== undefined) b.email = email;
  // An address object REPLACES all five columns server-side — a blank
  // component clears it. That is how the form removes a house number.
  if (address !== undefined) b.address = addressBody(address);
  if (summary !== undefined) b.summary = summary;
  if (tags !== undefined) b.tags = tags;
  if (status !== undefined) b.status = status;
  if (ipn !== undefined) b.ipn = ipn;
  return b;
}

// ── Contact fields (phone / e-mail / address) ────────────────────────────
// Mirrors the server so a typo becomes an inline hint instead of a round-trip
// 422: core-service routers/patients.py caps each field at these lengths and
// runs _clean_phone() / _clean_email() (normalize, then a shape check that
// answers 422 code=phone_invalid / email_invalid). The server stays the
// authority — this is only the fast path.
export const CONTACT_LIMITS = {
  phone: 32,
  email: 254,
  street: 200,
  house: 32,
  zip: 20,
  city: 120,
  country: 120,
};

// The address components, in the order the form and the display string use
// them. Iterating this (rather than five hand-written branches) keeps the
// form, the wire picker, and the formatter from drifting apart.
export const ADDRESS_FIELDS = ["street", "house", "zip", "city", "country"];

export function emptyAddress() {
  return { street: "", house: "", zip: "", city: "", country: "" };
}

// Wire-shape address from whatever the caller holds (a PatientOut's address,
// a half-filled form, or nothing). Always all five keys, always strings — the
// server's model is extra="forbid", so an unknown key would 422.
export function addressBody(raw) {
  const a = raw || {};
  const out = {};
  for (const k of ADDRESS_FIELDS) out[k] = String(a[k] ?? "").trim();
  return out;
}

export function hasAddress(raw) {
  const a = addressBody(raw);
  return ADDRESS_FIELDS.some((k) => a[k]);
}

// Single-line address for cards and headers: "вул. Шевченка, 12, кв. 5,
// 01001 Київ, Україна". Blank components collapse rather than leaving stray
// commas, so a half-captured address still reads correctly.
export function formatAddress(raw) {
  const a = addressBody(raw);
  const street = [a.street, a.house].filter(Boolean).join(", ");
  const locality = [a.zip, a.city].filter(Boolean).join(" ");
  return [street, locality, a.country].filter(Boolean).join(", ");
}

export function normalizeEmail(raw) {
  return String(raw ?? "").trim().toLowerCase();
}

// Deliberately the server's loose rule (local@domain.tld, no whitespace), not
// a strict RFC regex — those reject addresses that deliver fine.
export function isEmailShapeValid(raw) {
  const email = normalizeEmail(raw);
  if (!email) return true;                       // optional — blank is valid
  const at = email.indexOf("@");
  const local = at < 0 ? "" : email.slice(0, at);
  const domain = at < 0 ? "" : email.slice(at + 1);
  if (!local || !domain || !domain.includes(".")) return false;
  return !/\s/.test(email);
}

// ── Telephone ────────────────────────────────────────────────────────────
// Mirrors _clean_phone(): strip the separators a human types, keep an
// optional leading "+", and require 7–15 digits (the E.164 range). Sent
// normalized so the stored value is directly dialable — `tel:` links and any
// future SMS gateway read the column as-is.
const PHONE_SEPARATORS = /[\s()\-–—./]+/g;

export function normalizePhone(raw) {
  const phone = String(raw ?? "").trim();
  if (!phone) return "";
  const plus = phone.startsWith("+");
  const digits = (plus ? phone.slice(1) : phone).replace(PHONE_SEPARATORS, "");
  return plus ? `+${digits}` : digits;
}

// Not a per-country pattern on purpose: a border clinic records Polish and
// Moldovan numbers too, and a stricter rule would reject numbers that dial.
export function isPhoneShapeValid(raw) {
  const phone = normalizePhone(raw);
  if (!phone) return true;                       // optional — blank is valid
  return /^\+?\d{7,15}$/.test(phone);
}

// Does the patient carry any contact detail at all? (drives the "no contact
// details" hint on the record card).
export function hasContact(patient) {
  const p = patient || {};
  return !!(String(p.phone || "").trim() || String(p.email || "").trim() || hasAddress(p.address));
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

// POST /patients/import → PatientImportResult.
//
// Bulk roster import. The server answers PER ROW rather than failing the
// whole file, because a clinic's spreadsheet is never uniformly clean:
//   { dry_run, total, created, skipped, failed,
//     rows: [{ index, status: "created"|"valid"|"skipped"|"failed",
//              patient_id?, code?, message?, existing_patient_id? }] }
// `index` is positional against the items sent, so the preview table can
// point at the line that failed.
//
// dryRun runs the same validation and duplicate lookups and writes nothing —
// that is what the modal's preview step calls. onDuplicate decides only how
// an already-registered MRN/ІПН is REPORTED ("skip" → skipped, "fail" →
// failed); neither value ever overwrites the record already on file.
export async function importPatients({ items, dryRun = false, onDuplicate = "skip" } = {}) {
  const body = {
    items: (items || []).map(patientCreateBody),
    dry_run: !!dryRun,
    on_duplicate: onDuplicate,
  };
  return a(`/patients/import`, { method: "POST", body: JSON.stringify(body) });
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
