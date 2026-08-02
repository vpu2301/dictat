// Sprint 11 step 01 — REAL-response fixtures for the core-service patient
// contract.
//
// Provenance: captured 2026-07-15 from the live local backend (core-service
// branch `S11` on :8003, auth-service on :8000, seeded dev actors). These are
// canonical wire shapes for tests/mocks — the app itself never imports them
// (no mock data in app code). Field names are the wire's snake_case, passed
// through unchanged by src/api/patients.js.
//
// Reproduce with:
//
//   TOK=$(curl -s -X POST http://localhost:8000/auth/login \
//     -H 'Content-Type: application/json' \
//     -d '{"email":"clinician@tenant-a.example","password":"dev-password"}' \
//     | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
//   curl -s -X POST http://localhost:8003/patients \
//     -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' \
//     -d '{"name":{"uk":"Тест Пацієнт-С11","en":"Test Patient-S11"},
//          "dob":"1984-03-12","sex":"F","mrn":"S11-FIX-001",
//          "summary":{"uk":"фікстура контракту","en":"contract fixture"},
//          "tags":["fixture"],"ipn":"1759013776"}'
//
// DSAR was captured as admin@tenant-a.example (scope patient.dsar); the
// erasure request was then rejected by the admin (two-person workflow) so
// the dev DB carries no pending erasure.

// POST /patients → 201. Note: `ipn` went IN, only `has_ipn` comes OUT —
// the raw РНОКПП is never echoed by any endpoint.
//
// phone/email/address (migration 0060) are absent from the capture body
// above, so they come back as the server default — "" for the phone and the
// e-mail, and an address object with every component blank. That IS the wire
// shape for a patient registered without contact details: `address` is always
// an object, never null and never a string.
export const PATIENT_CREATED = {
  id: "cca2c827-3a14-486b-a48c-a599c8b8bb74",
  name: { uk: "Тест Пацієнт-С11", en: "Test Patient-S11" },
  dob: "1984-03-12",
  sex: "F",
  mrn: "S11-FIX-001",
  phone: "",
  email: "",
  address: { street: "", house: "", zip: "", city: "", country: "" },
  summary: { uk: "фікстура контракту", en: "contract fixture" },
  tags: ["fixture"],
  status: "active",
  last_visit: null,
  created_at: "2026-07-15T20:28:48.163350Z",
  updated_at: "2026-07-15T20:28:48.163350Z",
  has_ipn: true,
};

// POST /patients → 201 WITH contact details. Captured 2026-08-02 from the
// same local backend (core-service on :8003) after migration 0060, request
// body:
//
//   {"name":{"uk":"Контакт Тест","en":"Contact Test"},"sex":"F",
//    "phone":"+380 (67) 123-45-67","email":"Contact@Example.COM",
//    "address":{"street":"вул. Хрещатик","house":"1, кв. 5",
//               "zip":"01001","city":"Київ","country":"Україна"}}
//
// Note what the server normalized: the phone lost its separators (stored
// dialable, _clean_phone) and the e-mail was case-folded. A number the shape
// check rejects never gets this far — it answers 422 code=phone_invalid.
export const PATIENT_WITH_CONTACT = {
  id: "21c114c9-8195-4a2a-accc-288f54ff2371",
  name: { uk: "Контакт Тест", en: "Contact Test" },
  dob: null,
  sex: "F",
  mrn: "",
  phone: "+380671234567",
  email: "contact@example.com",
  address: {
    street: "вул. Хрещатик",
    house: "1, кв. 5",
    zip: "01001",
    city: "Київ",
    country: "Україна",
  },
  summary: { uk: "", en: "" },
  tags: [],
  status: "active",
  last_visit: null,
  created_at: "2026-08-02T07:21:09.816004Z",
  updated_at: "2026-08-02T07:21:09.816004Z",
  has_ipn: false,
};

// GET /patients?query=С1&limit=5 → 200. Same page shape for an ІПН query
// ("?query=1759013776" auto-dispatches to exact HMAC lookup server-side).
export const PATIENT_LIST_PAGE = {
  items: [PATIENT_CREATED],
  next_cursor: null,
};

// PUT /patients/{id} {"status":"inactive"} → 200 — this IS the archive
// operation (no separate route).
export const PATIENT_ARCHIVED = {
  ...PATIENT_CREATED,
  tags: ["fixture", "updated"],
  status: "inactive",
  updated_at: "2026-07-15T20:29:04.876459Z",
};

