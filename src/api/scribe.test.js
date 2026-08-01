// scribe.test.js — the consult-session adapter.
//
// Guards the two things that made a finished conversation unusable:
// reading it from the service that actually has it, and never turning a
// machine ABSTENTION into a clinician attribution.

import test from "node:test";
import assert from "node:assert/strict";

import { toConsultSession } from "./scribe.js";

// A dictation-service SessionDetail for a conversation session, shaped as
// the backend writes it (services/dictation-service/.../finalize.py).
const DETAIL = {
  id: "11111111-1111-1111-1111-111111111111",
  status: "finalized",
  language: "uk",
  total_audio_ms: 29_460,
  started_at: "2026-07-26T19:55:47Z",
  finalized_at: "2026-07-26T19:56:16Z",
  transcript: [
    {
      id: "a1", text: "Доброго дня", start_ms: 0, end_ms: 980,
      avg_confidence: 0.9, words: [],
      speaker: "S1", speaker_confidence: 0.81, speaker_role: "doctor",
    },
    {
      id: "a2", text: "Болить голова", start_ms: 7040, end_ms: 8280,
      avg_confidence: 0.8, words: [],
      speaker: "S2", speaker_confidence: 0.73, speaker_role: "patient",
    },
    {
      // Diarization labelled the voice but the doctor/patient mapping
      // abstained — speaker_role is null on the wire.
      id: "a3", text: "Особливо зранку", start_ms: 8960, end_ms: 10_100,
      avg_confidence: 0.85, words: [],
      speaker: "S2", speaker_confidence: 0.87, speaker_role: null,
    },
    {
      id: "a4", text: "Так", start_ms: 12_640, end_ms: 14_380,
      avg_confidence: 0.68, words: [],
      speaker: "UNKNOWN", speaker_confidence: null, speaker_role: null,
    },
  ],
};

test("maps speaker_role onto the turn roles the transcript renders", () => {
  const s = toConsultSession(DETAIL);
  assert.deepEqual(s.transcript.map((t) => t.speaker),
    ["clinician", "patient", null, null]);
});

test("an abstained mapping stays unattributed — never the clinician", () => {
  const s = toConsultSession(DETAIL);
  // This is the whole point: `null` role must NOT collapse into
  // "clinician". The old screen rendered every non-patient turn as
  // "Лікар", which laundered an abstention into an attribution.
  assert.equal(s.transcript[2].speaker, null);
  assert.equal(s.transcript[3].speaker, null);
  assert.equal(s.unattributed, 2);
});

test("keeps the anonymous diarization label so two voices stay distinct", () => {
  const s = toConsultSession(DETAIL);
  assert.equal(s.transcript[2].label, "S2");
  assert.equal(s.transcript[3].label, "UNKNOWN");
});

test("projects timings into whole seconds and audio length into seconds", () => {
  const s = toConsultSession(DETAIL);
  assert.deepEqual(s.transcript.map((t) => t.t), [0, 7, 9, 13]);
  assert.equal(s.durationS, 29.46);
});

test("a session that recorded nothing is an empty transcript, not an error", () => {
  const s = toConsultSession({ ...DETAIL, transcript: [] });
  assert.deepEqual(s.transcript, []);
  assert.equal(s.unattributed, 0);
  assert.equal(s.status, "finalized");
});

test("a missing detail yields null rather than a half-built session", () => {
  assert.equal(toConsultSession(null), null);
  assert.equal(toConsultSession(undefined), null);
});

test("a transcript field the backend omitted does not throw", () => {
  const s = toConsultSession({ id: "x", status: "finalized" });
  assert.deepEqual(s.transcript, []);
  assert.equal(s.durationS, null);
});
