/* The stat count-up parses AUTHORED copy, in eleven languages, written by
 * whoever edits LandingPage/PricingPage — not a number field. Everything that
 * can go wrong goes wrong at that boundary, so the parser is the part that is
 * tested and the DOM choreography around it is not.
 *
 * Run: node --test src/pages/marketing/marketingMotion.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import { __test } from "./useMarketingMotion.js";

const { splitNumber, group } = __test;

test("plain percentage: counts the number, keeps the unit", () => {
  assert.deepEqual(splitNumber("98%"), { pre: "", value: 98, post: "%", sep: "" });
});

test("multiplier keeps its ×", () => {
  assert.deepEqual(splitNumber("3×"), { pre: "", value: 3, post: "×", sep: "" });
});

test("a word after the number keeps its space", () => {
  // The bug this exists for: a greedy digit class ate the separator and the
  // stat animated as "10мов" before snapping back to "11 мов".
  const p = splitNumber("11 мов");
  assert.equal(p.value, 11);
  assert.equal(p.post, " мов");
  assert.equal(p.sep, "");
});

test("English plural too", () => {
  const p = splitNumber("11 languages");
  assert.equal(p.value, 11);
  assert.equal(p.post, " languages");
});

test("a currency prefix stays put", () => {
  const p = splitNumber("₴790");
  assert.equal(p.pre, "₴");
  assert.equal(p.value, 790);
  assert.equal(p.post, "");
});

test("a thousands separator is part of the number and is remembered", () => {
  const p = splitNumber("₴1 990");
  assert.equal(p.value, 1990);
  assert.equal(p.post, "");
  assert.equal(p.sep, " ");
  // …and is put back on every frame of the count, so the width does not jump.
  assert.equal(group(1990, p.sep), "1 990");
  assert.equal(group(990, p.sep), "990");
});

test("a non-breaking thousands separator works the same way", () => {
  const p = splitNumber("1 990 €");
  assert.equal(p.value, 1990);
  assert.equal(p.sep, " ");
  assert.equal(p.post, " €");
});

test("24/7 is not a quantity and is left alone", () => {
  assert.equal(splitNumber("24/7"), null);
});

test("copy with no number at all is left alone", () => {
  assert.equal(splitNumber("Індивідуально"), null);
  assert.equal(splitNumber("Custom"), null);
});

test("a zero is left alone — counting 0 to 0 is not an animation", () => {
  assert.equal(splitNumber("0"), null);
});

test("group() without a separator returns the bare digits", () => {
  assert.equal(group(1990, ""), "1990");
});
