// Sprint 11 step 04 — the sprint doc's VERIFY: the WS `start_session`
// message provably carries encounter_id when a session starts from an
// encounter context, and omits it (not null!) otherwise — the wire model is
// extra="forbid"-shaped, absent means absent.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";

import { msgStartSession } from "./wsClient.js";

test("start_session carries encounter_id when started from an encounter", () => {
  const m = msgStartSession({
    promptId: "p1", language: "uk", targetKind: "generic",
    encounterId: "a61bd2b8-2f02-4fa4-9f0b-348279a2a704",
  });
  assert.equal(m.type, "start_session");
  assert.equal(m.protocol_version, 1);
  assert.equal(m.encounter_id, "a61bd2b8-2f02-4fa4-9f0b-348279a2a704");
});

test("ad-hoc session (no encounter) omits the key entirely", () => {
  const m = msgStartSession({ promptId: "p1", language: "uk" });
  assert.ok(!("encounter_id" in m), "no encounter_id key on ad-hoc sessions");
});

test("template and resume ids ride along unchanged (regression)", () => {
  const m = msgStartSession({
    promptId: "p1", language: "uk", templateId: "t1", resumeSessionId: "s1", encounterId: "e1",
  });
  assert.equal(m.template_id, "t1");
  assert.equal(m.resume_session_id, "s1");
  assert.equal(m.encounter_id, "e1");
});