// PUT /patients/{id} {"status":"erased"} → 422 problem+json. `code` is the
// machine branch key (RFC 9457 extension member), `instance` the audit
// correlation id.
export const PATIENT_ERASED_STATUS_REJECTED = {
  type: "about:blank",
  title: "Unprocessable Content",
  status: 422,
  detail: "the erased status is set only by the erasure engine",
  instance: "urn:uuid:3dbc1805-8c26-4fe3-80c1-c05ebbacfaa1",
  code: "status_immutable_erased",
};

// GET /patients/{id}/timeline → 200 for a patient with no reports and no
// encounter-linked recordings. Encounters/notes/consents are NOT in here —
// the SPA merges them from their own endpoints.
export const TIMELINE_EMPTY = { items: [] };

// POST /patients/{id}/encounters {"kind":"visit","reason":"планова
// консультація","status":"in_progress"} → 201.
export const ENCOUNTER_CREATED = {
  id: "a61bd2b8-2f02-4fa4-9f0b-348279a2a704",
  patient_id: "cca2c827-3a14-486b-a48c-a599c8b8bb74",
  kind: "visit",
  reason: "планова консультація",
  occurred_at: "2026-07-15T20:29:25.707816Z",
  status: "in_progress",
  created_at: "2026-07-15T20:29:25.707786Z",
};

// POST /patients/{id}/consents (method "verbal") → 201. `signing` is null
// for non-digital methods; for method "digital" it carries the
// {resource_type:"consent", resource_id, resource_version_id,
// canonical_hash_hex} hint consumed by the S09 signing dialog (step 05).
export const CONSENT_GRANTED_VERBAL = {
  id: "10ad83b1-edd0-4600-a125-d9067be4f409",
  patient_id: "cca2c827-3a14-486b-a48c-a599c8b8bb74",
  encounter_id: "a61bd2b8-2f02-4fa4-9f0b-348279a2a704",
  type: "ai_scribe",
  method: "verbal",
  version: "",
  status: "granted",
  granted_at: "2026-07-15T20:29:43.600521Z",
  withdrawn_at: null,
  signed_envelope_id: null,
  signing: null,
};

// POST /patients/{pid}/consents/{cid}/withdraw → 200 (nested path — there is
// no top-level /consents/{id}/withdraw). No `signing` key on this response.
export const CONSENT_WITHDRAWN = {
  id: "10ad83b1-edd0-4600-a125-d9067be4f409",
  patient_id: "cca2c827-3a14-486b-a48c-a599c8b8bb74",
  encounter_id: "a61bd2b8-2f02-4fa4-9f0b-348279a2a704",
  type: "ai_scribe",
  method: "verbal",
  version: "",
  status: "withdrawn",
  granted_at: "2026-07-15T20:29:43.600521Z",
  withdrawn_at: "2026-07-15T20:29:43.660910Z",
  signed_envelope_id: null,
};

// POST /patients/{id}/dsar → 202 (not 201 — the export job starts
// immediately, status arrives already "executing"). Requires scope
// patient.dsar (tenant_admin).
export const DSAR_ACCEPTED = {
  id: "c534a58c-2f29-495f-9627-654a2c0b3241",
  patient_id: "cca2c827-3a14-486b-a48c-a599c8b8bb74",
  kind: "dsar",
  reason: "contract fixture DSAR",
  status: "executing",
  requested_by: "0a000000-0000-0000-0000-00000000000a",
  requested_at: "2026-07-15T20:29:43.886940Z",
  scheduled_for: null,
  reviewed_by: null,
  reviewed_at: null,
  rejection_reason: null,
  completed_at: null,
};

// POST /patients/{id}/erasure → 201, status "requested". scheduled_for stays
// null until a SECOND person with privacy.approve approves (grace window is
// set at approval time, not request time).
export const ERASURE_REQUESTED = {
  id: "3ab77d8f-29d0-4935-95e3-8ed18b50a9dd",
  patient_id: "cca2c827-3a14-486b-a48c-a599c8b8bb74",
  kind: "erasure",
  reason: "contract fixture erasure request — will be rejected",
  status: "requested",
  requested_by: "0c000000-0000-0000-0000-00000000000a",
  requested_at: "2026-07-15T20:29:43.924660Z",
  scheduled_for: null,
  reviewed_by: null,
  reviewed_at: null,
  rejection_reason: null,
  completed_at: null,
};

// POST /privacy-requests/{id}/reject (as admin ≠ requester) → 200.
export const ERASURE_REJECTED = {
  ...ERASURE_REQUESTED,
  status: "rejected",
  reviewed_by: "0a000000-0000-0000-0000-00000000000a",
  reviewed_at: "2026-07-15T20:30:17.954796Z",
  rejection_reason: "fixture-capture request, not a real erasure",
};
