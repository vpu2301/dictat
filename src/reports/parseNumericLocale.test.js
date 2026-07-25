// Sprint 13 step 04 — the locale numeric parser matrix (§8/§10: the pure
// parser is the guard against the locale bug farm).
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";

import { parseNumericLocale, formatNumericLocale } from "./parseNumericLocale.js";

test("accepts uk comma and en dot decimals, integers, signs", () => {
  for (const [raw, expected] of [
    ["36,6", 36.6], ["36.6", 36.6], ["140", 140], ["007", 7],
    ["-5", -5], ["+7", 7], ["-0,5", -0.5], ["  36,6  ", 36.6],
    ["0", 0], ["99,25", 99.25],
  ]) {
    assert.equal(parseNumericLocale(raw), expected, raw);
  }
});

test("rejects grouping, double separators, mixed junk — null, never NaN or a wrong number", () => {
  for (const raw of [
    "1 234,5", "1.234,5", "1,234.5",   // thousands grouping — silent misparse forbidden
    "36,6,6", "36.6.6", "36,", ",6", ".",
    "36.6%", "36,6 °C", "тридцять шість", "12e3", "0x1F", "", "   ", "NaN", "Infinity",
  ]) {
    assert.equal(parseNumericLocale(raw), null, JSON.stringify(raw));
  }
  assert.equal(parseNumericLocale(null), null);
  assert.equal(parseNumericLocale(36.6), null); // strings only — the input's raw text
});

test("formatNumericLocale: uk shows comma, others dot; storage stays a number elsewhere", () => {
  assert.equal(formatNumericLocale(36.6, "uk"), "36,6");
  assert.equal(formatNumericLocale(36.6, "en"), "36.6");
  assert.equal(formatNumericLocale(140, "uk"), "140");
  assert.equal(formatNumericLocale(null, "uk"), "");
  // round-trip: format → parse is identity for both locales
  assert.equal(parseNumericLocale(formatNumericLocale(36.6, "uk")), 36.6);
  assert.equal(parseNumericLocale(formatNumericLocale(36.6, "en")), 36.6);
});
