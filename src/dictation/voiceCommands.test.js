// Units for the dictation punctuation-spacing fix — the recognizer sometimes
// glues punctuation to the next word ("базальна.Також"); we insert the space
// without breaking decimals, times, abbreviations, or ellipses.
//
//   node --test src/dictation/voiceCommands.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { fixPunctuationSpacing, appendUtterance, segmentUtterance } from "./voiceCommands.js";

test("adds a space after a period glued to an uppercase sentence start", () => {
  assert.equal(
    fixPunctuationSpacing("справа базальна.Також маємо випід"),
    "справа базальна. Також маємо випід",
  );
});

test("spaces every glued sentence boundary in a run", () => {
  assert.equal(
    fixPunctuationSpacing("рецесус.Серединне середостіння.Контури серця"),
    "рецесус. Серединне середостіння. Контури серця",
  );
});

test("adds a space after a comma glued to a letter", () => {
  assert.equal(fixPunctuationSpacing("серця,збереження"), "серця, збереження");
});

test("preserves the Ukrainian decimal comma and decimal point", () => {
  assert.equal(fixPunctuationSpacing("розмір 1,5 см"), "розмір 1,5 см");
  assert.equal(fixPunctuationSpacing("рівень 3.5 мм"), "рівень 3.5 мм");
});

test("leaves times, ellipses, and lowercase abbreviations intact", () => {
  assert.equal(fixPunctuationSpacing("о 10:30 ранку"), "о 10:30 ранку");
  assert.equal(fixPunctuationSpacing("зачекайте...Далі"), "зачекайте... Далі"); // only the last dot + Uppercase
  assert.equal(fixPunctuationSpacing("т.д. та інше"), "т.д. та інше");
});

test("colon/semicolon before a letter get a space, before a digit do not", () => {
  assert.equal(fixPunctuationSpacing("висновок:пневмонія"), "висновок: пневмонія");
  assert.equal(fixPunctuationSpacing("співвідношення 2:3"), "співвідношення 2:3");
});

test("empty / non-string input is returned unchanged", () => {
  assert.equal(fixPunctuationSpacing(""), "");
  assert.equal(fixPunctuationSpacing(undefined), undefined);
});

test("appendUtterance fixes glued punctuation inside a dictated text run", () => {
  const parts = segmentUtterance("базальна.Також маємо", "uk");
  assert.equal(appendUtterance("", parts), "базальна. Також маємо");
});

test("appendUtterance still spaces the boundary between the prior text and a new run", () => {
  const parts = segmentUtterance("Також", "uk");
  assert.equal(appendUtterance("базальна.", parts), "базальна. Також");
});
