// synonyms.test.js — the pure half of the synonym client.
//
// The bounds here are the backend's (SynonymGroupBody: language uk|en, 2..12
// terms, no duplicates within a group). Testing them client-side is not
// belt-and-braces: the console lets an owner type a term list freely, and the
// difference between "the Save button is disabled and says why" and "the
// server 422s after a round-trip" is the whole usability of the panel.

import test from "node:test";
import assert from "node:assert/strict";

import {
  parseTerms, validateGroup, isEditable,
  SYNONYM_MIN_TERMS, SYNONYM_MAX_TERMS, SYNONYM_LANGS,
} from "./synonyms.js";

test("parseTerms splits on commas and newlines, trimming each term", () => {
  assert.deepEqual(parseTerms("набряк, набряки \n едема"), ["набряк", "набряки", "едема"]);
});

test("parseTerms drops blanks rather than sending empty strings", () => {
  assert.deepEqual(parseTerms("a, , b,,"), ["a", "b"]);
  assert.deepEqual(parseTerms(""), []);
  assert.deepEqual(parseTerms(null), []);
});

test("parseTerms drops case-insensitive duplicates, keeping the first spelling", () => {
  // The backend rejects a group with a repeated term; "Edema, edema" is a typo
  // the panel should absorb, not a 422 the owner should have to decode.
  assert.deepEqual(parseTerms("Edema, edema, EDEMA, swelling"), ["Edema", "swelling"]);
});

test("parseTerms preserves order — the first term reads as the canonical one", () => {
  assert.deepEqual(parseTerms("c, a, b"), ["c", "a", "b"]);
});

test("a group needs at least two terms", () => {
  assert.equal(validateGroup({ language: "uk", terms: ["набряк"] }), "too_few");
  assert.equal(validateGroup({ language: "uk", terms: [] }), "too_few");
  assert.equal(validateGroup({ language: "uk", terms: ["набряк", "едема"] }), null);
});

test("deduplication is applied BEFORE the minimum is checked", () => {
  // Otherwise "edema, Edema" looks like two terms to the UI and one to the
  // server, and the console would enable a Save that cannot succeed.
  assert.equal(validateGroup({ language: "en", terms: ["edema", "Edema"] }), "too_few");
});

test("a group is capped at twelve terms", () => {
  const many = Array.from({ length: SYNONYM_MAX_TERMS + 1 }, (_, i) => `t${i}`);
  assert.equal(validateGroup({ language: "en", terms: many }), "too_many");
  assert.equal(validateGroup({ language: "en", terms: many.slice(0, SYNONYM_MAX_TERMS) }), null);
});

test("report-service content languages are uk/en only", () => {
  assert.deepEqual(SYNONYM_LANGS, ["uk", "en"]);
  // de is dictatable but report-service content is not — see
  // dictation/languages.js TEMPLATE_CODES.
  assert.equal(validateGroup({ language: "de", terms: ["a", "b"] }), "language");
  assert.equal(validateGroup({ language: undefined, terms: ["a", "b"] }), "language");
});

test("the minimum is two, stated rather than assumed", () => {
  assert.equal(SYNONYM_MIN_TERMS, 2);
});

test("only tenant-owned groups are editable; system groups answer 403", () => {
  assert.equal(isEditable({ source: "tenant" }), true);
  assert.equal(isEditable({ source: "system" }), false);
  // A row with no source at all must not be offered edit controls — guessing
  // "editable" here produces a button that 403s.
  assert.equal(isEditable({}), false);
  assert.equal(isEditable(null), false);
});
