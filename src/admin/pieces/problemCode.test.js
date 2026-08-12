// problemCode.test.js — the two wire dialects, with the EXACT repr strings the
// backend contract documents for autocomplete-service dict-detail errors.
import { test } from "node:test";
import assert from "node:assert/strict";
import { problemCode, problemInfo, piiPatternsFrom } from "./problemCode.js";
import { phraseProblem, snippetProblem } from "./corpusRules.js";

const apiErr = (status, problem) => ({ status, problem });

test("top-level extension member (the MFA gate's shape)", () => {
  const err = apiErr(403, {
    type: "about:blank", title: "Forbidden", status: 403,
    detail: "MFA enrolment required for this endpoint",
    code: "mfa_enrolment_required", instance: "urn:uuid:x",
  });
  assert.equal(problemCode(err), "mfa_enrolment_required");
  assert.deepEqual(piiPatternsFrom(err), []);
});

test("pii_detected as the Python-repr wire shape of today", () => {
  const err = apiErr(422, {
    type: "about:blank", title: "Unprocessable Content", status: 422,
    detail: "{'error': 'pii_detected', 'patterns': ['phone'], 'field': 'phrase', 'message': 'містить дані, схожі на персональні — не збережено'}",
    instance: "urn:uuid:x",
  });
  const info = problemInfo(err);
  assert.equal(info.code, "pii_detected");
  assert.deepEqual(info.patterns, ["phone"]);
  assert.equal(info.field, "phrase");
  assert.equal(info.message, "містить дані, схожі на персональні — не збережено");
  assert.deepEqual(piiPatternsFrom(err), ["phone"]);
});

test("pii_detected with several patterns and the snippet fields", () => {
  const err = apiErr(422, {
    detail: "{'error': 'pii_detected', 'patterns': ['ipn', 'dob_like'], 'field': 'expansion', 'message': 'містить дані, схожі на персональні — не збережено'}",
  });
  const info = problemInfo(err);
  assert.deepEqual(info.patterns, ["ipn", "dob_like"]);
  assert.equal(info.field, "expansion");
});

test("the other four repr-coded errors", () => {
  assert.equal(problemCode(apiErr(409, { detail: "{'error': 'phrase_already_exists'}" })), "phrase_already_exists");
  assert.equal(problemCode(apiErr(409, { detail: "{'error': 'snippet_already_exists'}" })), "snippet_already_exists");
  assert.equal(problemCode(apiErr(403, { detail: "{'error': 'forbidden_scope'}" })), "forbidden_scope");
  const rl = problemInfo(apiErr(429, { detail: "{'error': 'rate_limited', 'retry_after': 12}" }));
  assert.equal(rl.code, "rate_limited");
  assert.equal(rl.retry_after, 12);
});

test("real-JSON detail (the shape after the filed problem_extras fix)", () => {
  const err = apiErr(422, {
    detail: '{"error": "pii_detected", "patterns": ["med_id"], "field": "phrase", "message": "м"}',
  });
  assert.equal(problemCode(err), "pii_detected");
  assert.deepEqual(piiPatternsFrom(err), ["med_id"]);
});

test("structured detail object passes through", () => {
  const err = apiErr(422, { detail: { error: "pii_detected", patterns: ["passport"], field: "trigger" } });
  assert.deepEqual(piiPatternsFrom(err), ["passport"]);
});

test("plain-string details yield no code", () => {
  assert.equal(problemCode(apiErr(409, { detail: "email already registered" })), null);
  assert.equal(problemCode(apiErr(500, {})), null);
  assert.equal(problemCode(null), null);
  assert.equal(problemCode(apiErr(0, undefined)), null);
});

// corpusRules — the client mirrors.
test("phraseProblem bounds", () => {
  assert.equal(phraseProblem("аускультація легень"), null);
  assert.equal(phraseProblem(""), "empty");
  assert.equal(phraseProblem("x".repeat(81)), "too_long");
});

test("snippetProblem mirrors trigger/expansion/cursor constraints", () => {
  assert.equal(snippetProblem({ trigger: "bp", expansion: "АТ 120/80", cursor_position: 3 }), null);
  assert.equal(snippetProblem({ trigger: "/bp", expansion: "x", cursor_position: 0 }), "trigger_slash");
  assert.equal(snippetProblem({ trigger: "B", expansion: "x", cursor_position: 0 }), "trigger_format");
  assert.equal(snippetProblem({ trigger: "b".repeat(33), expansion: "x", cursor_position: 0 }), "trigger_format");
  assert.equal(snippetProblem({ trigger: "bp", expansion: "", cursor_position: 0 }), "expansion_empty");
  assert.equal(snippetProblem({ trigger: "bp", expansion: "ab", cursor_position: 3 }), "cursor_out_of_range");
  assert.equal(snippetProblem({ trigger: "bp", expansion: "ab", cursor_position: -1 }), "cursor_out_of_range");
});
