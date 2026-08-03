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

test("bulk import: dry run decides, the real run writes, a re-upload is skipped", { skip: !GATED }, async () => {
  const token = await login();
  const stamp = Date.now();
  const items = [
    { name: { uk: "Імпорт Контракт", en: "Import Contract" }, dob: "1980-01-15", sex: "M",
      mrn: `S11-IMPORT-${stamp}-1`, phone: "+380671112233", email: "import@example.com",
      address: { street: "вул. Тестова", house: "1", zip: "01001", city: "Київ", country: "Україна" },
      tags: ["contract-smoke"] },
    { name: { uk: "Імпорт Контракт 2", en: "Import Contract 2" }, sex: "F", mrn: `S11-IMPORT-${stamp}-2` },
  ];
  const post = (body) => fetch(`${CORE}/patients/import`, authed(token, {
    method: "POST", body: JSON.stringify(body),
  }));

  // The preview the modal shows: same decisions, nothing written.
  const dry = await post({ items, dry_run: true });
  assert.equal(dry.status, 200);
  const preview = await dry.json();
  assert.deepEqual(Object.keys(preview).sort(),
    ["created", "dry_run", "failed", "rows", "skipped", "total"], "PatientImportResult key set");
  assert.deepEqual(Object.keys(preview.rows[0]).sort(),
    ["code", "existing_patient_id", "index", "message", "patient_id", "status"], "row key set");
  assert.equal(preview.created, 0);
  assert.deepEqual(preview.rows.map((r) => r.status), ["valid", "valid"]);

  // The real run.
  const real = await (await post({ items })).json();
  assert.equal(real.created, 2, JSON.stringify(real));
  assert.equal(real.failed, 0);
  const [first] = real.rows;
  assert.equal(first.status, "created");
  assert.match(first.patient_id, UUID_RE);

  // Contact details survive the batch path exactly as the single create
  // normalizes them.
  const one = await (await fetch(`${CORE}/patients/${first.patient_id}`, authed(token))).json();
  assert.equal(one.phone, "+380671112233");
  assert.equal(one.email, "import@example.com");
  assert.equal(one.address.city, "Київ");

  // Re-uploading the same file is the thing a clinic actually does: it must
  // report duplicates, not create twins.
  const again = await (await post({ items })).json();
  assert.equal(again.created, 0);
  assert.equal(again.skipped, 2);
  assert.equal(again.rows[0].code, "mrn_exists");
  assert.equal(again.rows[0].existing_patient_id, first.patient_id);

  // …and "fail" reports the same duplicate as an error instead.
  const strict = await (await post({ items, on_duplicate: "fail" })).json();
  assert.equal(strict.failed, 2);
  assert.equal(strict.skipped, 0);

  // Archive the smoke rows so the roster stays readable.
  for (const row of real.rows) {
    await fetch(`${CORE}/patients/${row.patient_id}`, authed(token, {
      method: "PUT", body: JSON.stringify({ status: "inactive" }),
    }));
  }
});

