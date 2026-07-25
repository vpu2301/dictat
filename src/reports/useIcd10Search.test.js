// Sprint 13 step 05 — the search controller's discipline (VERIFY): debounce
// within budget, stale responses discarded (seq-guard), LRU memo serves
// repeats without network, min-length gate, fail-quiet degradation.
// Injectable timers + search fn — no DOM, no network.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";

import { createIcd10SearchController, ICD10_DEBOUNCE_MS } from "./useIcd10Search.js";

// Manual timer harness: schedule() records; fire(i) runs.
function harness({ search }) {
  const timers = [];
  const emissions = [];
  const ctrl = createIcd10SearchController({
    search,
    schedule: (fn, ms) => { timers.push({ fn, ms, cancelled: false }); return timers.length - 1; },
    cancel: (id) => { timers[id].cancelled = true; },
    onResults: (results, q) => emissions.push({ results, q }),
  });
  const fire = async (i) => { if (!timers[i].cancelled) await timers[i].fn(); };
  return { ctrl, timers, emissions, fire };
}

const LEAF = (code, display) => ({ code, display, is_leaf: true });

test("debounce: one network call at the 150 ms budget; earlier keystrokes' timers cancelled", async () => {
  const calls = [];
  const { ctrl, timers, emissions, fire } = harness({
    search: async (q) => { calls.push(q); return { results: [LEAF("I10", "Гіпертензія")] }; },
  });
  ctrl.input("гі");
  ctrl.input("гіпе");
  ctrl.input("гіперт");
  assert.equal(timers.length, 3);
  assert.ok(timers[0].cancelled && timers[1].cancelled);
  assert.equal(timers[2].ms, ICD10_DEBOUNCE_MS);
  await fire(2);
  assert.deepEqual(calls, ["гіперт"]); // exactly one request
  assert.deepEqual(emissions.at(-1), { q: "гіперт", results: [LEAF("I10", "Гіпертензія")] });
});

test("stale responses are discarded (VERIFY): a slow old response never overwrites a newer one", async () => {
  const resolvers = {};
  const { ctrl, emissions, fire } = harness({
    search: (q) => new Promise((res) => { resolvers[q] = res; }),
  });
  ctrl.input("гіперт");
  await Promise.resolve(); // let nothing fire yet
  const p1 = fire(0);      // request for "гіперт" goes out, hangs
  ctrl.input("діабет");    // newer input — the first is now stale
  const p2 = fire(1);
  resolvers["діабет"]({ results: [LEAF("E11.9", "ЦД 2")] });
  await p2;
  resolvers["гіперт"]({ results: [LEAF("I10", "Гіпертензія")] }); // arrives LATE
  await p1;
  // The dropdown belongs to the newest query; the stale I10 result emitted nothing.
  assert.deepEqual(emissions.at(-1), { q: "діабет", results: [LEAF("E11.9", "ЦД 2")] });
  assert.equal(emissions.filter((e) => e.q === "гіперт" && e.results.length).length, 0);
});

test("LRU memo: a repeated query is served without a network call", async () => {
  let calls = 0;
  const { ctrl, emissions, fire } = harness({
    search: async () => { calls += 1; return { results: [LEAF("I10")] }; },
  });
  ctrl.input("гіперт");
  await fire(0);
  ctrl.input("");         // clear
  ctrl.input("гіперт");   // repeat → memo, no timer even scheduled
  assert.equal(calls, 1);
  assert.deepEqual(emissions.at(-1), { q: "гіперт", results: [LEAF("I10")] });
});

test("min length 2: shorter input empties the dropdown, no request", async () => {
  let calls = 0;
  const { ctrl, timers, emissions } = harness({ search: async () => { calls += 1; return { results: [] }; } });
  ctrl.input("г");
  assert.equal(timers.length, 0);
  assert.equal(calls, 0);
  assert.deepEqual(emissions.at(-1), { q: "г", results: [] });
});

test("degraded (VERIFY): search failure → empty results, no throw — a lookup aid fails quiet", async () => {
  const { ctrl, emissions, fire } = harness({
    search: async () => { throw new Error("backend down / endpoint not shipped (BE step 03)"); },
  });
  ctrl.input("гіперт");
  await fire(0);
  assert.deepEqual(emissions.at(-1), { q: "гіперт", results: [] });
});

test("dispose cancels the pending timer and strands in-flight responses", async () => {
  const { ctrl, timers, emissions, fire } = harness({
    search: async () => ({ results: [LEAF("I10")] }),
  });
  ctrl.input("гіперт");
  ctrl.dispose();
  assert.ok(timers[0].cancelled);
  await fire(0); // even if it somehow ran, seq-guard discards
  assert.equal(emissions.some((e) => e.results.length), false);
});
