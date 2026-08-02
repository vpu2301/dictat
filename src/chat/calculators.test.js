// chat/calculators.test.js — the only arithmetic in the module.
//
// Everything else here looks something up; these compute, so a wrong constant
// would produce a plausible number nobody could catch by reading the sources.
// Checked against published worked examples.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { egfr, chadsvasc, bmi, resultLine } from "./calculators.js";

test("CKD-EPI 2021: a 67-year-old man at 1.3 mg/dL lands in CKD stage 3a", () => {
  const r = egfr({ creatinine: 1.3, age: 67, sex: "m" });
  // 142 × (1.3/0.9)^−1.200 × 0.9938^67 = 60. Worth pinning the equation
  // year: CKD-EPI **2009** returns ~57 for the same man, and a three-point
  // difference straddles the referral threshold at 60.
  assert.ok(Math.abs(r.value - 60) <= 1, `expected ~60, got ${r.value}`);
  assert.equal(r.unit, "ml/min/1.73m²");
  assert.match(r.detail, /creatinine 1\.3 mg\/dL, age 67, male/);
});

test("CKD-EPI 2021: the female coefficients lower the same creatinine", () => {
  const male = egfr({ creatinine: 1.0, age: 55, sex: "m" });
  const female = egfr({ creatinine: 1.0, age: 55, sex: "f" });
  assert.ok(female.value < male.value,
    "at equal creatinine the female equation yields a lower eGFR, not a higher one");
});

test("CKD-EPI 2021: eGFR falls as creatinine rises and as age rises", () => {
  const base = egfr({ creatinine: 1.0, age: 50, sex: "m" }).value;
  assert.ok(egfr({ creatinine: 2.0, age: 50, sex: "m" }).value < base);
  assert.ok(egfr({ creatinine: 1.0, age: 80, sex: "m" }).value < base);
});

test("CKD-EPI 2021: nonsense in, nothing out", () => {
  assert.equal(egfr({ creatinine: 0, age: 60, sex: "m" }), null);
  assert.equal(egfr({ creatinine: "", age: "", sex: "f" }), null);
});

test("CHA₂DS₂-VASc scores age once, not twice", () => {
  assert.equal(chadsvasc({ age: 80, flags: {} }).value, 2, "≥75 scores 2");
  assert.equal(chadsvasc({ age: 70, flags: {} }).value, 1, "65–74 scores 1");
  assert.equal(chadsvasc({ age: 60, flags: {} }).value, 0);
});

test("CHA₂DS₂-VASc: stroke is the other two-pointer", () => {
  assert.equal(chadsvasc({ age: 60, flags: { stroke: true } }).value, 2);
  assert.equal(chadsvasc({ age: 60, flags: { hypertension: true } }).value, 1);
});

test("CHA₂DS₂-VASc: a worked case adds up", () => {
  // 78-year-old woman with hypertension, diabetes and prior stroke:
  // age 2 + HTN 1 + DM 1 + stroke 2 + female 1 = 7.
  const r = chadsvasc({ age: 78, flags: { hypertension: true, diabetes: true, stroke: true, female: true } });
  assert.equal(r.value, 7);
  assert.match(r.detail, /age 78 \(\+2\)/);
  assert.match(r.detail, /Stroke/);
});

test("BMI: the textbook case", () => {
  assert.equal(bmi({ weightKg: 70, heightCm: 175 }).value, 22.9);
  assert.equal(bmi({ weightKg: 0, heightCm: 175 }), null);
});

test("a result travels with its inputs, never as a bare number", () => {
  const line = resultLine(egfr({ creatinine: 1.3, age: 67, sex: "m" }));
  assert.match(line, /^eGFR \(CKD-EPI 2021\): \d+ ml\/min\/1\.73m² \(creatinine 1\.3 mg\/dL, age 67, male\)$/);
  assert.equal(resultLine(null), "");
});
