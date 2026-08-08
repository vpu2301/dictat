// chat/data/platformApi.test.js — a recorded stream in, the module's four
// parts out.
//
// TRANSCRIPT below is a REAL response from `evidence-answer` (:8013), captured
// with curl, whitespace aside. The event order it shows is the one stream.py
// locks: header → summary_segment* → detail_segment* → source* → late_source*
// → done. If either side of that contract moves, this test is where it should
// hurt first — the failure it exists to prevent is the one that shipped: a
// client written against a contract nobody had run.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { createPlatformApi } from "./platformApi.js";
import { EvidenceApiError } from "./evidenceApi.js";

const frame = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

const HEADER = {
  answer_id: "0ee02cb5-9051-492d-a108-6cac311031c3",
  question_id: "ce578764-ee37-4c5c-8efa-84ee60f56316",
  mode: "quick_search", locale: "en", verified: false,
  late_sources_expected: true, degraded: true, flags: [],
  pipeline_version: "quick-search-1.0", contract_version: "1.0",
};

const SEGMENT = {
  id: "seg-1", kind: "evidence",
  text: "HbA1c should be measured every three months during dose titration.",
  citations: [{ source_id: "S1", passage_id: "04ec4469-5365-46a3-8ee2-2243b2f842e8" }],
  patient_fact_refs: [],
};

const SOURCE = {
  id: "S1", kind: "corpus", title: "2 Recommendations > 2.1 Monitoring",
  evidence_tier: "other", source_authority: "international",
  document_version_id: "2e9c6151-1bd1-486c-beee-a20ef156ed68",
};

const DONE = {
  answer_id: HEADER.answer_id, status: "ok", provenance_ref: HEADER.answer_id,
  summary_count: 1, detail_count: 0, source_count: 1,
  flags: [
    { code: "partial_synthesis", severity: "warning", message: "uncited_evidence_segment", requires_ack: false },
    { code: "web_unavailable", severity: "info", message: "live web sources were requested but returned nothing", requires_ack: false },
  ],
  degraded: true,
};

const TRANSCRIPT = [
  ": ping\n\n",
  frame("header", { event: "header", header: HEADER }),
  frame("summary_segment", { event: "summary_segment", segment: SEGMENT }),
  frame("source", { event: "source", source: SOURCE }),
  frame("done", { event: "done", done: DONE }),
].join("");

// A Response whose body streams `text` in small pieces, the way a real one does.
const streamingResponse = (text, { ok = true, status = 200 } = {}) => {
  const encoder = new TextEncoder();
  const pieces = text.match(/[\s\S]{1,40}/g) || [];
  let i = 0;
  return {
    ok, status,
    body: {
      getReader: () => ({
        read: async () => (i < pieces.length
          ? { value: encoder.encode(pieces[i++]), done: false }
          : { value: undefined, done: true }),
        releaseLock() {},
      }),
    },
  };
};

const jsonResponse = (status, body) => ({
  ok: false, status, json: async () => body,
});

const apiWith = (fetchImpl, opts = {}) => createPlatformApi({
  baseUrl: "http://answers.test",
  getToken: async () => "tok-1",
  fallback: {},
  fetchImpl,
  ...opts,
});

const collect = async (stream) => {
  const parts = [];
  for await (const part of stream) parts.push(part);
  return parts;
};

test("a recorded stream becomes stages, chunks and one done", async () => {
  const calls = [];
  const api = apiWith(async (url, init) => {
    calls.push({ url, init });
    return streamingResponse(TRANSCRIPT);
  }, { locale: "en" });

  const parts = await collect(api.streamAnswer("What HbA1c target should I aim for?", { language: "en" }));

  assert.deepEqual(parts.filter((p) => p.stage).map((p) => p.stage),
    ["classifying", "searching", "synthesizing"]);
  assert.equal(parts.filter((p) => p.chunk).length, 1);

  const done = parts.at(-1);
  assert.equal(done.done, true);
  assert.equal(done.answer.abstained, false);
  assert.equal(done.answer.recommendation, `${SEGMENT.text} [1]`);
  assert.deepEqual(done.answer.citations.map((c) => c.title), [SOURCE.title]);
  // Both flags on the terminal event reach the reader as prose.
  assert.match(done.answer.limitations, /web sources were unavailable/);
  assert.match(done.answer.limitations, /synthesis is partial/);
});

test("the request is one POST /answers with no header the CORS list forbids", async () => {
  let seen = null;
  const api = apiWith(async (url, init) => { seen = { url, init }; return streamingResponse(TRANSCRIPT); });
  await collect(api.streamAnswer("q q q", { language: "en" }));

  assert.equal(seen.url, "http://answers.test/answers");
  assert.equal(seen.init.method, "POST");
  // Accept, Accept-Language, Authorization, Content-Language, Content-Type is
  // the service's whole allow-list. Anything else fails the browser preflight
  // and the POST never leaves the tab.
  assert.deepEqual(Object.keys(seen.init.headers).sort(),
    ["Accept", "Authorization", "Content-Type"]);
  assert.equal(seen.init.headers.Authorization, "Bearer tok-1");
  assert.deepEqual(JSON.parse(seen.init.body), { question: "q q q", mode: "quick_search", locale: "en" });
});

