// generation.test.js — sprint 15: the Layer C client's ONE doctrine is that
// silence is a valid answer. A typing clinician must never see an error
// because ghost text failed to materialise, so every non-200 resolves to null
// and nothing in this module ever throws at the caller.
//   npm run test:unit
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { inlineCompletion, generationReadyz, completionLanguage, MAX_PREFIX_CHARS } from "./generation.js";

const realFetch = globalThis.fetch;
let calls = [];

function stub(responder) {
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return responder(String(url), init);
  };
}

const res = (status, body, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (k) => headers[k.toLowerCase()] ?? null },
  json: async () => body,
});

beforeEach(() => { calls = []; });
afterEach(() => { globalThis.fetch = realFetch; });

const REQ = {
  reportId: "11111111-1111-1111-1111-111111111111",
  sectionKey: "anamnesis",
  textBeforeCursor: "Пацієнт скаржиться на біль у",
  language: "uk",
};

test("200 → the completion, normalized for the caller", async () => {
  stub(() => res(200, {
    request_id: "req-1",
    completion: "плечі, що посилюється при навантаженні.",
    model: "gemma3:1b",
    latency_ms: 952,
  }));
  const r = await inlineCompletion(REQ);
  assert.equal(r.completion, "плечі, що посилюється при навантаженні.");
  assert.equal(r.requestId, "req-1");
  assert.equal(r.model, "gemma3:1b");
  assert.equal(r.latencyMs, 952);
});

test("204 — the common answer — is silence, not an error", async () => {
  stub(() => res(204, null));
  assert.equal(await inlineCompletion(REQ), null);
});

test("500, 403 and a dead network are equally silent", async () => {
  stub(() => res(500, { detail: "boom" }));
  assert.equal(await inlineCompletion(REQ), null);
  stub(() => res(403, { detail: "nope" }));
  assert.equal(await inlineCompletion(REQ), null);
  globalThis.fetch = async () => { throw new Error("ECONNREFUSED"); };
  assert.equal(await inlineCompletion(REQ), null);
});

test("an empty completion string is treated as no completion", async () => {
  stub(() => res(200, { request_id: "r", completion: "   ".trim(), model: "m", latency_ms: 1 }));
  assert.equal(await inlineCompletion(REQ), null);
});

test("429 says 'stop asking', with the server's own Retry-After", async () => {
  stub(() => res(429, null, { "retry-after": "12" }));
  const r = await inlineCompletion(REQ);
  assert.equal(r.rateLimited, true);
  assert.equal(r.retryAfterMs, 12_000);
});

test("the wire body is exactly the four keys the backend allows (extra=forbid)", async () => {
  stub(() => res(204, null));
  await inlineCompletion(REQ);
  const body = JSON.parse(calls[0].init.body);
  assert.deepEqual(Object.keys(body).sort(),
    ["language", "report_id", "section_key", "text_before_cursor"]);
  assert.equal(body.report_id, REQ.reportId);
  assert.equal(body.section_key, "anamnesis");
});

test("the prefix is capped at 1000 chars — and the TAIL is what survives", async () => {
  stub(() => res(204, null));
  const long = "x".repeat(1500) + "КІНЕЦЬ";
  await inlineCompletion({ ...REQ, textBeforeCursor: long });
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.text_before_cursor.length, MAX_PREFIX_CHARS);
  assert.ok(body.text_before_cursor.endsWith("КІНЕЦЬ"), "the words nearest the caret are kept");
});

test("no report id ⇒ no request leaves the browser", async () => {
  stub(() => res(200, { request_id: "r", completion: "nope", model: "m", latency_ms: 1 }));
  assert.equal(await inlineCompletion({ ...REQ, reportId: null }), null);
  assert.equal(await inlineCompletion({ ...REQ, textBeforeCursor: "" }), null);
  assert.equal(calls.length, 0);
});

test("language collapses to the backend's uk|en enum", () => {
  assert.equal(completionLanguage("uk"), "uk");
  assert.equal(completionLanguage("en"), "en");
  assert.equal(completionLanguage("pl"), "en");
  assert.equal(completionLanguage(undefined), "en");
});

test("readyz IS the feature flag; unreachable means off, never an error", async () => {
  stub(() => res(200, { status: "ready", layer_c_enabled: true, model: "gemma3:1b" }));
  assert.deepEqual(await generationReadyz(), { enabled: true, model: "gemma3:1b", reachable: true });

  stub(() => res(200, { status: "ready", layer_c_enabled: false, model: null }));
  assert.equal((await generationReadyz()).enabled, false);

  globalThis.fetch = async () => { throw new Error("no such host"); };
  assert.deepEqual(await generationReadyz(), { enabled: false, model: null, reachable: false });
});
