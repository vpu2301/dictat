// Sprint 14 — the turn model's honesty rules, one test per rule.
// Driven by a fixture stream shaped like the real one: labels trail the text
// by a window, some segments are genuinely UNKNOWN, and the clinician
// corrects one.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  emptyTurns, applyFinal, applyPartial, clearPartial, setTurnSpeaker,
  flipSpeaker, fromCommitted, corrections, unresolvedCount, UNKNOWN,
} from "./turns.js";

const final = (seq, text, speaker = null, conf = null, start = seq * 1000) => ({
  type: "final", seq, text, start_ms: start, end_ms: start + 900,
  speaker, speaker_confidence: conf,
});

// ── rule 1: text is never held for a label ───────────────────────────
test("an unlabelled final renders its text immediately, marked pending", () => {
  const s = applyFinal(emptyTurns(), final(0, "добрий день"));
  assert.equal(s.turns.length, 1);
  assert.equal(s.turns[0].text, "добрий день");
  assert.equal(s.turns[0].speaker, null);
  assert.equal(s.turns[0].segments[0].pending, true);
});

test("a partial renders before any final and never becomes a turn", () => {
  let s = applyPartial(emptyTurns(), { seq: 0, text: "вже тиждень", speaker: null });
  assert.equal(s.partial.text, "вже тиждень");
  assert.equal(s.turns.length, 0);
  // revision replaces it wholesale — no ghost bubble
  s = applyPartial(s, { seq: 0, text: "вже тиждень болить голова", speaker: "S2" });
  assert.equal(s.turns.length, 0);
  assert.equal(s.partial.text, "вже тиждень болить голова");
  // the committed final supersedes the tail
  s = applyFinal(s, final(0, "вже тиждень болить голова", "S2", 0.84));
  assert.equal(s.partial, null);
  assert.equal(s.turns.length, 1);
});

// ── rule 2: a label may arrive, never change ─────────────────────────
test("a trailing label backfills onto the already-rendered segment", () => {
  let s = applyFinal(emptyTurns(), final(3, "болить голова"));
  const before = s.turns[0].text;
  s = applyFinal(s, final(3, "болить голова", "S2", 0.91));   // same seq, resolved
  assert.equal(s.turns.length, 1, "no duplicate bubble");
  assert.equal(s.turns[0].text, before, "text unchanged — only the label landed");
  assert.equal(s.turns[0].speaker, "S2");
  assert.equal(s.turns[0].confidence, 0.91);
  assert.equal(s.turns[0].segments[0].pending, false);
});

test("a committed label is NOT silently rewritten by a later frame", () => {
  let s = applyFinal(emptyTurns(), final(1, "як ви себе почуваєте", "S1", 0.8));
  s = applyFinal(s, final(1, "як ви себе почуваєте", "S2", 0.99));
  assert.equal(s.turns[0].speaker, "S1", "retro-lie refused");
});

test("a repeated final never appends the text twice", () => {
  let s = applyFinal(emptyTurns(), final(1, "кашель", "S1", 0.8));
  s = applyFinal(s, final(1, "кашель", "S1", 0.8));
  assert.equal(s.turns.length, 1);
  assert.equal(s.turns[0].text, "кашель");
});

// ── merging ──────────────────────────────────────────────────────────
test("consecutive same-speaker finals merge into ONE bubble", () => {
  let s = emptyTurns();
  s = applyFinal(s, final(0, "добрий день", "S1", 0.9));
  s = applyFinal(s, final(1, "що вас турбує", "S1", 0.88));
  assert.equal(s.turns.length, 1);
  assert.equal(s.turns[0].text, "добрий день що вас турбує");
  assert.equal(s.turns[0].segments.length, 2);
});

test("a speaker change starts a new bubble", () => {
  let s = emptyTurns();
  s = applyFinal(s, final(0, "що вас турбує", "S1", 0.9));
  s = applyFinal(s, final(1, "болить голова", "S2", 0.9));
  s = applyFinal(s, final(2, "як давно", "S1", 0.9));
  assert.deepEqual(s.turns.map((t) => t.speaker), ["S1", "S2", "S1"]);
});

