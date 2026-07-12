// node --test unit tests for the telemetry sink (npm run test:unit).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createTelemetrySink,
  FLUSH_TRIGGER,
  MAX_QUEUE,
  CIRCUIT_PAUSE_MS,
  FLUSH_INTERVAL_MS,
} from "./telemetry.js";

// Manual clock + scheduler so flush timing is fully deterministic.
function fakeClock() {
  let t = 0;
  let nextId = 0;
  const timers = new Map();
  return {
    now: () => t,
    setTimeoutFn: (fn, delay) => {
      const id = ++nextId;
      timers.set(id, { at: t + Math.max(0, delay), fn });
      return id;
    },
    clearTimeoutFn: (id) => timers.delete(id),
    async tick(ms) {
      const target = t + ms;
      for (;;) {
        const due = [...timers.entries()]
          .filter(([, v]) => v.at <= target)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        t = Math.max(t, due[1].at);
        timers.delete(due[0]);
        due[1].fn();
        await settle();
      }
      t = target;
      await settle();
    },
  };
}

// Let sequential awaited sends run to completion.
async function settle() {
  for (let i = 0; i < 64; i++) await Promise.resolve();
}

function makeSink({ failing = () => false } = {}) {
  const clock = fakeClock();
  const sent = [];
  const send = async (event, init) => {
    if (failing(event)) throw new Error("boom");
    sent.push({ event, init });
  };
  const sink = createTelemetrySink({
    send,
    now: clock.now,
    setTimeoutFn: clock.setTimeoutFn,
    clearTimeoutFn: clock.clearTimeoutFn,
  });
  return { sink, sent, clock };
}

const shown = (rid, extra = {}) => ({
  request_id: rid, event: "shown_only", prefix: "зад",
  phrase_id: "phr-1", context: { field: "anamnesis" }, ...extra,
});

test("event mapping — exact outbound payload shapes", async () => {
  const { sink, sent, clock } = makeSink();
  sink.track(shown("r1"));
  sink.track({
    request_id: "r1", event: "accepted", prefix: "зад",
    phrase_id: "phr-1", context: { field: "anamnesis", index: 0 },
  });
  sink.track({
    request_id: "r2", event: "accepted", prefix: "/vit",
    snippet_id: "snip-1", context: { field: "anamnesis", index: 1 },
  });
  sink.track({
    request_id: "r3", event: "rejected", prefix: "зад",
    context: { field: "anamnesis" },
  });
  await clock.tick(FLUSH_INTERVAL_MS);

  assert.equal(sent.length, 4);
  const [s, a1, a2, r] = sent.map((x) => x.event);
  assert.deepEqual(Object.keys(s).sort(), ["context", "event", "phrase_id", "prefix", "request_id"]);
  assert.deepEqual(s.context, { field: "anamnesis" }); // no index on shown
  assert.deepEqual(Object.keys(a1.context), ["field", "index"]);
  assert.equal(a1.phrase_id, "phr-1");
  assert.equal("snippet_id" in a1, false); // phrase XOR snippet
  assert.equal(a2.snippet_id, "snip-1");
  assert.equal("phrase_id" in a2, false);
  // rejected carries NO ids — its impression was logged by shown_only
  assert.deepEqual(Object.keys(r).sort(), ["context", "event", "prefix", "request_id"]);
});

test("dedup — one shown_only per request_id", async () => {
  const { sink, sent, clock } = makeSink();
  sink.track(shown("r1"));
  sink.track(shown("r1")); // arrow-cycling re-render is not a new show
  sink.track(shown("r1"));
  await clock.tick(FLUSH_INTERVAL_MS);
  assert.equal(sent.length, 1);
});

test("accept supersedes the pending rejected for the same request", async () => {
  const { sink, sent, clock } = makeSink();
  sink.track({ request_id: "r1", event: "rejected", prefix: "з" });
  sink.track({ request_id: "r1", event: "accepted", prefix: "з", phrase_id: "p" });
  await clock.tick(FLUSH_INTERVAL_MS);
  assert.deepEqual(sent.map((x) => x.event.event), ["accepted"]);
});

test("batching — never one POST per keystroke", async () => {
  const { sink, sent, clock } = makeSink();
  for (let i = 0; i < 15; i++) sink.track(shown(`r${i}`));
  // nothing goes out synchronously with typing
  assert.equal(sent.length, 0);
  // the 10th event armed an immediate flush; the timer drains the queue
  await clock.tick(0);
  assert.ok(sent.length >= FLUSH_TRIGGER, `flush-at-trigger drained ${sent.length}`);
  await clock.tick(FLUSH_INTERVAL_MS);
  assert.equal(sent.length, 15); // remainder on the 2 s timer, all delivered
});

