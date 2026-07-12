// node --test unit tests for prefix extraction (npm run test:unit).
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractPrefix, MAX_PREFIX_LEN } from "./prefix.js";

test("simple word start", () => {
  assert.deepEqual(extractPrefix("зад"), {
    prefix: "зад",
    kind: "phrase",
    fallback: null,
  });
});

test("multi-word stem with lead-in gets a last-word fallback", () => {
  const r = extractPrefix("пацієнт скаржиться на зад");
  assert.equal(r.prefix, "пацієнт скаржиться на зад");
  assert.equal(r.fallback, "зад");
  assert.equal(r.kind, "phrase");
});

test("stem restarts after sentence punctuation", () => {
  const r = extractPrefix("Стан задовільний. біль за груд");
  assert.equal(r.prefix, "біль за груд");
  assert.equal(r.fallback, "груд");
});

test("nothing right after a boundary or space", () => {
  assert.equal(extractPrefix("скарги на "), null);
  assert.equal(extractPrefix("скарги,"), null);
  assert.equal(extractPrefix(""), null);
  assert.equal(extractPrefix(null), null);
});

test("too-short token", () => {
  assert.equal(extractPrefix("з"), null);
});

test("snippet trigger keeps the slash, no fallback", () => {
  assert.deepEqual(extractPrefix("огляд /vit"), {
    prefix: "/vit",
    kind: "snippet",
    fallback: null,
  });
});

test("bare slash or malformed trigger is not a snippet", () => {
  assert.equal(extractPrefix("/"), null);
  assert.equal(extractPrefix("огляд /a/b"), null); // second slash → not a trigger
  assert.equal(extractPrefix("a/b/c").kind, "phrase"); // mid-word slash: plain text
});

test("long stem is tail-trimmed to a word start within the cap", () => {
  const words = Array.from({ length: 30 }, (_, i) => `слово${i}`).join(" ");
  const r = extractPrefix(words);
  assert.ok(r.prefix.length <= MAX_PREFIX_LEN);
  assert.ok(!r.prefix.startsWith(" "));
  // must still end with the word being typed
  assert.ok(r.prefix.endsWith("слово29"));
});

test("newline is a boundary", () => {
  const r = extractPrefix("перший рядок\nдруг");
  assert.equal(r.prefix, "друг");
});

test("two-char boundary: exactly MIN_PHRASE_PREFIX fires", () => {
  assert.deepEqual(extractPrefix("за"), {
    prefix: "за",
    kind: "phrase",
    fallback: null,
  });
});
