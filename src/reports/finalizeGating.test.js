// Sprint 13 step 06 — the finalize gating surface: backend-driven reasons
// only. Copy per code (diagnosis_not_confirmed ≠ missing_icd10), unknown-
// code fallback, sprint-08 regression (reason-keyed payloads render the
// pre-sprint copy), the «перейти» routing, and the server-authority guard —
// no client-side filled-ness ever blocks.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { violationCopy, ViolationNotice } from "./finalizeViolations.js";
import { violationsBySection } from "./fieldContract.js";
import { FIXTURE_FINALIZE_PROBLEMS } from "./fieldFixtures.js";

const h = React.createElement;

test("every new code maps to distinct uk copy; the diagnosis pair differs (VERIFY)", () => {
  const texts = ["choice_not_selected", "numeric_not_filled", "date_not_filled",
                 "missing_icd10", "diagnosis_not_confirmed"]
    .map((code) => violationCopy({ code }, "uk"));
  assert.deepEqual(texts, [
    "Оберіть значення",
    "Вкажіть значення та одиницю",
    "Вкажіть дату",
    // Deviation from the step-06 draft copy («Вкажіть діагноз»): the
    // dictated diagnosis text is usually present — the missing thing is
    // the CODE, and the copy must say so (user report, 2026-07-24).
    "Додайте код МКХ-10 (пошук у розділі)",
    "Підтвердіть запропонований діагноз",
  ]);
  assert.equal(new Set(texts).size, texts.length); // all distinct
  // The distinction the doc wants: proposal-pending ≠ nothing-there.
  assert.notEqual(
    violationCopy({ code: "diagnosis_not_confirmed" }, "uk"),
    violationCopy({ code: "missing_icd10" }, "uk"),
  );
});

test("unknown/future codes fall back to the generic line — a newer validator can't break the surface", () => {
  assert.equal(violationCopy({ code: "hologram_not_calibrated" }, "uk"), "Заповніть цей розділ");
  assert.equal(violationCopy({}, "uk"), "Заповніть цей розділ");
  assert.equal(violationCopy(null, "en"), "Complete this section");
});

test("sprint-08 REGRESSION: reason-keyed payloads (no code) render the exact pre-sprint copy", () => {
  // Pre-S13 the backend emitted these under `reason` — byte-for-byte the
  // same strings ReportPreview showed before this step.
  assert.equal(violationCopy({ reason: "below_min_chars" }, "uk"), "Замало тексту в розділі");
  assert.equal(violationCopy({ reason: "required_empty" }, "uk"), "Обов'язковий розділ не заповнено");
  const html = renderToStaticMarkup(h(ViolationNotice, {
    problems: [{ section_key: "anamnesis", reason: "below_min_chars" }],
    sectionKey: "anamnesis", lang: "uk",
  }));
  assert.match(html, /class="rp-sec-problem" role="alert"/);
  assert.match(html, /Замало тексту в розділі/);
  assert.doesNotMatch(html, /<button/); // no onJump handler → no «перейти» — old look
});

test("blocked finalize (VERIFY): the 422 payload renders per-section reasons + «перейти» routing", () => {
  const bySection = violationsBySection(FIXTURE_FINALIZE_PROBLEMS);
  const jumps = [];
  const html = renderToStaticMarkup(h(ViolationNotice, {
    problems: bySection.diagnosis, // diagnosis_not_confirmed AND missing_icd10
    sectionKey: "diagnosis", lang: "uk",
    onJump: (key, code) => jumps.push([key, code]),
  }));
  assert.match(html, /Підтвердіть запропонований діагноз/);
  assert.match(html, /Додайте код МКХ-10/);
  assert.equal((html.match(/>Перейти</g) || []).length, 2);
  // The reasons shown are exactly the payload's — nothing invented, nothing dropped.
  assert.equal(bySection.diagnosis.length, 2);
});

test("server authority (VERIFY guard): without a 422 payload the surface shows NOTHING", () => {
  // The notice has no access to body/meta at all — its ONLY input is the
  // payload. Empty/absent payload → empty render, however unfilled the
  // document might look client-side.
  assert.equal(renderToStaticMarkup(h(ViolationNotice, { problems: [], sectionKey: "x", lang: "uk" })), "");
  assert.equal(renderToStaticMarkup(h(ViolationNotice, { problems: null, sectionKey: "x", lang: "uk" })), "");
});

test("no client-side gate: the finalize button's disabled state never reads filled-ness", () => {
  // Encoded guard (§4.3): the button may be disabled only by an in-flight
  // request or a missing report id — never by body/meta inspection.
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "components", "ReportPreview.jsx"),
    "utf8",
  );
  assert.match(src, /onClick=\{handleFinalize\} disabled=\{finalizing \|\| !reportId\}/);
  // And the soft hint stays a hint: labeled as a pre-check, in a warn box,
  // with no wiring into the button.
  assert.match(src, /Попередня перевірка/);
});
