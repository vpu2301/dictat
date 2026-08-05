import test from "node:test";
import assert from "node:assert/strict";

import { routeUtterance } from "./smartRouting.js";

const SECTIONS = [
  { id: "complaints", name: { uk: "Скарги", en: "Complaints" } },
  { id: "anamnesis",  name: { uk: "Анамнез", en: "History" } },
  { id: "exam",       name: { uk: "Об'єктивно", en: "Examination" }, voice_aliases: ["об'єктивний огляд"] },
  { id: "dx",         name: { uk: "Діагноз", en: "Diagnosis" } },
];

test("a colon-terminated heading routes and is stripped", () => {
  const r = routeUtterance(SECTIONS, "Скарги: болить голова другий день");
  assert.equal(r.sectionId, "complaints");
  assert.equal(r.text, "болить голова другий день");
  assert.equal(r.explicit, true);
});

test("an unpunctuated section name still routes", () => {
  const r = routeUtterance(SECTIONS, "Діагноз гострий бронхіт");
  assert.equal(r.sectionId, "dx");
  assert.equal(r.text, "гострий бронхіт");
  assert.equal(r.explicit, false);
});

test("a bare heading is a pure section switch", () => {
  const r = routeUtterance(SECTIONS, "Анамнез");
  assert.equal(r.sectionId, "anamnesis");
  assert.equal(r.text, "");
});

test("the longest matching heading wins", () => {
  const r = routeUtterance(SECTIONS, "об'єктивний огляд тони серця ритмічні");
  assert.equal(r.sectionId, "exam");
  assert.equal(r.text, "тони серця ритмічні");
});

test("ordinary content keeps the current section", () => {
  const r = routeUtterance(SECTIONS, "болить голова другий день");
  assert.equal(r.sectionId, null);
  assert.equal(r.text, "болить голова другий день");
});

test("a short first word never steers on its own", () => {
  // "Дані" is close to nothing here, but the guard is what keeps a one-word
  // near-miss from moving the caret mid-sentence.
  const r = routeUtterance([{ id: "dx", name: { uk: "Дані" } }], "Даних про алергію немає");
  assert.equal(r.sectionId, null);
});

test("empty input and empty templates are inert", () => {
  assert.equal(routeUtterance(SECTIONS, "").sectionId, null);
  assert.equal(routeUtterance([], "Скарги: щось").sectionId, null);
  assert.equal(routeUtterance(null, "Скарги: щось").text, "Скарги: щось");
});