test("patient documents: upload → list → download the exact bytes → delete", { skip: !GATED }, async () => {
  const token = await login();
  // A patient of our own, so the smoke never attaches files to a real record.
  const patient = await (await fetch(`${CORE}/patients`, authed(token, {
    method: "POST",
    body: JSON.stringify({
      name: { uk: "Смоук Документи", en: "Smoke Documents" },
      sex: "U", mrn: `S11-DOC-${Date.now()}`,
    }),
  }))).json();

  const bytes = `%PDF-1.4 contract smoke ${Date.now()}\n`;
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "application/pdf" }), "Скерування.pdf");
  form.append("category", "referral");
  form.append("note", "контрактний смоук");
  const up = await fetch(`${CORE}/patients/${patient.id}/documents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },   // no Content-Type: the boundary is the browser's
    body: form,
  });
  const doc = await up.json();
  assert.equal(up.status, 201, JSON.stringify(doc));
  assert.deepEqual(Object.keys(doc).sort(),
    ["byte_size", "category", "content_type", "created_at", "filename", "id",
     "note", "patient_id", "sha256", "uploaded_by"].sort(), "DocumentOut key set");
  assert.match(doc.id, UUID_RE);
  assert.equal(doc.filename, "Скерування.pdf", "a Cyrillic filename survives the multipart round trip");
  assert.equal(doc.byte_size, new TextEncoder().encode(bytes).length);

  const listed = await (await fetch(`${CORE}/patients/${patient.id}/documents`, authed(token))).json();
  assert.equal(listed.total, 1);
  assert.equal(listed.items[0].id, doc.id);

  // The download is an authenticated proxy that decrypts in-process: the
  // bytes must come back byte-identical, not as ciphertext.
  const back = await fetch(`${CORE}/patients/${patient.id}/documents/${doc.id}/content`, authed(token));
  assert.equal(back.status, 200);
  assert.equal(back.headers.get("cache-control"), "no-store", "PHI must not be cached");
  assert.equal(await back.text(), bytes);

  // A valid document id under the WRONG patient is a 404, not a read.
  const other = await (await fetch(`${CORE}/patients`, authed(token, {
    method: "POST",
    body: JSON.stringify({ name: { uk: "Смоук Інший", en: "Smoke Other" }, sex: "U" }),
  }))).json();
  const crossed = await fetch(`${CORE}/patients/${other.id}/documents/${doc.id}/content`, authed(token));
  assert.equal(crossed.status, 404);

  const del = await fetch(`${CORE}/patients/${patient.id}/documents/${doc.id}`, authed(token, { method: "DELETE" }));
  assert.equal(del.status, 204);
  const after = await (await fetch(`${CORE}/patients/${patient.id}/documents`, authed(token))).json();
  assert.equal(after.total, 0);
  // …and the object is gone with the row.
  const gone = await fetch(`${CORE}/patients/${patient.id}/documents/${doc.id}/content`, authed(token));
  assert.equal(gone.status, 404);

  for (const p of [patient, other]) {
    await fetch(`${CORE}/patients/${p.id}`, authed(token, {
      method: "PUT", body: JSON.stringify({ status: "inactive" }),
    }));
  }
});

test("notes: patient_id is required, structure is lowercase, sections are a LIST", { skip: !GATED }, async () => {
  // The note editor drifted from all three of these at once and 422'd on
  // every autosave, silently. Pin them.
  const token = await login();
  const patient = await (await fetch(`${CORE}/patients`, authed(token, {
    method: "POST",
    body: JSON.stringify({ name: { uk: "Смоук Нотатка", en: "Smoke Note" }, sex: "U" }),
  }))).json();

  const post = (body) => fetch(`${CORE}/notes`, authed(token, { method: "POST", body: JSON.stringify(body) }));

  // 1. no patient → rejected
  assert.equal((await post({ structure: "soap", sections: [] })).status, 422, "patient_id is required");
  // 2. uppercase structure → rejected
  assert.equal(
    (await post({ patient_id: patient.id, structure: "SOAP", sections: [] })).status, 422,
    "structure is the lowercase enum",
  );
  // 3. sections as an object → rejected
  assert.equal(
    (await post({ patient_id: patient.id, structure: "soap", sections: { subjective: "x" } })).status, 422,
    "sections is a list, not a map",
  );

  // The shape the editor now sends.
  const created = await (await post({
    patient_id: patient.id,
    structure: "soap",
    title: "скарги на кашель",
    sections: [
      { key: "subjective", content: "скарги на кашель" },
      { key: "objective", content: "" },
      { key: "assessment", content: "ГРВІ" },
      { key: "plan", content: "спокій" },
    ],
  })).json();
  assert.match(created.id, UUID_RE);
  assert.equal(created.status, "draft");
  assert.equal(created.structure, "soap");
  assert.deepEqual(created.sections.map((s) => s.key), ["subjective", "objective", "assessment", "plan"]);

  // PATCH round-trips the same shape (the editor's autosave path for an
  // existing note).
  const patched = await (await fetch(`${CORE}/notes/${created.id}`, authed(token, {
    method: "PATCH",
    body: JSON.stringify({ title: "оновлено", sections: [{ key: "plan", content: "контроль" }] }),
  }))).json();
  assert.equal(patched.title, "оновлено");
  assert.deepEqual(patched.sections, [{ key: "plan", content: "контроль" }]);

  // …and reading it back gives the editor what it needs to rehydrate.
  const read = await (await fetch(`${CORE}/notes/${created.id}`, authed(token))).json();
  assert.equal(read.sections[0].content, "контроль");

  await fetch(`${CORE}/patients/${patient.id}`, authed(token, {
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
