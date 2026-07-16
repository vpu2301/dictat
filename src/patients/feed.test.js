// Sprint 11 step 03 — units for the merged patient feed (the page's only
// algorithmic piece). Mixed-pagination correctness is invisible when right
// and glaring when wrong — these are the guard.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";

import { mergeFeed } from "./feed.js";

const D = (h) => `2026-07-10T${String(h).padStart(2, "0")}:00:00Z`;

test("merges all kinds newest-first using each wire's real date field", () => {
  const out = mergeFeed({
    timeline: [
      { id: "r1", kind: "dictate", title: "Звіт", date: D(10), status: "signed", by: "Dr" },
      { id: "a1", kind: "recording", title: "Recording", date: D(12), status: "completed", encounter_id: "e1", duration_s: 61.5 },
    ],
    encounters: [{ id: "e1", occurred_at: D(11), reason: "візит", status: "completed" }],
    notes: [{ id: "n1", created_at: D(9), title: "SOAP", status: "draft" }],
    consents: [{ id: "c1", granted_at: D(13), status: "granted", encounter_id: "e1" }],
  });
  assert.deepEqual(out.map((i) => i.type), ["consent", "recording", "encounter", "report", "note"]);
  const rec = out[1];
  assert.equal(rec.duration_s, 61.5);
  assert.equal(rec.encounter_id, "e1");
  assert.equal(rec.key, "recording:a1");
});

test("tiebreak is stable: same date sorts by (type, id) regardless of input order", () => {
  const sources = {
    timeline: [
      { id: "z", kind: "dictate", title: "B", date: D(10) },
      { id: "a", kind: "dictate", title: "A", date: D(10) },
    ],
    encounters: [{ id: "m", occurred_at: D(10), reason: "x" }],
  };
  const once = mergeFeed(sources);
  const again = mergeFeed({
    timeline: [...sources.timeline].reverse(),
    encounters: sources.encounters,
  });
  assert.deepEqual(once.map((i) => i.key), again.map((i) => i.key));
  assert.deepEqual(once.map((i) => i.key), ["encounter:m", "report:a", "report:z"]);
});

test("withdrawn consents sort on withdrawn_at (the event the feed reports)", () => {
  const out = mergeFeed({
    consents: [
      { id: "c1", granted_at: D(8), withdrawn_at: D(14), status: "withdrawn" },
      { id: "c2", granted_at: D(10), status: "granted" },
    ],
  });
  assert.deepEqual(out.map((i) => i.id), ["c1", "c2"]);
});

test("undated items sink to the bottom instead of NaN-scrambling the sort", () => {
  const out = mergeFeed({
    timeline: [{ id: "r1", kind: "dictate", title: "ok", date: D(10) }],
    encounters: [{ id: "e1", reason: "no occurred_at" }],
  });
  assert.deepEqual(out.map((i) => i.id), ["r1", "e1"]);
});

test("unknown timeline kinds are skipped, never mislabeled as reports", () => {
  const out = mergeFeed({
    timeline: [
      { id: "x1", kind: "hologram", date: D(10) },
      { id: "r1", kind: "dictate", date: D(9) },
    ],
  });
  assert.deepEqual(out.map((i) => i.id), ["r1"]);
});

test("unequal and empty sources merge without duplicates", () => {
  const out = mergeFeed({
    timeline: Array.from({ length: 5 }, (_, i) => ({ id: `r${i}`, kind: "dictate", date: D(i + 1) })),
    encounters: [],
    notes: [{ id: "n1", created_at: D(20) }],
  });
  assert.equal(out.length, 6);
  assert.equal(out[0].id, "n1");
  assert.equal(new Set(out.map((i) => i.key)).size, 6);
});

test("empty everything → empty feed (all-empty states downstream)", () => {
  assert.deepEqual(mergeFeed({}), []);
  assert.deepEqual(mergeFeed(), []);
});
