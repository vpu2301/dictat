// Sprint 11 step 01 — gated contract smoke against the LIVE local backend.
//
// Proves the FE's pinned patient wire shapes match the as-built core-service
// (branch S11), not the sprint doc's sketch. Skipped unless
// RUN_BACKEND_INTEGRATION=1 (needs `make dev-up && make migrate-up && make
// seed && make run-auth-service` plus core-service on :8003 in
// ~/Desktop/dictate/medical-dictation-backend).
//
//   npm run verify:patients-contract
import { test } from "node:test";
import assert from "node:assert/strict";

const GATED = process.env.RUN_BACKEND_INTEGRATION === "1";
const AUTH = process.env.VITE_AUTH_SERVICE_URL || "http://localhost:8000";
const CORE = process.env.VITE_CORE_SERVICE_URL || process.env.VITE_CORE_URL || "http://localhost:8003";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Exact PatientOut key set (response model is strict too — a new key here
// means the contract moved and the typedef in patients.js must follow).
const PATIENT_KEYS = [
  "id", "name", "dob", "sex", "mrn", "summary", "tags",
  "phone", "email", "address",
  "status", "last_visit", "created_at", "updated_at", "has_ipn",
];
// The address is an object of its own (migration 0060), strict like every
// other model — these five components and nothing else.
const ADDRESS_KEYS = ["street", "house", "zip", "city", "country"];

async function login() {
  const r = await fetch(`${AUTH}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "clinician@tenant-a.example", password: "dev-password" }),
  });
  assert.equal(r.status, 200, `auth login failed: ${r.status}`);
  return (await r.json()).access_token;
}

const authed = (token, init = {}) => ({
  ...init,
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) },
});

test("patient lifecycle: create → list finds it via query= → empty timeline → archive", { skip: !GATED }, async () => {
  const token = await login();
  const mrn = `S11-SMOKE-${Date.now()}`;

  // create — bilingual name, full PatientCreate surface
  const cr = await fetch(`${CORE}/patients`, authed(token, {
    method: "POST",
    body: JSON.stringify({
      name: { uk: "Смоук Контракт", en: "Smoke Contract" },
      dob: "1990-01-02", sex: "U", mrn,
      summary: { uk: "смоук", en: "smoke" }, tags: ["s11-smoke"],
    }),
  }));
  assert.equal(cr.status, 201);
  const created = await cr.json();
  assert.deepEqual(Object.keys(created).sort(), [...PATIENT_KEYS].sort(), "PatientOut key set");
  assert.match(created.id, UUID_RE);
  assert.equal(created.status, "active");
  assert.equal(created.has_ipn, false, "no ipn sent → has_ipn false, raw ІПН never echoed");
  // Contact details omitted on the way in come back blank, never null — the
  // address is always an object, so no caller has to branch on its absence.
  assert.equal(created.phone, "");
  assert.equal(created.email, "");
  assert.deepEqual(Object.keys(created.address).sort(), [...ADDRESS_KEYS].sort(), "Address shape");
  assert.deepEqual(Object.values(created.address), ["", "", "", "", ""]);

  // list — server-side query finds it; cursor page shape
  const lr = await fetch(`${CORE}/patients?query=${encodeURIComponent(mrn)}&limit=5`, authed(token));
  assert.equal(lr.status, 200);
  const page = await lr.json();
  assert.deepEqual(Object.keys(page).sort(), ["items", "next_cursor"], "PatientList shape");
  assert.ok(page.items.some((p) => p.id === created.id), "query= finds the new patient");
  for (const p of page.items) {
    assert.deepEqual(Object.keys(p).sort(), [...PATIENT_KEYS].sort());
  }

  // timeline — reports+recordings only; brand-new patient ⇒ empty
  const tr = await fetch(`${CORE}/patients/${created.id}/timeline`, authed(token));
  assert.equal(tr.status, 200);
  assert.deepEqual(await tr.json(), { items: [] }, "new patient has an empty timeline");

  // strictness — unknown top-level key is rejected, not ignored
  const xr = await fetch(`${CORE}/patients/${created.id}`, authed(token, {
    method: "PUT", body: JSON.stringify({ surprise: 1 }),
  }));
  assert.equal(xr.status, 422, 'extra="forbid" is real');

  // archive = PUT status inactive (no separate archive route)
  const ar = await fetch(`${CORE}/patients/${created.id}`, authed(token, {
    method: "PUT", body: JSON.stringify({ status: "inactive" }),
  }));
  assert.equal(ar.status, 200);
  assert.equal((await ar.json()).status, "inactive");
});

// Contact details (migration 0060): the FE's own validators mirror the
// server's, so this pins BOTH sides — what the server normalizes and what it
// refuses. A drift here means the inline hints in the patient form started
// lying about what would be accepted.
test("contact details: phone/e-mail normalize server-side, address round-trips by component", { skip: !GATED }, async () => {
  const token = await login();

  const cr = await fetch(`${CORE}/patients`, authed(token, {
    method: "POST",
    body: JSON.stringify({
      name: { uk: "Смоук Контакти", en: "Smoke Contacts" },
      mrn: `S11-SMOKE-K-${Date.now()}`,
      phone: "+380 (67) 123-45-67",
      email: "  Smoke@Example.COM ",
      address: {
        street: " вул. Хрещатик ", house: "1, кв. 5",
        zip: "01001", city: "Київ", country: "Україна",
      },
    }),
  }));
  assert.equal(cr.status, 201);
  const created = await cr.json();
  assert.equal(created.phone, "+380671234567", "separators stripped — stored dialable");
  assert.equal(created.email, "smoke@example.com", "trimmed + lower-cased");
  assert.deepEqual(created.address, {
    street: "вул. Хрещатик", house: "1, кв. 5",
    zip: "01001", city: "Київ", country: "Україна",
  });

  // A number that cannot be dialled is refused with the branch code the form
  // relies on — same rule as isPhoneShapeValid() in patients.js.
  const bad = await fetch(`${CORE}/patients`, authed(token, {
    method: "POST", body: JSON.stringify({ name: { uk: "Bad" }, phone: "call me" }),
  }));
  assert.equal(bad.status, 422);
  assert.equal((await bad.json()).code, "phone_invalid");

  // An unknown address component is rejected, not ignored — the picker in
  // patients.js rebuilds the object for exactly this reason.
  const xr = await fetch(`${CORE}/patients`, authed(token, {
    method: "POST", body: JSON.stringify({ name: { uk: "Bad" }, address: { region: "Київська" } }),
  }));
  assert.equal(xr.status, 422, 'Address is extra="forbid" too');

  // An address object replaces all five columns: the ones left blank clear.
  const ur = await fetch(`${CORE}/patients/${created.id}`, authed(token, {
    method: "PUT", body: JSON.stringify({ address: { city: "Львів", country: "Україна" } }),
  }));
  assert.equal(ur.status, 200);
  const updated = await ur.json();
  assert.deepEqual(updated.address,
    { street: "", house: "", zip: "", city: "Львів", country: "Україна" });
  assert.equal(updated.phone, "+380671234567", "an address-only update leaves the phone alone");

  // hygiene: archive the smoke patient
  await fetch(`${CORE}/patients/${created.id}`, authed(token, {
    method: "PUT", body: JSON.stringify({ status: "inactive" }),
  }));
});

test("consent lifecycle on an encounter: grant verbal → withdraw via the NESTED path", { skip: !GATED }, async () => {
  const token = await login();
  const cr = await fetch(`${CORE}/patients`, authed(token, {
    method: "POST",
    body: JSON.stringify({ name: { uk: "Смоук Згода", en: "Smoke Consent" }, mrn: `S11-SMOKE-C-${Date.now()}` }),
  }));
  assert.equal(cr.status, 201);
  const patient = await cr.json();

  const er = await fetch(`${CORE}/patients/${patient.id}/encounters`, authed(token, {
    method: "POST", body: JSON.stringify({ kind: "visit", reason: "smoke", status: "in_progress" }),
  }));
  assert.equal(er.status, 201);
  const encounter = await er.json();

  const gr = await fetch(`${CORE}/patients/${patient.id}/consents`, authed(token, {
    method: "POST",
    body: JSON.stringify({ type: "ai_scribe", method: "verbal", version: "", encounter_id: encounter.id }),
  }));
  assert.equal(gr.status, 201);
  const consent = await gr.json();
  assert.equal(consent.status, "granted");
  assert.equal(consent.signing, null, "no signing hint for non-digital methods");

  const wr = await fetch(`${CORE}/patients/${patient.id}/consents/${consent.id}/withdraw`,
    authed(token, { method: "POST" }));
  assert.equal(wr.status, 200, "withdraw lives at the nested path");
  const withdrawn = await wr.json();
  assert.equal(withdrawn.status, "withdrawn");
  assert.ok(withdrawn.withdrawn_at, "withdrawn_at stamped");

  // hygiene: archive the smoke patient
  await fetch(`${CORE}/patients/${patient.id}`, authed(token, {
    method: "PUT", body: JSON.stringify({ status: "inactive" }),
  }));
});