// ── rule 3: UNKNOWN is an answer ─────────────────────────────────────
test("UNKNOWN gets its own visible bubble and never merges", () => {
  let s = emptyTurns();
  s = applyFinal(s, final(0, "а", UNKNOWN, 0.3));
  s = applyFinal(s, final(1, "б", UNKNOWN, 0.3));
  assert.equal(s.turns.length, 2, "two ambiguous stretches are two things to look at");
  assert.equal(s.turns[0].speaker, UNKNOWN);
});

test("consecutive unlabelled finals DO group (one pending stretch, not confetti)", () => {
  let s = emptyTurns();
  s = applyFinal(s, final(0, "раз"));
  s = applyFinal(s, final(1, "два"));
  assert.equal(s.turns.length, 1);
  assert.equal(s.turns[0].text, "раз два");
});

// ── rule 4: a corrected turn is closed ───────────────────────────────
test("correcting a turn marks it clinician-confirmed", () => {
  let s = applyFinal(emptyTurns(), final(0, "болить голова", "S1", 0.6));
  s = setTurnSpeaker(s, s.turns[0].id, "S2");
  assert.equal(s.turns[0].speaker, "S2");
  assert.equal(s.turns[0].source, "clinician");
  assert.equal(s.turns[0].confidence, null, "a clinician's answer is not a probability");
});

test("new machine text never merges into a corrected turn", () => {
  let s = applyFinal(emptyTurns(), final(0, "болить голова", "S1", 0.6));
  s = setTurnSpeaker(s, s.turns[0].id, "S2");
  s = applyFinal(s, final(1, "і паморочиться", "S2", 0.9));
  assert.equal(s.turns.length, 2, "the correction is not extended to unreviewed text");
  assert.equal(s.turns[1].source, "machine");
});

test("flip is one tap between the two voices", () => {
  assert.equal(flipSpeaker("S1"), "S2");
  assert.equal(flipSpeaker("S2"), "S1");
  assert.equal(flipSpeaker(UNKNOWN), "S1");
  assert.equal(flipSpeaker(null), "S1");
});

// ── resume ───────────────────────────────────────────────────────────
test("resume re-renders committed turns with their speakers, same grouping", () => {
  const committed = [
    { seq: 0, text: "добрий день", start_ms: 0, end_ms: 900, speaker: "S1", speaker_confidence: 0.9 },
    { seq: 1, text: "що вас турбує", start_ms: 1000, end_ms: 1900, speaker: "S1", speaker_confidence: 0.9 },
    { seq: 2, text: "болить голова", start_ms: 2000, end_ms: 2900, speaker: "S2", speaker_confidence: 0.87 },
  ];
  const s = fromCommitted(committed);
  assert.equal(s.turns.length, 2);
  assert.equal(s.turns[0].text, "добрий день що вас турбує");
  assert.equal(s.turns[0].speaker, "S1");
  assert.equal(s.turns[1].speaker, "S2");
  assert.equal(s.lastSeq, 2);
});

// ── finalize payload ─────────────────────────────────────────────────
test("corrections() reports every clinician-ruled segment by start_ms", () => {
  let s = emptyTurns();
  s = applyFinal(s, final(0, "а", "S1", 0.9, 0));
  s = applyFinal(s, final(1, "б", "S2", 0.9, 1000));
  s = setTurnSpeaker(s, s.turns[1].id, "S1");
  assert.deepEqual(corrections(s), [{ seq: 1, start_ms: 1000, speaker: "S1" }]);
});

test("unresolvedCount counts pending and UNKNOWN turns only", () => {
  let s = emptyTurns();
  s = applyFinal(s, final(0, "а", "S1", 0.9));
  s = applyFinal(s, final(1, "б", UNKNOWN, 0.3));
  s = applyFinal(s, final(2, "в"));
  assert.equal(unresolvedCount(s), 2);
});

test("clearPartial drops the live tail at stop", () => {
  const s = clearPartial(applyPartial(emptyTurns(), { seq: 9, text: "…" }));
  assert.equal(s.partial, null);
});
