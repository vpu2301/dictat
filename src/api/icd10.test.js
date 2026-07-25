// Sprint 13 step 01 — /v1/icd10/search client: query/limit bounds from the
// pinned backend contract (q 1..80, limit 1..20 default 10) enforced in the
// pure path builder.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  icd10SearchPath, ICD10_LIMIT_DEFAULT, ICD10_LIMIT_MAX, ICD10_QUERY_MAX,
} from "./icd10.js";

test("builds the pinned path with defaults", () => {
  assert.equal(icd10SearchPath("I20"), "/v1/icd10/search?q=I20&limit=10");
  assert.equal(ICD10_LIMIT_DEFAULT, 10);
});

test("empty/whitespace query → null (caller must not search)", () => {
  assert.equal(icd10SearchPath(""), null);
  assert.equal(icd10SearchPath("   "), null);
  assert.equal(icd10SearchPath(null), null);
});

test("query is trimmed and truncated to 80 chars; cyrillic survives encoding", () => {
  const long = "стенокардія ".repeat(20);
  const path = icd10SearchPath(long);
  const q = new URLSearchParams(path.split("?")[1]).get("q");
  assert.ok(q.length <= ICD10_QUERY_MAX);
  assert.ok(q.startsWith("стенокардія"));
});

test("limit clamps to 1..20 and falls back to the default when nonsense", () => {
  assert.equal(icd10SearchPath("x", 50), `/v1/icd10/search?q=x&limit=${ICD10_LIMIT_MAX}`);
  assert.equal(icd10SearchPath("x", 0), "/v1/icd10/search?q=x&limit=10");
  assert.equal(icd10SearchPath("x", -3), "/v1/icd10/search?q=x&limit=1");
  assert.equal(icd10SearchPath("x", 7.9), "/v1/icd10/search?q=x&limit=7");
  assert.equal(icd10SearchPath("x", NaN), "/v1/icd10/search?q=x&limit=10");
});
