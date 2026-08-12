// Units for cancelling a batch ASR job.
//
//   node --test src/api/asr.cancel.test.js
//
// Regression: pressing Cancel on a RUNNING transcription appeared to do
// nothing. The service can only ASK a running job to stop — it sets
// `cancel_requested` and leaves the status alone, and the worker acts on it at
// its next checkpoint — but the client collapsed that into the same "cancelled"
// as a queued job being killed outright. So the screen said the job was
// cancelled while it went right on transcribing, and the Cancel button sat
// there unchanged.
import { test } from "node:test";
import assert from "node:assert/strict";

import { cancelJob, isCancelling } from "./asr.js";

function installFetch(body, status = 202) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init?.method });
    return {
      ok: status < 400, status,
      headers: { get: () => "application/json" },
      json: async () => body,
    };
  };
  return calls;
}

test("a queued job is cancelled outright", async () => {
  const calls = installFetch({ status: "cancelled" });
  assert.equal(await cancelJob("job-1"), "cancelled");
  assert.equal(calls[0].method, "DELETE");
  assert.match(calls[0].url, /\/asr\/jobs\/job-1$/);
});

test("a running job can only be asked to stop", async () => {
  installFetch({ status: "cancel_requested" });
  assert.equal(await cancelJob("job-2"), "cancel_requested");
});

test("an unrecognised outcome is treated as still running, not as stopped", async () => {
  // Claiming a job stopped when we do not know that it did is the failure
  // this whole change exists to remove — so anything but an explicit
  // "cancelled" leaves the screen waiting for the worker.
  installFetch({});
  assert.equal(await cancelJob("job-3"), "cancel_requested");
  installFetch(null);
  assert.equal(await cancelJob("job-4"), "cancel_requested");
});

// ── isCancelling: "stopping" is a state of its own ──────────────────────

test("a job carrying the flag while still active is stopping", () => {
  assert.equal(isCancelling({ status: "running", cancel_requested: true }), true);
  assert.equal(isCancelling({ status: "queued", cancel_requested: true }), true);
});

test("a job that has already stopped is not stopping", () => {
  // The flag survives into the terminal row; the state does not.
  assert.equal(isCancelling({ status: "cancelled", cancel_requested: true }), false);
  assert.equal(isCancelling({ status: "complete", cancel_requested: true }), false);
});

test("an untouched running job is not stopping", () => {
  assert.equal(isCancelling({ status: "running" }), false);
  assert.equal(isCancelling({ status: "running", cancel_requested: false }), false);
  // A service that does not put the flag on the wire at all must not read as
  // stopping — the page falls back to what the DELETE told it.
  assert.equal(isCancelling(null), false);
  assert.equal(isCancelling(undefined), false);
});
