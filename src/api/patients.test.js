// Sprint 11 step 01 — units for the patient contract's pure pieces: strict
// wire pickers (extra="forbid" server — nothing unknown may leak onto the
// wire), the PII-hygiene display primitives, and the cursor-page adapter.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  patientCreateBody,
  patientUpdateBody,
  displayName,
  yearOfBirth,
  toPage,
  patientsPageFetcher,
  isEmailShapeValid,
  normalizeEmail,
  isPhoneShapeValid,
  normalizePhone,
  hasContact,
  hasAddress,
  addressBody,
  formatAddress,
} from "./patients.js";
import {
  PATIENT_CREATED, PATIENT_LIST_PAGE, PATIENT_WITH_CONTACT,
} from "./patients.fixtures.js";

test("patientCreateBody: picks only PatientCreate keys, drops unknowns and undefined", () => {
  const b = patientCreateBody({
    name: { uk: "Тест", en: "Test" },
    dob: "1984-03-12",
    sex: "F",
    mrn: "S11-1",
    phone: "+380441234567",
    email: "p@example.com",
    address: { street: "вул. Хрещатик", house: "1", zip: "01001", city: "Київ", country: "Україна" },
    summary: { uk: "с", en: "s" },
    tags: ["a"],
    ipn: "1759013776",
    surprise: 1,           // unknown — must never reach the wire (422 server-side)
    status: "active",      // not a PatientCreate field
  });
  assert.deepEqual(
    Object.keys(b).sort(),
    ["address", "dob", "email", "ipn", "mrn", "name", "phone", "sex", "summary", "tags"],
  );
});

test("patientCreateBody: minimal input serializes to name only", () => {
  assert.deepEqual(patientCreateBody({ name: { uk: "А", en: "A" } }), { name: { uk: "А", en: "A" } });
});

test("patientUpdateBody: undefined = key absent (unchanged); empty string ipn survives (= clear)", () => {
  assert.deepEqual(patientUpdateBody({ status: "inactive" }), { status: "inactive" });
  assert.deepEqual(patientUpdateBody({ ipn: "" }), { ipn: "" });
  assert.deepEqual(patientUpdateBody({}), {});
  const b = patientUpdateBody({ tags: [], nope: true });
  assert.deepEqual(b, { tags: [] });
});

test("patientUpdateBody: contact fields follow the same clear-vs-unchanged rule", () => {
  assert.deepEqual(patientUpdateBody({ phone: "+380441234567" }), { phone: "+380441234567" });
  // "" is a real value here (= clear the stored detail), not an omission. An
  // address object always carries all five components — blanks clear them.
  assert.deepEqual(patientUpdateBody({ phone: "", email: "", address: {} }),
    { phone: "", email: "", address: { street: "", house: "", zip: "", city: "", country: "" } });
  // undefined = unchanged, so the key must not reach the wire at all.
  assert.deepEqual(patientUpdateBody({ phone: undefined, email: "a@b.co" }), { email: "a@b.co" });
});

test("address is re-shaped onto the wire: five keys, trimmed, nothing else", () => {
  // The server's Address model is extra="forbid" — a stray key 422s the whole
  // request, so the picker rebuilds the object instead of passing it through.
  const b = patientCreateBody({
    name: { uk: "А" },
    address: { city: "  Львів ", region: "Львівська", zip: 79000 },
  });
  assert.deepEqual(b.address,
    { street: "", house: "", zip: "79000", city: "Львів", country: "" });
});

test("isEmailShapeValid: mirrors the server's loose local@domain.tld rule", () => {
  assert.equal(isEmailShapeValid(""), true);            // optional field
  assert.equal(isEmailShapeValid("   "), true);
  assert.equal(isEmailShapeValid("name@example.com"), true);
  assert.equal(isEmailShapeValid("  Name@Example.COM "), true);
  assert.equal(isEmailShapeValid("first.last+tag@sub.example.co.uk"), true);
  assert.equal(isEmailShapeValid("no-at-sign"), false);
  assert.equal(isEmailShapeValid("@example.com"), false);   // empty local part
  assert.equal(isEmailShapeValid("name@"), false);          // empty domain
  assert.equal(isEmailShapeValid("name@example"), false);   // no dot in domain
  assert.equal(isEmailShapeValid("na me@example.com"), false);
});

test("normalizeEmail: trims and lower-cases (the server stores it normalized)", () => {
  assert.equal(normalizeEmail("  Name@Example.COM "), "name@example.com");
  assert.equal(normalizeEmail(undefined), "");
  assert.equal(normalizeEmail(null), "");
});

