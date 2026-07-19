// Units for the dictation-assign API pieces (sprint: dictation-assign):
// the by-source-job chunking/merge and the pure error classifier.
//
//   node --test src/api/reports.assign.test.js
import { test } from "node:test";
import assert from "node:assert/strict";

import { reportsBySourceJobs, classifyAssignError, BY_SOURCE_JOB_CHUNK } from "./reports.js";
import { ApiError } from "./client.js";

// ── reportsBySourceJobs: chunking + merge ────────────────────────────────
// Stub global.fetch (client.js goes through it) and record the id counts.

function installFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    const body = handler(String(url), calls.length);
    return {
      ok: true, status: 200,
      headers: { get: () => "application/json" },
      json: async () => body,
    };
  };
  return calls;
}

test("reportsBySourceJobs: chunks ids to the backend's 200-id ceiling", async () => {
  const calls = installFetch((url) => {
    const ids = new URL(url, "http://x").searchParams.get("ids").split(",");
    // Echo one row per id so we can verify the merge covers every chunk.
    return ids.map((jid) => ({ asr_job_id: jid, report_id: `r-${jid}`, code: `REP-${jid}`, status: "draft", patient_id: "p1" }));
  });

  const ids = Array.from({ length: 450 }, (_, i) => `job-${i}`);
  const map = await reportsBySourceJobs(ids);

  assert.equal(BY_SOURCE_JOB_CHUNK, 200);
  assert.equal(calls.length, 3, "450 ids → 3 requests (200 + 200 + 50)");
  const perCall = calls.map((c) => new URL(c.url, "http://x").searchParams.get("ids").split(",").length);
  assert.deepEqual(perCall, [200, 200, 50]);
  assert.equal(map.size, 450, "every id present in the merged map");
  assert.deepEqual(map.get("job-0"), { report_id: "r-job-0", code: "REP-job-0", status: "draft", patient_id: "p1" });
});

test("reportsBySourceJobs: dedupes ids and drops falsy before chunking", async () => {
  const calls = installFetch(() => []);
  await reportsBySourceJobs(["a", "a", "", null, "b", undefined, "b"]);
  const ids = new URL(calls[0].url, "http://x").searchParams.get("ids").split(",");
  assert.deepEqual(ids.sort(), ["a", "b"]);
});

test("reportsBySourceJobs: empty input makes no request", async () => {
  const calls = installFetch(() => []);
  const map = await reportsBySourceJobs([]);
  assert.equal(calls.length, 0);
  assert.equal(map.size, 0);
});

// ── classifyAssignError: pure error mapping ──────────────────────────────

test("classifyAssignError: 409 already_assigned surfaces report link (RFC 7807 flat body)", () => {
  const err = new ApiError(409, { code: "already_assigned", report_id: "r1", report_code: "REP-2026-00381" });
  assert.deepEqual(classifyAssignError(err),
    { kind: "already_assigned", report_id: "r1", report_code: "REP-2026-00381" });
});

test("classifyAssignError: unwraps FastAPI {detail:{…}} bodies too", () => {
  const err = new ApiError(409, { detail: { code: "already_assigned", report_id: "r2", report_code: "REP-9" } });
  assert.deepEqual(classifyAssignError(err),
    { kind: "already_assigned", report_id: "r2", report_code: "REP-9" });
});

test("classifyAssignError: parses the live shape — detail as a Python-repr string", () => {
  // Exactly what report-service returns (verified live 2026-07-18): the inner
  // HTTPException detail dict is stringified into the RFC 7807 `detail` field.
  const err = new ApiError(409, {
    type: "about:blank", title: "Conflict", status: 409,
    detail: "{'code': 'already_assigned', 'detail': 'this transcription is already assigned to a report', 'report_id': 'b1ef9848-12e3-413c-a35b-b8665abbd563', 'report_code': 'REP-2026-00381'}",
    instance: "urn:uuid:8d21ac5f",
  });
  assert.deepEqual(classifyAssignError(err), {
    kind: "already_assigned",
    report_id: "b1ef9848-12e3-413c-a35b-b8665abbd563",
    report_code: "REP-2026-00381",
  });
});

test("classifyAssignError: parses job_status out of a stringified 409 detail", () => {
  const err = new ApiError(409, { detail: "{'job_status': 'running', 'detail': 'not complete'}" });
  assert.deepEqual(classifyAssignError(err), { kind: "not_complete", job_status: "running" });
});

test("classifyAssignError: 409 with job_status = not complete yet", () => {
  const err = new ApiError(409, { job_status: "running" });
  assert.deepEqual(classifyAssignError(err), { kind: "not_complete", job_status: "running" });
});

test("classifyAssignError: 422 field codes", () => {
  for (const code of ["patient_not_found", "template_not_found", "empty_transcript", "no_templates"]) {
    assert.deepEqual(classifyAssignError(new ApiError(422, { code })), { kind: "field", code });
  }
});

test("classifyAssignError: 410 erased, 503 unavailable, and unknown fall-through", () => {
  assert.equal(classifyAssignError(new ApiError(410, {})).kind, "erased");
  assert.equal(classifyAssignError(new ApiError(503, { code: "asr_service_unavailable" })).kind, "unavailable");
  assert.equal(classifyAssignError(new ApiError(500, {})).kind, "unknown");
});
