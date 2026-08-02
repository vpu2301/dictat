// layerCTelemetry.test.js — sprint 15: Layer C events ride the sprint-10
// batcher, and the outbound whitelist enforces the backend's layer_c rules
// BEFORE the wire (the backend 422s a layer_c event carrying phrase_id or
// snippet_id — that must never be a runtime discovery).
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { createTelemetrySink, FLUSH_INTERVAL_MS } from "./telemetry.js";

function harness() {
  const sent = [];
  const timers = [];
  const sink = createTelemetrySink({
    send: async (e) => { sent.push(e); },
    setTimeoutFn: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeoutFn: (id) => { if (timers[id - 1]) timers[id - 1].cleared = true; },
    now: () => 0,
  });
  const runTimers = async () => {
    for (const t of timers) if (!t.cleared && !t.ran) { t.ran = true; t.fn(); }
    await new Promise((r) => setImmediate(r));
  };
  return { sink, sent, timers, runTimers };
}

test("layer_c events carry source and NEVER a corpus id", async () => {
  const { sink, sent, runTimers } = harness();
  sink.track({
    request_id: "req-1",
    event: "accepted",
    source: "layer_c",
    prefix: "Пацієнт скаржиться на біль у",
    // A caller mistake the whitelist must absorb: the backend would 422.
    phrase_id: "should-never-ship",
    snippet_id: "neither-should-this",
    context: { field: "anamnesis", reason: "input" },
  });
  await runTimers();

  assert.equal(sent.length, 1);
  const e = sent[0];
  assert.equal(e.source, "layer_c");
  assert.equal(e.event, "accepted");
  assert.equal("phrase_id" in e, false);
  assert.equal("snippet_id" in e, false);
});

test("dismissal reason rides in context — the tuning signal for the budgets", async () => {
  const { sink, sent, runTimers } = harness();
  sink.track({
    request_id: "req-2", event: "rejected", source: "layer_c", prefix: "біль у",
    context: { field: "anamnesis", reason: "expired" },
  });
  await runTimers();
  assert.deepEqual(sent[0].context, { field: "anamnesis", reason: "expired" });
});

test("reason is layer_c only — corpus events keep their pre-S15 shape byte-for-byte", async () => {
  const { sink, sent, runTimers } = harness();
  sink.track({
    request_id: "req-3", event: "accepted", prefix: "зад", phrase_id: "phr-1",
    context: { field: "anamnesis", index: 0, reason: "input" },
  });
  await runTimers();
  assert.deepEqual(sent[0], {
    request_id: "req-3",
    event: "accepted",
    prefix: "зад",
    phrase_id: "phr-1",
    context: { field: "anamnesis", index: 0 },
  });
  assert.equal("source" in sent[0], false, "default source stays off the wire");
});

test("one shown_only per request_id — a re-render is not a second impression", async () => {
  const { sink, sent, runTimers } = harness();
  const ev = { request_id: "req-4", event: "shown_only", source: "layer_c", prefix: "біль у" };
  sink.track(ev);
  sink.track(ev);
  sink.track(ev);
  await runTimers();
  assert.equal(sent.filter((e) => e.event === "shown_only").length, 1);
});

test("batched, not per-keystroke: nothing is sent before the flush window", () => {
  const { sink, sent, timers } = harness();
  for (let i = 0; i < 3; i++) {
    sink.track({ request_id: `r${i}`, event: "shown_only", source: "layer_c", prefix: "x" });
  }
  assert.equal(sent.length, 0, "no POST happened synchronously with the event");
  assert.equal(timers[0].ms, FLUSH_INTERVAL_MS);
});

test("an accept supersedes a pending dismissal for the same completion", async () => {
  const { sink, sent, runTimers } = harness();
  sink.track({ request_id: "req-5", event: "rejected", source: "layer_c", prefix: "біль" });
  sink.track({ request_id: "req-5", event: "accepted", source: "layer_c", prefix: "біль" });
  await runTimers();
  assert.deepEqual(sent.map((e) => e.event), ["accepted"]);
});
