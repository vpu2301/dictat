// Units for the public signup form's CRM payload.
//
//   node --test src/api/leads.test.js
//
// This is the one place where a silent mistake is invisible until a quarter's
// leads are already in HubSpot wrong: nothing in the UI shows what was sent,
// and a mis-named property makes the whole submission bounce.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  leadFields, leadSubmission, leadOrigins, leadEndpoint, hubspotConfig,
  CUSTOM_PROPERTIES, DEFAULT_COUNTRY,
} from "./leads.js";
import { SPECIALTIES, ROLES, ORG_TYPES, SIZES, options } from "../pages/signupOptions.js";

const LEAD = {
  firstName: " Olena ", lastName: "Koval", email: "olena@hospital.example",
  phone: "+380 44 000 0000",
  specialty: "Cardiology", role: "Head of department",
  org: "City Hospital No. 1", orgType: "Public hospital", city: "Kyiv", size: "21-50",
  consent: true,
};

const byName = (fields) => Object.fromEntries(fields.map((f) => [f.name, f.value]));

test("the whole form reaches HubSpot under its built-in property names", () => {
  const f = byName(leadFields(LEAD));
  assert.equal(f.firstname, "Olena", "trimmed");
  assert.equal(f.lastname, "Koval");
  assert.equal(f.email, "olena@hospital.example");
  assert.equal(f.phone, "+380 44 000 0000");
  // The B2B signal: `company` is the property HubSpot associates a Company
  // record by, which is the entire reason this field is on the form.
  assert.equal(f.company, "City Hospital No. 1");
  assert.equal(f.city, "Kyiv");
  assert.equal(f.jobtitle, "Head of department");
  assert.equal(f.medical_specialty, "Cardiology");
  assert.equal(f.organisation_type, "Public hospital");
  assert.equal(f.clinician_count, "21-50");
});

test("every field is a Contact-typed field", () => {
  for (const f of leadFields(LEAD)) assert.equal(f.objectTypeId, "0-1", f.name);
});

test("country is sent without being asked", () => {
  // Hidden, not absent: a Company with no country cannot be territory-mapped.
  assert.equal(byName(leadFields(LEAD)).country, DEFAULT_COUNTRY);
  assert.equal(byName(leadFields({ ...LEAD, country: "Poland" })).country, "Poland");
});

test("a blank optional field is dropped, not sent empty", () => {
  // An empty string is a WRITE in HubSpot: it would wipe the phone number a
  // returning lead gave us last time.
  const f = byName(leadFields({ ...LEAD, phone: "   ", size: "" }));
  assert.equal("phone" in f, false);
  assert.equal("clinician_count" in f, false);
  assert.equal(f.email, LEAD.email, "the rest still goes");
});

test("the custom properties a portal must define are declared in one place", () => {
  const names = leadFields(LEAD).map((f) => f.name);
  for (const p of CUSTOM_PROPERTIES) assert.ok(names.includes(p), `${p} is sent`);
});

// ── consent ────────────────────────────────────────────────────────────

test("consent is recorded with the exact wording that was agreed to", () => {
  const text = "Я прочитав(ла) Умови та Політику конфіденційності і погоджуюсь із ними.";
  const body = leadSubmission(LEAD, { consentText: text });
  assert.equal(body.legalConsentOptions.consent.consentToProcess, true);
  assert.equal(body.legalConsentOptions.consent.text, text,
    "verbatim, in the language the visitor read — that is the artefact a regulator asks for");
});

test("no consent, no consent record", () => {
  // Never assert agreement that was not given, even by omission of the block.
  const body = leadSubmission({ ...LEAD, consent: false }, { consentText: "x" });
  assert.equal("legalConsentOptions" in body, false);
});

test("page context rides along, and empty context stays empty", () => {
  const withCtx = leadSubmission(LEAD, { pageUri: "https://x/#/signup", pageName: "Sign up" });
  assert.equal(withCtx.context.pageUri, "https://x/#/signup");
  assert.equal(withCtx.context.pageName, "Sign up");
  assert.deepEqual(leadSubmission(LEAD).context, {});
});

// ── configuration + CSP ────────────────────────────────────────────────

test("a half-configured portal counts as no portal", () => {
  assert.equal(hubspotConfig({ VITE_HUBSPOT_PORTAL_ID: "123" }), null);
  assert.equal(hubspotConfig({ VITE_HUBSPOT_FORM_GUID: "abc" }), null);
  assert.equal(hubspotConfig({ VITE_HUBSPOT_PORTAL_ID: " ", VITE_HUBSPOT_FORM_GUID: "abc" }), null);
  assert.deepEqual(hubspotConfig({ VITE_HUBSPOT_PORTAL_ID: "123", VITE_HUBSPOT_FORM_GUID: "abc" }),
    { portalId: "123", formGuid: "abc" });
});

test("the CSP learns the origin only when leads are actually submitted", () => {
  assert.deepEqual(leadOrigins({}), []);
  assert.deepEqual(leadOrigins({ VITE_HUBSPOT_PORTAL_ID: "123", VITE_HUBSPOT_FORM_GUID: "abc" }),
    ["https://api.hsforms.com"]);
});

test("the endpoint is HubSpot's v3 form submission path", () => {
  assert.equal(
    leadEndpoint({ portalId: "1234567", formGuid: "a1b2-c3" }),
    "https://api.hsforms.com/submissions/v3/integration/submit/1234567/a1b2-c3",
  );
});

// ── picklists ──────────────────────────────────────────────────────────

test("what the CRM stores does not depend on the language being read", () => {
  // The regression this design exists to prevent: storing the label filed the
  // same cardiologist as "Кардіологія" / "Kardiologie" / "Cardiología", and no
  // HubSpot list could find them all.
  for (const registry of [SPECIALTIES, ROLES, ORG_TYPES, SIZES]) {
    const uk = options(registry, "uk").map((o) => o.value);
    const de = options(registry, "de").map((o) => o.value);
    assert.deepEqual(uk, de);
  }
});

test("a Ukrainian reader sees Ukrainian, and an unknown language falls back to English", () => {
  const uk = options(SPECIALTIES, "uk");
  assert.equal(uk.find((o) => o.value === "Cardiology").label, "Кардіологія");
  const zz = options(SPECIALTIES, "zz");
  assert.equal(zz.find((o) => o.value === "Cardiology").label, "Cardiology");
});

test("every option is usable: a value, and a label in every offered language", () => {
  const LANGS = ["uk", "en", "pl", "de", "ro", "cs", "sr", "hu", "ar", "es", "pt"];
  for (const registry of [SPECIALTIES, ROLES, ORG_TYPES]) {
    for (const o of registry) {
      assert.ok(o.value && o.value.trim(), "stable value");
      for (const l of LANGS) {
        assert.ok(options(registry, l).find((x) => x.value === o.value).label,
          `${o.value} has a ${l} label`);
      }
    }
  }
});

test("option values are unique inside a registry", () => {
  // A duplicate would make the select unselectable and the CRM value ambiguous.
  for (const registry of [SPECIALTIES, ROLES, ORG_TYPES, SIZES]) {
    const values = registry.map((o) => o.value);
    assert.equal(new Set(values).size, values.length);
  }
});

test("nothing is pre-selected — a required answer must be chosen", () => {
  // The form seeds "" for these; if a registry ever gained an empty-valued
  // first option it would silently become a default again.
  for (const registry of [SPECIALTIES, ROLES, ORG_TYPES]) {
    assert.ok(registry.every((o) => o.value !== ""), "no empty-valued option");
  }
});
