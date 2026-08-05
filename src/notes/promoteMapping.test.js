import test from "node:test";
import assert from "node:assert/strict";

import { mapNoteToTemplate } from "./promoteMapping.js";

const SOAP_NOTE = [
  { id: "S", label: "Скарги (S)", text: "болить голова" },
  { id: "O", label: "Об'єктивно (O)", text: "тони ритмічні" },
  { id: "A", label: "Оцінка (A)", text: "мігрень" },
  { id: "P", label: "План (P)", text: "суматриптан" },
];

const SOAP_TEMPLATE = [
  { id: "complaints", name: { uk: "Скарги", en: "Complaints" } },
  { id: "exam",       name: { uk: "Об'єктивно", en: "Objective" } },
  { id: "assessment", name: { uk: "Оцінка", en: "Assessment" } },
  { id: "plan",       name: { uk: "План", en: "Plan" } },
];

const SURGERY_TEMPLATE = [
  { id: "preop", name: { uk: "Передопераційний діагноз", en: "Preoperative diagnosis" } },
  { id: "op",    name: { uk: "Хід операції", en: "Operation" } },
];

test("a SOAP note lands in the matching template sections", () => {
  const body = mapNoteToTemplate(SOAP_NOTE, SOAP_TEMPLATE);
  assert.deepEqual(body, {
    complaints: "болить голова",
    exam: "тони ритмічні",
    assessment: "мігрень",
    plan: "суматриптан",
  });
});

test("the (S) structure marker never blocks the match", () => {
  const body = mapNoteToTemplate([{ id: "S", label: "Скарги (S)", text: "текст" }], SOAP_TEMPLATE);
  assert.deepEqual(body, { complaints: "текст" });
});

test("nothing is dropped when no section matches — it goes to the first, labelled", () => {
  const body = mapNoteToTemplate(SOAP_NOTE, SURGERY_TEMPLATE);
  assert.deepEqual(Object.keys(body), ["preop"]);
  for (const s of SOAP_NOTE) {
    assert.ok(body.preop.includes(s.text), `${s.text} survived`);
    assert.ok(body.preop.includes("Скарги"), "the note's own heading survives the merge");
  }
});

test("a single block keeps its text clean, without a heading", () => {
  const body = mapNoteToTemplate([{ id: "P", label: "План (P)", text: "спостереження" }], SURGERY_TEMPLATE);
  assert.equal(body.preop, "спостереження");
});

test("empty sections are skipped", () => {
  const body = mapNoteToTemplate([
    { id: "S", label: "Скарги (S)", text: "  " },
    { id: "P", label: "План (P)", text: "план" },
  ], SOAP_TEMPLATE);
  assert.deepEqual(body, { plan: "план" });
});

test("without template sections the note's own keys are kept, not invented", () => {
  assert.deepEqual(mapNoteToTemplate(SOAP_NOTE, []), {
    S: "болить голова", O: "тони ритмічні", A: "мігрень", P: "суматриптан",
  });
  assert.deepEqual(mapNoteToTemplate([], SOAP_TEMPLATE), {});
});
