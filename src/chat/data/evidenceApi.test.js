// chat/data/evidenceApi.test.js — a recorded stream in, the module's four
// parts out.
//
// The transcript below is the event order the backend's SSE contract locks:
// stream_started → status* → metadata → partial* → final → done. If either
// side of that contract moves, this test is where it should hurt first.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { createEvidenceApi, EvidenceApiError } from "./evidenceApi.js";

const frame = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

const FINAL = {
  query_history_id: "qh-1",
  conversation_id: "cv-1",
  mode: "quick_answer",
  answer_md: "## Recommendation\nStart a DOAC [1].\n\n## Evidence\nApixaban lowered stroke risk [1].",
  citations: [{
    source: "ESC", source_id: "af-2024", title: "AF guideline",
    url: "https://esc.test/af", evidence_level: "Ia", relevance_score: 0.93,
  }],
  confidence: 0.88,
  evidence_level: "Ia",
  abstained: false,
  latency_ms: 4100,
  model_id: "medical-reasoning",
  prompt_version: "quick_answer.synthesis.en@v1.0.0",
  disclaimer_de: "…",
  disclaimer_en: "…",
};

const TRANSCRIPT = [
  frame("stream_started", { stream_id: "s-1", query_history_id: "qh-1", estimated_latency_ms: 5000, mode: "quick_answer" }),
  frame("status", { stage: "classifying", message_de: "", message_en: "" }),
  frame("status", { stage: "searching", message_de: "", message_en: "" }),
  frame("status", { stage: "drugs", message_de: "", message_en: "" }),
  frame("metadata", { entities: ["atrial fibrillation", "apixaban"], intent: "therapy", graph_paths_count: 0 }),
  frame("status", { stage: "synthesizing", message_de: "", message_en: "" }),
  frame("partial", { delta: "## Recommendation\nStart a DOAC [1]." }),
  frame("partial", { delta: "\n\n## Evidence\nApixaban lowered stroke risk [1]." }),
  frame("status", { stage: "formatting", message_de: "", message_en: "" }),
  frame("final", { response: FINAL }),
  frame("done", {}),
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

const apiWith = (fetchImpl, opts = {}) => createEvidenceApi({
  baseUrl: "http://evidence.test",
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

test("a live stream produces stages, entities, chunks and one answer", async () => {
  const api = apiWith(async () => streamingResponse(TRANSCRIPT));
  const parts = await collect(api.streamAnswer("apixaban in AF?", { language: "en" }));

  // The two stages the module does not draw are folded into ones it does, so
  // the progress list never stalls while the pipeline is busy.
  assert.deepEqual(
    parts.filter((p) => p.stage).map((p) => p.stage),
    ["classifying", "searching", "searching", "synthesizing", "verifying"],
  );
  assert.deepEqual(parts.find((p) => p.entities).entities, ["atrial fibrillation", "apixaban"]);

  // Concatenated deltas equal answer_md exactly — the contract's own guarantee,
  // and what makes the streamed text and the final answer the same document.
  const streamed = parts.filter((p) => p.chunk).map((p) => p.chunk).join("");
  assert.equal(streamed, FINAL.answer_md);

  const done = parts.at(-1);
  assert.equal(done.done, true);
  assert.equal(done.streamId, "s-1");
  assert.equal(done.answer.recommendation, "Start a DOAC [1].");
  assert.equal(done.answer.summary, "Apixaban lowered stroke risk [1].");
  assert.equal(done.answer.grade, "Ia");
  assert.equal(done.answer.citations[0].id, "ESC:af-2024");
  assert.ok(done.answer.latencyMs >= 0);
});

test("the request carries the question, the mode and a de-identified patient", async () => {
  let sent = null;
  const api = apiWith(async (url, init) => {
    sent = { url, init, body: JSON.parse(init.body) };
    return streamingResponse(TRANSCRIPT);
  });

  await collect(api.streamAnswer("dose in renal impairment?", {
    language: "de",
    patient: {
      id: "p1", name: "Manfred Weber", mrn: "MRN-1",
      dob: `${new Date().getFullYear() - 67}-01-01`, sex: "m",
      diagnoses: [{ code: "I48.0", label: "AF" }],
      medications: ["Apixaban 5 mg"],
      labs: [{ name: "eGFR", value: "54" }],
    },
  }));

  assert.equal(sent.url, "http://evidence.test/api/v1/query");
  assert.equal(sent.init.headers.Authorization, "Bearer tok-1");
  assert.ok(sent.init.headers["Idempotency-Key"], "a retry must be safe");
  assert.equal(sent.body.mode, "quick_answer");
  assert.equal(sent.body.language, "de");
  assert.equal(sent.body.patient_context.age_range, "65-79");
  // The boundary, asserted on the actual request body: no identifier crosses.
  assert.equal(sent.init.body.includes("Weber"), false);
  assert.equal(sent.init.body.includes("MRN-1"), false);
});

test("no patient means no patient_context field at all", async () => {
  let body = null;
  const api = apiWith(async (_url, init) => { body = JSON.parse(init.body); return streamingResponse(TRANSCRIPT); });
  await collect(api.streamAnswer("q", {}));
  assert.equal("patient_context" in body, false);
});

test("an answer language the pipeline cannot write is never claimed", async () => {
  // The module's UI runs in Ukrainian; the API takes de|en only. Asking for
  // "uk" must produce an English answer, not a request the backend rejects.
  let body = null;
  const api = apiWith(async (_url, init) => { body = JSON.parse(init.body); return streamingResponse(TRANSCRIPT); },
    { locale: "uk" });
  await collect(api.streamAnswer("q", { language: "uk" }));
  assert.equal(body.language, "en");
});

test("a typed error frame becomes a retryable error with a readable message", async () => {
  const stream = frame("stream_started", { stream_id: "s-2" })
    + frame("error", { code: "hf_timeout", message_de: "…", message_en: "The model did not respond in time.", request_id: "r-9" })
    + frame("done", {});
  const api = apiWith(async () => streamingResponse(stream));

  await assert.rejects(
    () => collect(api.streamAnswer("q", {})),
    (error) => {
      assert.ok(error instanceof EvidenceApiError);
      assert.equal(error.code, "hf_timeout");
      assert.equal(error.retryable, true);
      assert.match(error.message, /did not respond in time/);
      return true;
    },
  );
});

test("a cancelled stream ends quietly — the thread already shows it stopped", async () => {
  const stream = frame("stream_started", { stream_id: "s-3" })
    + frame("error", { code: "cancelled", message_de: "…", message_en: "Cancelled.", request_id: "r" })
    + frame("done", {});
  const api = apiWith(async () => streamingResponse(stream));
  const parts = await collect(api.streamAnswer("q", {}));
  assert.equal(parts.some((p) => p.done), false);
});

test("an abstention arrives as an answer, not as a failure", async () => {
  const stream = frame("stream_started", { stream_id: "s-4" })
    + frame("final", {
      response: {
        ...FINAL, abstained: true, abstention_reason: "no_retrieval_hits",
        answer_md: "", citations: [], confidence: 0.1,
      },
    })
    + frame("error", { code: "abstained", message_de: "…", message_en: "…", request_id: "r" })
    + frame("done", {});
  const api = apiWith(async () => streamingResponse(stream));

  const parts = await collect(api.streamAnswer("what is the capital of France?", {}));
  const done = parts.find((p) => p.done);
  assert.equal(done.answer.abstained, true);
  assert.match(done.answer.recommendation, /no sources|No answer/i);
});

test("the concurrency cap is reported as itself, not as a dead service", async () => {
  const api = apiWith(async () => ({
    ok: false,
    status: 429,
    json: async () => ({
      code: "stream_limit_exceeded", message_en: "Too many concurrent streams.",
      message_de: "…", request_id: "r-1", details: { limit: 3, retry_after_s: 5 },
    }),
  }));

  await assert.rejects(() => collect(api.streamAnswer("q", {})), (error) => {
    assert.equal(error.status, 429);
    assert.equal(error.code, "stream_limit_exceeded");
    assert.equal(error.retryable, true);
    return true;
  });
});

test("an unreachable backend fails with a message, not a stack trace", async () => {
  const api = apiWith(async () => { throw new TypeError("Failed to fetch"); });
  await assert.rejects(() => collect(api.streamAnswer("q", {})), (error) => {
    assert.equal(error.code, "network");
    assert.match(error.message, /Could not reach/);
    return true;
  });
});

test("a missing token stops the send before any request is made", async () => {
  let called = false;
  const api = createEvidenceApi({
    baseUrl: "http://evidence.test",
    getToken: async () => "",
    fallback: {},
    fetchImpl: async () => { called = true; return streamingResponse(TRANSCRIPT); },
  });
  await assert.rejects(() => collect(api.streamAnswer("q", {})), { code: "missing_token" });
  assert.equal(called, false);
});

test("history starts empty against a live backend", async () => {
  // Scripted demo threads sitting beside real answers, with nothing to tell
  // them apart, is the failure this prevents.
  const api = apiWith(async () => streamingResponse(TRANSCRIPT));
  assert.deepEqual(await api.getSessions(), []);
  api.saveSession({ id: "s1", title: "Real one", updatedAt: new Date().toISOString(), messages: [{}] });
  const rows = await api.getSessions();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].messageCount, 1);
});