test("bounded queue — drop-oldest beyond the cap, no exception", async () => {
  const { sink } = makeSink();
  // stall flushing entirely: no ticks happen, so track() only queues
  for (let i = 0; i < 250; i++) sink.track(shown(`r${i}`));
  assert.equal(sink.queue.length, MAX_QUEUE);
  assert.equal(sink.queue[0].request_id, "r50"); // r0..r49 dropped
});

test("circuit — one retry, 30 s pause, then resume", async () => {
  let failUntil = Infinity;
  let attempts = 0;
  const clock = fakeClock();
  const sent = [];
  const sink = createTelemetrySink({
    send: async (event) => {
      attempts++;
      if (clock.now() < failUntil) throw new Error("500");
      sent.push(event);
    },
    now: clock.now,
    setTimeoutFn: clock.setTimeoutFn,
    clearTimeoutFn: clock.clearTimeoutFn,
  });

  sink.track(shown("r1"));
  await clock.tick(FLUSH_INTERVAL_MS);
  assert.equal(attempts, 2); // original + exactly one retry
  assert.equal(sent.length, 0);

  // While the circuit is open nothing more is attempted.
  await clock.tick(5_000);
  assert.equal(attempts, 2);

  // After the pause the flusher resumes and delivers.
  failUntil = 0;
  await clock.tick(CIRCUIT_PAUSE_MS);
  assert.equal(sent.length, 1);
});

test("page-hide flush uses keepalive fetch (NOT sendBeacon)", async () => {
  const { sink, sent } = makeSink();
  sink.track(shown("r1"));
  sink.track(shown("r2"));
  sink.flushRemainderKeepalive();
  assert.equal(sent.length, 2);
  for (const s of sent) assert.deepEqual(s.init, { keepalive: true });
  assert.equal(sink.queue.length, 0);
});

test("privacy tripwire — outbound keys are whitelisted, context ≤ {field,index}", async () => {
  const { sink, sent, clock } = makeSink();
  sink.track({
    request_id: "r1", event: "shown_only", prefix: "зад", phrase_id: "p",
    preceding_text: "ПАЦІЄНТ ІВАН СЕКРЕТ",           // must never leave
    document_text: "SECRET",
    context: { field: "anamnesis", index: 2, preceding_text: "SECRET", patient: "SECRET" },
  });
  sink.track({
    request_id: "r2", event: "accepted", prefix: "зад", phrase_id: "p",
    context: { field: "anamnesis", index: 1, patient_id: "SECRET" },
  });
  await clock.tick(FLUSH_INTERVAL_MS);

  const wire = JSON.stringify(sent.map((x) => x.event));
  assert.ok(!wire.includes("SECRET"), "privacy budget exceeded");
  const allowed = new Set(["request_id", "event", "prefix", "phrase_id", "snippet_id", "context"]);
  for (const { event } of sent) {
    for (const k of Object.keys(event)) assert.ok(allowed.has(k), `illegal key ${k}`);
    if (event.context) {
      for (const k of Object.keys(event.context)) {
        assert.ok(["field", "index"].includes(k), `illegal context key ${k}`);
      }
    }
  }
  // index only ever appears on accepted
  assert.equal(sent[0].event.context.index, undefined);
  assert.equal(sent[1].event.context.index, 1);
});

test("timeout event (degraded >300 ms) — request_id + prefix only, no ids", async () => {
  const { sink, sent, clock } = makeSink();
  sink.track({
    request_id: "r-slow", event: "timeout", prefix: "зад",
    phrase_id: "p", snippet_id: "s",          // must be stripped — timeout carries no ids
    context: { field: "anamnesis", index: 2 }, // index is accepted-only
  });
  await clock.tick(FLUSH_INTERVAL_MS);
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].event, {
    request_id: "r-slow",
    event: "timeout",
    prefix: "зад",
    context: { field: "anamnesis" },
  });
});

test("prefix is capped at 80 chars (suggest parity, not the 200 wire cap)", async () => {
  const { sink, sent, clock } = makeSink();
  sink.track(shown("r1", { prefix: "х".repeat(120) }));
  await clock.tick(FLUSH_INTERVAL_MS);
  assert.equal(sent[0].event.prefix.length, 80);
});
