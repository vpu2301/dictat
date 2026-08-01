// Sprint 14 — the reviewed transcript → the text that lands in the record.
//
// The single most consequential assertion in this file: a turn the clinician
// corrected reaches the draft CORRECTED. That is the whole reason the frontend
// renders the dialogue instead of letting dictation-service do it (see
// dialogue.js header for the as-built constraint).
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";

import { mergeReview, dialogueText, segmentIds, unattributedCount } from "./dialogue.js";

// What GET /dictate/sessions/{id} returns for a conversation: segments with
// minted UUIDs, the server's own speaker proposals, and word timings.
const persisted = [
  { id: "aaa", text: "що вас турбує", start_ms: 0,    end_ms: 900,  speaker: "S1", speaker_confidence: 0.9 },
  { id: "bbb", text: "болить голова", start_ms: 1000, end_ms: 1900, speaker: "S1", speaker_confidence: 0.4 },
  { id: "ccc", text: "вже тиждень",   start_ms: 2000, end_ms: 2900, speaker: "S2", speaker_confidence: 0.88 },
  { id: "ddd", text: "угу",           start_ms: 3000, end_ms: 3400, speaker: "UNKNOWN", speaker_confidence: 0.2 },
];
const mapping = { S1: "doctor", S2: "patient" };

test("without corrections the server's labels are kept as-is", () => {
  const out = mergeReview(persisted, { corrections: [], mapping });
  assert.deepEqual(out.map((s) => s.speaker_role), ["doctor", "doctor", "patient", null]);
  assert.ok(out.every((s) => s.speaker_source === "machine"));
});

test("a clinician correction overrides the server label and is marked as theirs", () => {
  // The machine put "болить голова" in the doctor's mouth at 0.4 confidence;
  // the clinician flipped that turn to the patient's voice.
  const out = mergeReview(persisted, {
    corrections: [{ seq: 1, start_ms: 1000, speaker: "S2" }],
    mapping,
  });
  assert.equal(out[1].speaker, "S2");
  assert.equal(out[1].speaker_role, "patient");
  assert.equal(out[1].speaker_source, "clinician");
  assert.equal(out[1].speaker_confidence, null);
  assert.equal(out[0].speaker_source, "machine", "untouched segments stay machine-labelled");
});

test("the correction survives into the rendered dialogue", () => {
  const reviewed = mergeReview(persisted, {
    corrections: [{ seq: 1, start_ms: 1000, speaker: "S2" }],
    mapping,
  });
  const text = dialogueText(reviewed, { lang: "uk" });
  assert.equal(text, [
    "ЛІКАР: що вас турбує",
    "ПАЦІЄНТ: болить голова вже тиждень",
    "НЕВІДОМО: угу",
  ].join("\n"));
});

test("consecutive same-party segments join one line; a party change breaks it", () => {
  const text = dialogueText(mergeReview(persisted, { corrections: [], mapping }), { lang: "uk" });
  assert.equal(text.split("\n")[0], "ЛІКАР: що вас турбує болить голова");
});

test("UNKNOWN and unmapped speakers are labelled honestly, never given to a party", () => {
  const noMapping = mergeReview(persisted, { corrections: [], mapping: {} });
  const text = dialogueText(noMapping, { lang: "uk" });
  assert.ok(!text.includes("ЛІКАР"), "nothing is attributed without a mapping");
  assert.ok(!text.includes("ПАЦІЄНТ"));
  assert.match(text, /^НЕВІДОМО: /);
  // S1 and S2 stay distinct lines even while both are НЕВІДОМО — merging them
  // would fabricate a single speaker out of two.
  assert.equal(text.split("\n").length, 3);
});

test("empty segments are dropped, not rendered as an empty turn", () => {
  const text = dialogueText([
    { text: "  ", speaker_role: "doctor" },
    { text: "добре", speaker_role: "doctor" },
  ], { lang: "uk" });
  assert.equal(text, "ЛІКАР: добре");
});

test("english labels for an en session", () => {
  const text = dialogueText(mergeReview(persisted.slice(0, 1), { mapping }), { lang: "en" });
  assert.equal(text, "DOCTOR: що вас турбує");
});

test("segmentIds feeds transcript_segment_ids; absent ids yield an empty list", () => {
  assert.deepEqual(segmentIds(persisted), ["aaa", "bbb", "ccc", "ddd"]);
  assert.deepEqual(segmentIds([{ text: "no id" }]), []);
});

test("unattributedCount counts what is still honestly unassigned", () => {
  assert.equal(unattributedCount(mergeReview(persisted, { mapping })), 1);
  assert.equal(unattributedCount(mergeReview(persisted, { mapping: {} })), 4);
});

test("an unmatched correction cannot drop a segment", () => {
  const out = mergeReview(persisted, { corrections: [{ start_ms: 999999, speaker: "S2" }], mapping });
  assert.equal(out.length, persisted.length);
});
