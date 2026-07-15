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
} from "./patients.js";
import { PATIENT_CREATED, PATIENT_LIST_PAGE } from "./patients.fixtures.js";

test("patientCreateBody: picks only PatientCreate keys, drops unknowns and undefined", () => {
  const b = patientCreateBody({
    name: { uk: "Тест", en: "Test" },
    dob: "1984-03-12",
    sex: "F",
    mrn: "S11-1",
    summary: { uk: "с", en: "s" },
    tags: ["a"],
    ipn: "1759013776",
    surprise: 1,           // unknown — must never reach the wire (422 server-side)
    status: "active",      // not a PatientCreate field
  });
  assert.deepEqual(Object.keys(b).sort(), ["dob", "ipn", "mrn", "name", "sex", "summary", "tags"]);
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