test("isPhoneShapeValid: mirrors the server's E.164 rule, separators and all", () => {
  assert.equal(isPhoneShapeValid(""), true);                  // optional field
  assert.equal(isPhoneShapeValid("   "), true);
  assert.equal(isPhoneShapeValid("+380671234567"), true);
  assert.equal(isPhoneShapeValid("+380 (67) 123-45-67"), true);
  assert.equal(isPhoneShapeValid("0671234567"), true);        // national form
  assert.equal(isPhoneShapeValid("044 123-45-67"), true);
  assert.equal(isPhoneShapeValid("+48 22 123 45 67"), true);  // foreign number
  assert.equal(isPhoneShapeValid("12345"), false);            // under 7 digits
  assert.equal(isPhoneShapeValid("+1234567890123456"), false); // over E.164's 15
  assert.equal(isPhoneShapeValid("call me"), false);
  assert.equal(isPhoneShapeValid("+380-67-123-45-6x"), false);
  assert.equal(isPhoneShapeValid("+"), false);
});

test("normalizePhone: strips separators, keeps the country prefix", () => {
  assert.equal(normalizePhone("+380 (67) 123-45-67"), "+380671234567");
  assert.equal(normalizePhone("  044 123 45 67 "), "0441234567");
  assert.equal(normalizePhone(""), "");
  assert.equal(normalizePhone(undefined), "");
  assert.equal(normalizePhone(null), "");
});

test("addressBody / hasAddress: always five string keys; blank-safe", () => {
  assert.deepEqual(addressBody(undefined),
    { street: "", house: "", zip: "", city: "", country: "" });
  assert.deepEqual(addressBody({ city: " Київ " }),
    { street: "", house: "", zip: "", city: "Київ", country: "" });
  assert.equal(hasAddress(undefined), false);
  assert.equal(hasAddress({}), false);
  assert.equal(hasAddress({ city: "   " }), false);
  assert.equal(hasAddress({ city: "Київ" }), true);   // partial is still an address
});

test("formatAddress: one line, blanks collapse instead of leaving stray commas", () => {
  assert.equal(formatAddress(PATIENT_WITH_CONTACT.address),
    "вул. Хрещатик, 1, кв. 5, 01001 Київ, Україна");
  assert.equal(formatAddress({ city: "Львів" }), "Львів");
  assert.equal(formatAddress({ street: "вул. Шевченка", city: "Київ" }),
    "вул. Шевченка, Київ");
  assert.equal(formatAddress({ zip: "01001", city: "Київ" }), "01001 Київ");
  assert.equal(formatAddress({}), "");
  assert.equal(formatAddress(null), "");
});

test("hasContact: true when any one detail is on file, blank-safe", () => {
  // The fixture was registered without contact details — blank throughout.
  assert.equal(hasContact(PATIENT_CREATED), false);
  assert.equal(hasContact(PATIENT_WITH_CONTACT), true);
  assert.equal(hasContact({ ...PATIENT_CREATED, phone: "+380441234567" }), true);
  assert.equal(hasContact({ phone: "", email: "", address: {} }), false);
  assert.equal(hasContact({ phone: "   " }), false);
  assert.equal(hasContact({ address: { city: "Київ" } }), true);
  assert.equal(hasContact(null), false);
  assert.equal(hasContact({}), false);
});

test("displayName: prefers the UI language, falls back across uk/en, trims blanks", () => {
  assert.equal(displayName(PATIENT_CREATED, "uk"), "Тест Пацієнт-С11");
  assert.equal(displayName(PATIENT_CREATED, "en"), "Test Patient-S11");
  assert.equal(displayName({ name: { uk: "  ", en: "Fallback" } }, "uk"), "Fallback");
  assert.equal(displayName({ name: { uk: "Укр", en: "" } }, "en"), "Укр");
  assert.equal(displayName({}, "uk"), "");
  assert.equal(displayName(null, "uk"), "");
});

test("yearOfBirth: the only DOB derivative — year or null, never the date", () => {
  assert.equal(yearOfBirth(PATIENT_CREATED), 1984);
  assert.equal(yearOfBirth({ dob: null }), null);
  assert.equal(yearOfBirth({ dob: "1984" }), null);       // malformed → null, no guessing
  assert.equal(yearOfBirth({}), null);
  assert.equal(yearOfBirth(null), null);
});

test("toPage: adapts { items, next_cursor } to useCursorPages' shape", () => {
  assert.deepEqual(toPage(PATIENT_LIST_PAGE), { items: [PATIENT_CREATED], nextCursor: null });
  assert.deepEqual(toPage({ items: [], next_cursor: "abc" }), { items: [], nextCursor: "abc" });
  assert.deepEqual(toPage(undefined), { items: [], nextCursor: null });
  assert.equal(typeof patientsPageFetcher({ query: "x" }), "function");
});
