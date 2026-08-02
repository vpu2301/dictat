// midSentence.test.js — the gate that decides whether Layer C asks at all.
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { isMidSentence, sentenceFragment, MIN_FRAGMENT_CHARS } from "./midSentence.js";

test("fires mid-sentence, including on a trailing space", () => {
  assert.equal(isMidSentence("Пацієнт скаржиться на біль у"), true);
  assert.equal(isMidSentence("Пацієнт скаржиться на біль у "), true);
});

test("stays silent after terminal punctuation — the whole point of the gate", () => {
  for (const end of [".", "!", "?", "…"]) {
    assert.equal(isMidSentence(`Стан пацієнта стабільний${end}`), false, end);
    assert.equal(isMidSentence(`Стан пацієнта стабільний${end} `), false, `${end} + space`);
  }
});

test("closing quotes and brackets do not reopen a finished sentence", () => {
  assert.equal(isMidSentence("Результат «у межах норми.»"), false);
  assert.equal(isMidSentence('Result "within normal limits."'), false);
  assert.equal(isMidSentence("Результат (у межах норми.)"), false);
});

test("colons and semicolons are NOT terminal — a heading is the best moment to continue", () => {
  assert.equal(isMidSentence("Об'єктивно: аускультативно"), true);
  assert.equal(isMidSentence("Скарги на біль; додатково"), true);
});

test("a fresh line is a fresh thought, not a continuation", () => {
  assert.equal(isMidSentence("Скарги на головний біль\n"), false);
  assert.equal(isMidSentence("Скарги на головний біль\nОбʼє"), false, "too short after the newline");
  assert.equal(isMidSentence("Скарги на головний біль\nОбʼєктивно стан"), true);
});

test("too little context to continue → silence", () => {
  assert.equal(isMidSentence(""), false);
  assert.equal(isMidSentence("   "), false);
  assert.equal(isMidSentence("Біль"), false);
  assert.equal("Біль у ло".length >= MIN_FRAGMENT_CHARS, true);
  assert.equal(isMidSentence("Біль у ло"), true);
});

test("the fragment is what comes after the LAST sentence break", () => {
  assert.equal(
    sentenceFragment("Скарг немає. Обʼєктивно стан задовільний"),
    " Обʼєктивно стан задовільний",
  );
  assert.equal(sentenceFragment("Перший рядок\nдругий"), "другий");
  assert.equal(sentenceFragment("без розділових знаків"), "без розділових знаків");
});

test("null/undefined are handled like empty input, not thrown on", () => {
  assert.equal(isMidSentence(null), false);
  assert.equal(isMidSentence(undefined), false);
  assert.equal(sentenceFragment(null), "");
});
