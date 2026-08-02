// sentences.test.js — sprint 15: sentence↔audio alignment.
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  splitSentences, alignSentencesToSegments, normalizeSpeaker, MIN_SPAN_MS,
} from "./sentences.js";

const seg = (start_ms, end_ms, speaker = null, speaker_role = null) =>
  ({ segment_id: null, index: 0, start_ms, end_ms, speaker, speaker_role });

test("splits on terminal punctuation and keeps it with its sentence", () => {
  const s = splitSentences("Скарг немає. Стан задовільний! Чи є біль?");
  assert.deepEqual(s.map((x) => x.text), [
    "Скарг немає.",
    " Стан задовільний!",
    " Чи є біль?",
  ]);
});

test("a run of marks or a closing quote does not shatter one sentence", () => {
  assert.deepEqual(
    splitSentences("Справді?! Так.").map((x) => x.text),
    ["Справді?!", " Так."],
  );
  assert.deepEqual(
    splitSentences("Він сказав «болить.» Потім вийшов.").map((x) => x.text),
    ["Він сказав «болить.»", " Потім вийшов."],
  );
});

test("newlines end sentences; blank runs fold into their neighbour", () => {
  const s = splitSentences("Скарги\n\nОбʼєктивно");
  assert.deepEqual(s.map((x) => x.text), ["Скарги\n\n", "Обʼєктивно"]);
});

test("offsets rebuild the original text verbatim", () => {
  const src = "Перше речення. Друге речення!\nТретє";
  const s = splitSentences(src);
  assert.equal(s.map((x) => src.slice(x.start, x.end)).join(""), src);
});

test("equal counts ⇒ exact 1:1 mapping, speaker carried through", () => {
  const sentences = splitSentences("Болить голова. Другий день.");
  const segments = [
    seg(2000, 4500, "SPEAKER_01", "patient"),
    seg(4600, 7000, "SPEAKER_00", "doctor"),
  ];
  const spans = alignSentencesToSegments(sentences, segments);
  assert.equal(spans.length, 2);
  assert.deepEqual(spans[0], {
    startMs: 2000, endMs: 4500, exact: true, speaker: "S2", speakerRole: "patient",
  });
  assert.equal(spans[1].exact, true);
  assert.equal(spans[1].speakerRole, "doctor");
});

test("mismatched counts ⇒ approximate alignment by timing, never exact", () => {
  const sentences = splitSentences("Аа. Бб. Вв. Гг.");
  const segments = [seg(0, 8000, "SPEAKER_00", "doctor")];
  const spans = alignSentencesToSegments(sentences, segments);
  assert.equal(spans.length, 4);
  assert.equal(spans.every((s) => s.exact === false), true);
  // Monotonic, inside the recorded window, and covering it end to end.
  assert.equal(spans[0].startMs, 0);
  assert.equal(spans[3].endMs, 8000);
  for (let i = 1; i < spans.length; i++) {
    assert.ok(spans[i].startMs >= spans[i - 1].startMs, "spans move forward");
  }
});

test("no segments ⇒ no affordance (never a fabricated moment)", () => {
  const sentences = splitSentences("Болить голова. Другий день.");
  assert.deepEqual(alignSentencesToSegments(sentences, []), [null, null]);
  assert.deepEqual(alignSentencesToSegments(sentences, null), [null, null]);
});

test("degenerate segments are ignored rather than trusted", () => {
  const sentences = splitSentences("Одне речення тут.");
  // end <= start, and a non-numeric span: both unusable.
  const spans = alignSentencesToSegments(sentences, [seg(500, 500), seg(null, 900)]);
  assert.deepEqual(spans, [null]);
});

test("a sub-second sentence still gets an audible span", () => {
  const sentences = splitSentences("Так. Далі йде значно довше речення про стан пацієнта.");
  const spans = alignSentencesToSegments(sentences, [seg(0, 5000)]);
  assert.ok(spans[0].endMs - spans[0].startMs >= MIN_SPAN_MS);
});

test("diarisation ids are translated into the vocabulary the UI speaks", () => {
  assert.equal(normalizeSpeaker("SPEAKER_00"), "S1");
  assert.equal(normalizeSpeaker("SPEAKER_01"), "S2");
  assert.equal(normalizeSpeaker("SPEAKER_02"), "S3");
  assert.equal(normalizeSpeaker("UNKNOWN"), "UNKNOWN");
  assert.equal(normalizeSpeaker(null), null);
});
