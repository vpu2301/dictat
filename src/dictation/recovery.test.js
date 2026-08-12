// recovery.test.js — the pure half of preserved-recording recovery.
//
// The IndexedDB half is proven in a real browser by e2e/session-revocation.spec.js;
// faking IDB in node would test the fake. What is tested here is the arithmetic
// and the judgement calls: how long the preserved audio is, how often the
// manifest is written, and — the one with teeth — which ACTIVE manifests are
// safe to relabel as interrupted.

import test from "node:test";
import assert from "node:assert/strict";

import {
  ACTIVE_STALE_MS,
  FRAME_MS,
  RECORDING_STATUS,
  formatDuration,
  interruptionCopy,
  isStaleActive,
  recordingDurationMs,
  shouldCheckpoint,
} from "./recovery.js";

test("duration comes from the wire framing, not a guess", () => {
  assert.equal(FRAME_MS, 20, "20 ms frames is the sprint-03 wire contract");
  assert.equal(recordingDurationMs(0), 0);
  assert.equal(recordingDurationMs(50), 1000);      // one second
  assert.equal(recordingDurationMs(9000), 180_000); // the full ring: three minutes
  // Never negative, never NaN — this number is rendered to a clinician.
  assert.equal(recordingDurationMs(-5), 0);
  assert.equal(recordingDurationMs(undefined), 0);
});

test("durations read as time, in both languages", () => {
  assert.equal(formatDuration(0, "en"), "0 s");
  assert.equal(formatDuration(45_000, "en"), "45 s");
  assert.equal(formatDuration(200_000, "en"), "3 min 20 s");
  assert.equal(formatDuration(200_000, "uk"), "3 хв 20 с");
});

test("checkpoints are ~5 s apart, so a crash costs seconds of counter, not audio", () => {
  assert.equal(shouldCheckpoint(0), false, "nothing to checkpoint before the first frame");
  assert.equal(shouldCheckpoint(1), false);
  assert.equal(shouldCheckpoint(250), true);
  assert.equal(recordingDurationMs(250), 5000);
  assert.equal(shouldCheckpoint(500), true);
  assert.equal(shouldCheckpoint(499), false);
});

test("every interruption reason has words; an unknown one is not invented", () => {
  for (const reason of ["revoked", "expired", "replay", "tab_closed"]) {
    const en = interruptionCopy(reason, "en");
    const uk = interruptionCopy(reason, "uk");
    assert.ok(en && uk, `${reason} has no copy`);
    assert.notEqual(en, uk, `${reason} is untranslated`);
  }
  // A reason nobody has taught this function about gets the neutral phrasing
  // rather than a plausible-sounding wrong explanation of a lost consultation.
  const fallbackEn = interruptionCopy("something_else", "en");
  assert.equal(fallbackEn, interruptionCopy(undefined, "en"));
  assert.notEqual(fallbackEn, interruptionCopy("revoked", "en"));
});

// ── the one with teeth ─────────────────────────────────────────────────

test("a recording touched recently is presumed ALIVE and left alone", () => {
  const now = 1_000_000;
  const live = { status: RECORDING_STATUS.ACTIVE, updatedAt: now - 3000 };
  // Three seconds since its last checkpoint: this is a consultation in
  // progress, possibly in another tab of the same browser. Relabelling it
  // would tell a clinician their running recording had been interrupted.
  assert.equal(isStaleActive(live, now), false);
});

test("a recording nobody has touched for a minute belonged to a tab that died", () => {
  const now = 1_000_000;
  const orphan = { status: RECORDING_STATUS.ACTIVE, updatedAt: now - ACTIVE_STALE_MS - 1 };
  assert.equal(isStaleActive(orphan, now), true);
});

test("an ACTIVE row with no updatedAt falls back to its start time", () => {
  const now = 1_000_000;
  assert.equal(isStaleActive({ status: RECORDING_STATUS.ACTIVE, startedAt: now - 5000 }, now), false);
  assert.equal(isStaleActive({ status: RECORDING_STATUS.ACTIVE, startedAt: now - 600_000 }, now), true);
});

test("only ACTIVE rows are ever promoted", () => {
  const now = 1_000_000;
  const old = now - 10 * ACTIVE_STALE_MS;
  assert.equal(isStaleActive({ status: RECORDING_STATUS.INTERRUPTED, updatedAt: old }, now), false);
  assert.equal(isStaleActive({ status: "something", updatedAt: old }, now), false);
  assert.equal(isStaleActive(null, now), false);
});
