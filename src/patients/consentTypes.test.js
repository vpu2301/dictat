// Sprint 14 — conversation mode gates on a DIFFERENT consent than dictation.
//
// `ai_scribe` authorises dictating the clinician's own voice. `recording`
// authorises recording the CONSULTATION — the patient's voice. They are
// separate lawful bases, and dictation-service enforces the distinction
// server-side (domain/consents.py: CONSENT_TYPE_RECORDING, error
// consent_required). If the frontend gate accepted one for the other, the
// clinician would meet a socket refusal after the microphone was already open.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  hasActiveConsent, hasActiveAiScribeConsent,
  CONSENT_TYPE_RECORDING, CONSENT_TYPE_AI_SCRIBE,
} from "./consentGate.js";
import { APPROVED_CONSENT_VERSIONS } from "./consentTexts.js";

const ENC = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";
const c = (over = {}) => ({ id: "c1", type: "recording", status: "granted", encounter_id: null, ...over });

test("an ai_scribe consent does NOT authorise recording the conversation", () => {
  const list = [c({ type: CONSENT_TYPE_AI_SCRIBE })];
  assert.equal(hasActiveConsent(list, { encounterId: ENC, type: CONSENT_TYPE_RECORDING }), false);
});

test("a recording consent does NOT stand in for the dictation gate either", () => {
  const list = [c({ type: CONSENT_TYPE_RECORDING })];
  assert.equal(hasActiveAiScribeConsent(list, { encounterId: ENC }), false);
});

test("patient-wide recording consent covers this encounter", () => {
  assert.equal(hasActiveConsent([c()], { encounterId: ENC, type: CONSENT_TYPE_RECORDING }), true);
});

test("encounter-scoped recording consent counts only for ITS encounter", () => {
  const scoped = [c({ encounter_id: ENC })];
  assert.equal(hasActiveConsent(scoped, { encounterId: ENC, type: CONSENT_TYPE_RECORDING }), true);
  assert.equal(hasActiveConsent(scoped, { encounterId: OTHER, type: CONSENT_TYPE_RECORDING }), false);
});

test("withdrawn recording consent blocks the conversation", () => {
  assert.equal(
    hasActiveConsent([c({ status: "withdrawn" })], { encounterId: ENC, type: CONSENT_TYPE_RECORDING }),
    false,
  );
});

test("the gate defaults to ai_scribe so every S11 call site is unchanged", () => {
  assert.equal(hasActiveConsent([c({ type: "ai_scribe" })], { encounterId: ENC }), true);
});

test("'recording' has an approved consent-text version in the sheet registry", () => {
  // Must track the backend registry (infra/seeds/consents/recording-v1.md);
  // a digital capture with an unknown (type, version) pair is 422'd.
  assert.deepEqual(APPROVED_CONSENT_VERSIONS[CONSENT_TYPE_RECORDING], ["v1"]);
});
