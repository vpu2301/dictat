// chat/citations.test.js — the marker → chip mapping.
//
// This is the module's core claim: every [n] in an answer points at the source
// the answer actually cited. If this file is wrong, the product lies.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { segmentAnswer, citedSources, confidenceBandOf } from "./citations.js";

const A = { id: "ev_01", title: "Guideline", sourceType: "guideline", year: 2024, evidenceLevel: "Ia" };
const B = { id: "ev_04", title: "Review", sourceType: "review", year: 2024, evidenceLevel: "IV" };

test("markers become citation parts pointing at the right source", () => {
  const parts = segmentAnswer("Target 6.5–7.5% [1], relaxed in older adults [2].", [A, B]);
  const cites = parts.filter((p) => p.type === "citation");
  assert.equal(cites.length, 2);
  assert.equal(cites[0].evidence.id, "ev_01");
  assert.equal(cites[1].evidence.id, "ev_04");
  // Text either side survives intact.
  assert.equal(parts.filter((p) => p.type === "text").map((p) => p.value).join(""),
    "Target 6.5–7.5% , relaxed in older adults .");
});

test("indices are 1-based into the answer's own citation list", () => {
  const [first] = segmentAnswer("Only this [1].", [B, A]).filter((p) => p.type === "citation");
  assert.equal(first.evidence.id, "ev_04", "[1] must be the answer's first citation, not a global id");
});

test("a marker with no matching source stays literal text — never a dead chip", () => {
  const parts = segmentAnswer("Claim [3] with one source.", [A]);
  assert.equal(parts.some((p) => p.type === "citation"), false);
  assert.equal(parts.map((p) => p.value).join(""), "Claim [3] with one source.");
});

test("adjacent markers each get their own chip", () => {
  const cites = segmentAnswer("Reasonable [1][2].", [A, B]).filter((p) => p.type === "citation");
  assert.deepEqual(cites.map((c) => c.index), [1, 2]);
});

test("empty or half-streamed text is safe", () => {
  assert.deepEqual(segmentAnswer("", [A]), []);
  assert.deepEqual(segmentAnswer("Partial answer while streaming", []), [
    { type: "text", value: "Partial answer while streaming" },
  ]);
});

test("citedSources numbers sources in citation order and drops duplicates", () => {
  const sources = citedSources([A, B, A]);
  assert.deepEqual(sources.map((s) => s.id), ["ev_01", "ev_04"]);
  assert.deepEqual(sources.map((s) => s.index), [1, 2]);
});

test("confidence bands: the pill and the memo agree on the cut-offs", () => {
  assert.equal(confidenceBandOf(0.85), "high"); // boundary is inclusive
  assert.equal(confidenceBandOf(0.91), "high");
  assert.equal(confidenceBandOf(0.7), "mid"); // boundary is inclusive
  assert.equal(confidenceBandOf(0.84), "mid");
  assert.equal(confidenceBandOf(0.69), "low");
  assert.equal(confidenceBandOf(0), "low");
});
