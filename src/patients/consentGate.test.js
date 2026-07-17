// Sprint 11 step 05 — the active-consent predicate: the gate's single piece
// of business logic, tested as a matrix so call sites never inline variants.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";

import { hasActiveAiScribeConsent } from "./consentGate.js";

const ENC = "22222222-2222-4222-8222-222222222222";
const OTHER_ENC = "33333333-3333-4333-8333-333333333333";
const c = (over = {}) => ({
  id: "c1", type: "ai_scribe", status: "granted", encounter_id: null, ...over,
});

test("patient-level granted ai_scribe → active for any encounter and for none", () => {
  assert.equal(hasActiveAiScribeConsent([c()], { encounterId: ENC }), true);
  assert.equal(hasActiveAiScribeConsent([c()], {}), true);
});

test("withdrawn → never active", () => {
  assert.equal(hasActiveAiScribeConsent([c({ status: "withdrawn" })], { encounterId: ENC }), false);
});

test("other consent types never satisfy the recording gate", () => {
  assert.equal(hasActiveAiScribeConsent([c({ type: "data_processing" })], { encounterId: ENC }), false);
});

test("encounter-scoped consent counts ONLY for its encounter", () => {
  const scoped = [c({ encounter_id: ENC })];
  assert.equal(hasActiveAiScribeConsent(scoped, { encounterId: ENC }), true);
  assert.equal(hasActiveAiScribeConsent(scoped, { encounterId: OTHER_ENC }), false);
  assert.equal(hasActiveAiScribeConsent(scoped, {}), false);
});

test("mixed list: one active row is enough; junk rows are ignored", () => {
  const list = [null, c({ status: "withdrawn" }), c({ type: "data_processing" }), c({ encounter_id: OTHER_ENC }), c()];
  assert.equal(hasActiveAiScribeConsent(list, { encounterId: ENC }), true);
});

test("empty / missing input → not active (fail closed downstream)", () => {
  assert.equal(hasActiveAiScribeConsent([], { encounterId: ENC }), false);
  assert.equal(hasActiveAiScribeConsent(undefined, { encounterId: ENC }), false);
});
