// Sprint 14 — protocol v2 negotiation and framing, asserted on the wire
// shapes the client actually produces.
//
// The two properties this suite exists to protect:
//   1. CONVERSATION gets v2 (and asks for it in preference order).
//   2. DICTATION IS UNTOUCHED — it offers v1 only and its start_session is
//      byte-identical to the pre-sprint-14 payload. A dictation session that
//      silently gained a `mode` key would be rejected by the backend's
//      extra="forbid" model; one that silently negotiated v2 would receive
//      frames its renderer has no meaning for.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  msgStartSession, msgSetSpeakerMapping, subprotocolsFor,
  SUBPROTOCOL_V1, SUBPROTOCOL_V2, PROTOCOL_VERSION_V2,
  explainErrorCode,
} from "./wsClient.js";

// ── negotiation ──────────────────────────────────────────────────────
test("conversation offers v2 FIRST, with v1 as the fallback", () => {
  assert.deepEqual(subprotocolsFor("conversation"), [SUBPROTOCOL_V2, SUBPROTOCOL_V1]);
});

test("dictation offers v1 ONLY — never opted into v2 by a server preference", () => {
  assert.deepEqual(subprotocolsFor("dictation"), [SUBPROTOCOL_V1]);
  assert.deepEqual(subprotocolsFor(undefined), [SUBPROTOCOL_V1]);
});

// ── start_session ────────────────────────────────────────────────────
test("conversation start_session carries mode + protocol_version 2", () => {
  const m = msgStartSession({
    promptId: "p1", language: "uk", encounterId: "e1",
    mode: "conversation", protocolVersion: PROTOCOL_VERSION_V2,
  });
  assert.equal(m.protocol_version, 2);
  assert.equal(m.mode, "conversation");
  assert.equal(m.encounter_id, "e1");
});

test("v1 dictation start_session is byte-identical to the pre-S14 payload", () => {
  const m = msgStartSession({ promptId: "p1", language: "uk", targetKind: "generic", encounterId: "e1" });
  assert.deepEqual(m, {
    type: "start_session",
    protocol_version: 1,
    prompt_id: "p1",
    language: "uk",
    target_kind: "generic",
    encounter_id: "e1",
  });
  assert.ok(!("mode" in m), "no mode key on a v1 session");
});

test("mode is never emitted on v1, even if a caller passes one", () => {
  const m = msgStartSession({ promptId: "p1", language: "uk", mode: "conversation" });
  assert.ok(!("mode" in m), "a v1 session with a mode key would be a protocol error");
  assert.equal(m.protocol_version, 1);
});

test("dictation on v2 omits mode too — the server default is dictation", () => {
  const m = msgStartSession({
    promptId: "p1", language: "uk", mode: "dictation", protocolVersion: PROTOCOL_VERSION_V2,
  });
  assert.ok(!("mode" in m));
  assert.equal(m.protocol_version, 2);
});

test("conversation omits template_id when the caller withholds it", () => {
  // Deliberate: with a template_id the service writes the draft itself from
  // ITS labels and the clinician's review is lost (dialogue.js header).
  const m = msgStartSession({
    promptId: "p1", language: "uk", encounterId: "e1",
    mode: "conversation", protocolVersion: PROTOCOL_VERSION_V2,
  });
  assert.ok(!("template_id" in m));
});

// ── set_speaker_mapping ──────────────────────────────────────────────
test("set_speaker_mapping sends only doctor/patient roles", () => {
  const m = msgSetSpeakerMapping({ S1: "patient", S2: "doctor" });
  assert.deepEqual(m, { type: "set_speaker_mapping", mapping: { S1: "patient", S2: "doctor" } });
});

test("null / unknown roles are stripped — the wire model forbids them", () => {
  const m = msgSetSpeakerMapping({ S1: "doctor", S2: null, S3: "bystander" });
  assert.deepEqual(m.mapping, { S1: "doctor" });
});

// ── error copy ───────────────────────────────────────────────────────
test("consent_required is explained in Ukrainian, not as a code", () => {
  const uk = explainErrorCode("consent_required", "uk");
  assert.match(uk, /згод/i);
  assert.doesNotMatch(uk, /consent_required/);
  assert.match(explainErrorCode("consent_required", "en"), /consent/i);
});