test("a late source lands in the answer even after done", async () => {
  const late = { ...SOURCE, id: "S2", title: "A page fetched after the fact", kind: "web",
    web: { url: "https://who.int/x", domain: "who.int", trust_tier: "international_organization", accessed_at: "2026-08-07T20:00:00Z" } };
  const api = apiWith(async () => streamingResponse(
    TRANSCRIPT + frame("late_source", { event: "late_source", source: late }),
  ));

  const parts = await collect(api.streamAnswer("q q q", {}));
  const finals = parts.filter((p) => p.done);
  assert.equal(finals.length, 2, "the answer is re-delivered rather than losing the source");
  assert.deepEqual(finals.at(-1).answer.citations.map((c) => c.id), ["S1", "S2"]);
});

test("an error AFTER done does not take a finished answer off the screen", async () => {
  // `answer_not_persisted`: the answer streamed, only its storage failed.
  const api = apiWith(async () => streamingResponse(
    TRANSCRIPT + frame("error", { event: "error", error: { code: "answer_not_persisted", detail: "…", retryable: true } }),
  ));
  const parts = await collect(api.streamAnswer("q q q", {}));
  assert.equal(parts.filter((p) => p.done).length, 1);
});

test("an error BEFORE done is raised, with the retry the service says it has", async () => {
  const api = apiWith(async () => streamingResponse(
    frame("header", { event: "header", header: HEADER })
    + frame("error", { event: "error", error: { code: "pipeline_failed", detail: "TimeoutError", retryable: true } }),
  ));
  await assert.rejects(collect(api.streamAnswer("q q q", {})), (e) => {
    assert.ok(e instanceof EvidenceApiError);
    assert.equal(e.code, "pipeline_failed");
    assert.equal(e.retryable, true);
    assert.equal(e.message, "TimeoutError");
    return true;
  });
});

test("an HTTP failure surfaces the problem+json sentence", async () => {
  const api = apiWith(async () => jsonResponse(422, {
    type: "about:blank", title: "Unprocessable Content", status: 422,
    detail: "Request validation failed.", instance: "urn:uuid:3a4f",
  }));
  await assert.rejects(collect(api.streamAnswer("q q q", {})), (e) => {
    assert.equal(e.status, 422);
    assert.equal(e.message, "Request validation failed.");
    assert.equal(e.retryable, false, "a rejected request is not fixed by sending it again");
    return true;
  });
});

test("a 401 buys exactly one refresh and one retry", async () => {
  const asked = [];
  let attempt = 0;
  const api = createPlatformApi({
    baseUrl: "http://answers.test",
    getToken: async ({ refresh } = {}) => { asked.push(!!refresh); return refresh ? "tok-2" : "tok-1"; },
    fallback: {},
    fetchImpl: async (url, init) => {
      attempt += 1;
      if (attempt === 1) return { ok: false, status: 401, json: async () => ({}) };
      assert.equal(init.headers.Authorization, "Bearer tok-2");
      return streamingResponse(TRANSCRIPT);
    },
  });

  const parts = await collect(api.streamAnswer("q q q", {}));
  assert.deepEqual(asked, [false, true]);
  assert.equal(parts.at(-1).done, true);
});

test("a session that cannot produce a token fails as auth, not as an outage", async () => {
  const api = createPlatformApi({
    baseUrl: "http://answers.test",
    getToken: async () => null,
    fallback: {},
    fetchImpl: async () => { throw new Error("must not be called"); },
  });
  await assert.rejects(collect(api.streamAnswer("q q q", {})), (e) => {
    assert.equal(e.status, 401);
    assert.equal(e.code, "missing_token");
    return true;
  });
});

test("an unreachable service is a retryable network error, in the UI language", async () => {
  const api = apiWith(async () => { throw new TypeError("Failed to fetch"); }, { locale: "uk" });
  await assert.rejects(collect(api.streamAnswer("q q q", {})), (e) => {
    assert.equal(e.code, "network");
    assert.equal(e.retryable, true);
    assert.match(e.message, /з’єднатися/);
    return true;
  });
});

test("an aborted stream ends quietly rather than reporting a failure", async () => {
  const controller = new AbortController();
  const api = apiWith(async () => {
    controller.abort();
    throw new DOMException("aborted", "AbortError");
  });
  const parts = await collect(api.streamAnswer("q q q", { signal: controller.signal }));
  assert.deepEqual(parts.map((p) => p.stage), ["classifying"]);
});

test("what this API does not serve is delegated, not faked", async () => {
  const fallback = { getAgents: async () => ["called"] };
  const api = createPlatformApi({
    baseUrl: "http://answers.test", getToken: async () => "t", fallback,
    fetchImpl: async () => streamingResponse(TRANSCRIPT),
  });
  assert.deepEqual(await api.getAgents(), ["called"]);
  assert.equal(api.live, true);
  assert.deepEqual(await api.getSessions(), []);
});
