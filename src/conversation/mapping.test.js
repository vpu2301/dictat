// Sprint 14 — the doctor/patient mapping state machine.
//
// The property that matters most: once the clinician has answered, nothing the
// server says can change the answer. A stale inference repainting a mapping the
// clinician just set would relabel every turn on screen behind their back.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  emptyMapping, applyHint, applyUpdate, swap, assignRole, roleOf, labelForRole, isKnown,
} from "./mapping.js";

const update = (mapping, over = {}) => ({
  type: "speaker_mapping_updated", mapping, confidence: 0.72,
  rationale: "opener 0.81 vs 0.19", manual: false, ...over,
});

test("no hypothesis is the honest starting point", () => {
  const s = emptyMapping();
  assert.equal(isKnown(s), false);
  assert.equal(roleOf(s, "S1"), null);
  assert.equal(s.source, "none");
});

test("an inference update sets the mapping and pulses ONCE", () => {
  const s = applyUpdate(emptyMapping(), update({ S1: "doctor", S2: "patient" }));
  assert.equal(roleOf(s, "S1"), "doctor");
  assert.equal(roleOf(s, "S2"), "patient");
  assert.equal(s.source, "inference");
  assert.equal(s.pulse, 1);
  // the same hypothesis again is not a change — no second flash
  const again = applyUpdate(s, update({ S1: "doctor", S2: "patient" }));
  assert.equal(again.pulse, 1);
});

test("a hint only fills a gap; it never overrides an inference", () => {
  const hinted = applyHint(emptyMapping(), { S1: "doctor", S2: "patient" });
  assert.equal(hinted.source, "hint");
  const inferred = applyUpdate(hinted, update({ S1: "patient", S2: "doctor" }));
  assert.equal(roleOf(inferred, "S1"), "patient");
  const laterHint = applyHint(inferred, { S1: "doctor", S2: "patient" });
  assert.equal(roleOf(laterHint, "S1"), "patient", "the authoritative channel wins");
});

test("swap freezes immediately and returns the wire mapping", () => {
  const [state, wire] = swap(applyUpdate(emptyMapping(), update({ S1: "doctor", S2: "patient" })));
  assert.deepEqual(wire, { S1: "patient", S2: "doctor" });
  assert.equal(state.frozen, true);
  assert.equal(state.source, "manual");
  assert.equal(state.confidence, 1);
});

test("swap with NO hypothesis commits the conventional reading, frozen", () => {
  const [state, wire] = swap(emptyMapping());
  assert.deepEqual(wire, { S1: "patient", S2: "doctor" });
  assert.equal(state.frozen, true);
});

test("FROZEN: later inference updates are ignored entirely", () => {
  const [frozen] = swap(applyUpdate(emptyMapping(), update({ S1: "doctor", S2: "patient" })));
  const after = applyUpdate(frozen, update({ S1: "doctor", S2: "patient" }, { confidence: 0.95 }));
  assert.equal(roleOf(after, "S1"), "patient", "the clinician's answer stands");
  assert.equal(after.pulse, frozen.pulse, "and nothing flashes");
  const afterHint = applyHint(after, { S1: "doctor", S2: "patient" });
  assert.equal(roleOf(afterHint, "S1"), "patient");
});

test("the server's manual:true ack confirms the freeze without a flash", () => {
  const [frozen] = swap(emptyMapping());
  const acked = applyUpdate(frozen, update({ S1: "patient", S2: "doctor" }, { manual: true, confidence: 1 }));
  assert.equal(acked.frozen, true);
  assert.equal(acked.confidence, 1);
  assert.equal(acked.pulse, frozen.pulse);
});

test("assignRole names one voice and thereby both", () => {
  const [state, wire] = assignRole(emptyMapping(), "S2", "doctor");
  assert.deepEqual(wire, { S2: "doctor", S1: "patient" });
  assert.equal(state.frozen, true);
  assert.equal(labelForRole(state, "doctor"), "S2");
});

test("UNKNOWN and unlabelled segments never resolve to a role", () => {
  const s = applyUpdate(emptyMapping(), update({ S1: "doctor", S2: "patient" }));
  assert.equal(roleOf(s, "UNKNOWN"), null);
  assert.equal(roleOf(s, null), null);
});
