// Visit lifecycle client — the transitions that did not exist until
// migration 0058. Before it, `createEncounter({status:"in_progress"})` was
// the only write the SPA ever made against an encounter, so every visit a
// clinician started stayed open forever.
//
//   npm run test:unit
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { setAccessToken } from "./client.js";
import {
  isEncounterOpen,
  isEncounterClosed,
  ENCOUNTER_OPEN_STATUSES,
  startEncounter,
  pauseEncounter,
  resumeEncounter,
  completeEncounter,
  cancelEncounter,
  listOpenEncounters,
} from "./encounters.js";

const realFetch = globalThis.fetch;
let calls = [];

beforeEach(() => {
  calls = [];
  setAccessToken("test-token");
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ id: "e1", status: "completed" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
});

afterEach(() => {
  globalThis.fetch = realFetch;
  setAccessToken(null);
});

const bodyOf = (i) => JSON.parse(calls[i].init.body);
const pathOf = (i) => new URL(calls[i].url).pathname + new URL(calls[i].url).search;

test("open/closed predicates match the server's status enum", () => {
  assert.deepEqual(ENCOUNTER_OPEN_STATUSES, ["in_progress", "paused"]);
  for (const s of ["in_progress", "paused"]) {
    assert.equal(isEncounterOpen(s), true, s);
    assert.equal(isEncounterClosed(s), false, s);
  }
  for (const s of ["completed", "cancelled"]) {
    assert.equal(isEncounterClosed(s), true, s);
    assert.equal(isEncounterOpen(s), false, s);
  }
  // `scheduled` is neither: it holds no slot in the pipeline yet.
  assert.equal(isEncounterOpen("scheduled"), false);
  assert.equal(isEncounterClosed("scheduled"), false);
});

test("each verb POSTs to its own endpoint — one audit kind per clinical action", async () => {
  await startEncounter("e1");
  await pauseEncounter("e1");
  await resumeEncounter("e1");
  await completeEncounter("e1");
  await cancelEncounter("e1");
  assert.deepEqual(
    calls.map((c) => new URL(c.url).pathname),
    [
      "/encounters/e1/start",
      "/encounters/e1/pause",
      "/encounters/e1/resume",
      "/encounters/e1/complete",
      "/encounters/e1/cancel",
    ],
  );
  assert.ok(calls.every((c) => c.init.method === "POST"));
});

test("the transition body stays empty unless the caller set something", async () => {
  // The server is extra="forbid"; a stray null would be a 422 mid-visit.
  await completeEncounter("e1");
  assert.deepEqual(bodyOf(0), {});
  await completeEncounter("e1", { reason: "", force: false });
  assert.deepEqual(bodyOf(1), {});
});

test("force and reason ride through when set", async () => {
  await completeEncounter("e1", { force: true, reason: "patient left" });
  assert.deepEqual(bodyOf(0), { reason: "patient left", force: true });
});

test("encounter ids are path-encoded", async () => {
  await completeEncounter("a/b");
  assert.equal(new URL(calls[0].url).pathname, "/encounters/a%2Fb/complete");
});

test("listOpenEncounters defaults to the caller's own visits", async () => {
  await listOpenEncounters();
  assert.equal(pathOf(0), "/encounters/open?limit=100");
  await listOpenEncounters({ mine: false, limit: 10 });
  assert.equal(pathOf(1), "/encounters/open?mine=false&limit=10");
});
