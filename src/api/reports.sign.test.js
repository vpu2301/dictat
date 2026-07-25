// 2026-07-24 — classifySignError: the 409 report_not_signable arrives with a
// Python-repr detail string ({'error': …, 'current_status': …}); the FE must
// name the real cause instead of "rejecting" a correct password.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";

import { classifySignError } from "./reports.js";

const err = (status, detail) => ({ status, problem: { detail } });

test("409 report_not_signable → not_signable with the parsed current_status", () => {
  assert.deepEqual(
    classifySignError(err(409,
      "{'error': 'report_not_signable', 'current_status': 'draft', 'detail': 'only a finalized report or a drafted amendment can be signed'}")),
    { kind: "not_signable", current_status: "draft" });
  assert.deepEqual(
    classifySignError(err(409,
      "{'error': 'report_not_signable', 'current_status': 'signed', 'detail': '…'}")),
    { kind: "not_signable", current_status: "signed" });
});

test("401/423/503 map to wrong_password/locked/unavailable", () => {
  assert.deepEqual(classifySignError({ status: 401 }), { kind: "wrong_password" });
  assert.deepEqual(classifySignError({ status: 423 }), { kind: "locked" });
  assert.deepEqual(classifySignError({ status: 503 }), { kind: "unavailable" });
});

test("anything else is unknown with the message preserved", () => {
  assert.deepEqual(classifySignError({ status: 500, message: "boom" }),
    { kind: "unknown", message: "boom" });
  // A 409 that is NOT report_not_signable (e.g. version conflict) stays unknown.
  assert.equal(classifySignError(err(409, "{'code': 'optimistic_lock_mismatch'}")).kind, "unknown");
});
