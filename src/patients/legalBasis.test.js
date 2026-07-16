// Sprint 11 step 06 — the basis map must cover exactly the backend's known
// set (erasure/fanout.py BASIS_*), and unknown bases must render raw.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";

import { LEGAL_BASIS_TEXT, legalBasisText } from "./legalBasis.js";

// The backend's as-built basis strings — update BOTH sides together.
const BACKEND_BASES = [
  "retention:clinical_record_signed",
  "retention:consent_record",
  "retention:qualified_signature",
  "retention:erasure_paper_trail",
];

test("the map enumerates the backend's known basis set exactly", () => {
  assert.deepEqual(Object.keys(LEGAL_BASIS_TEXT).sort(), [...BACKEND_BASES].sort());
});

test("every known basis has uk + en text", () => {
  for (const b of BACKEND_BASES) {
    assert.ok(LEGAL_BASIS_TEXT[b].uk.length > 10, `${b} uk`);
    assert.ok(LEGAL_BASIS_TEXT[b].en.length > 10, `${b} en`);
    assert.equal(legalBasisText(b, "uk"), LEGAL_BASIS_TEXT[b].uk);
  }
});

test("unknown basis renders the RAW string — never hidden, never prettified", () => {
  assert.equal(legalBasisText("retention:new_thing_v2", "uk"), "retention:new_thing_v2");
  assert.equal(legalBasisText("", "uk"), "");
  assert.equal(legalBasisText(null, "uk"), "");
});
