// password.test.js — the client-side strength mirror and error readers.
//
// The mirror exists for instant feedback while typing; the server
// decides. What these tests protect is that the two AGREE on the common
// cases, because a client that accepts what the server rejects produces
// a form that looks fine and then fails on submit — the worst of both.
//
// The blocklist-with-suffix case is here specifically: the backend had a
// bug where de-leeting before stripping the numeric padding let
// `password1234` through, and this mirror is written the same way round.

import test from "node:test";
import assert from "node:assert/strict";

import {
  isInvalidToken,
  localPasswordReasons,
  passwordErrorCode,
  passwordScore,
  weakPasswordMinLength,
  weakPasswordReasons,
} from "./password.js";

test("a long passphrase is accepted", () => {
  assert.deepEqual(localPasswordReasons("correct horse battery staple"), []);
});

test("no composition rule is imposed — lowercase-only is fine if long", () => {
  assert.deepEqual(localPasswordReasons("thequickbrownfoxjumpsover"), []);
});

test("short passwords are rejected however complex", () => {
  assert.ok(localPasswordReasons("Aa1!Bb2@").includes("too_short"));
});

test("blocklisted passwords are rejected even with a numeric suffix", () => {
  // The order-of-operations case: strip padding from the ORIGINAL, then
  // de-leet. Doing it the other way turns "1234" into letters and the
  // padding is no longer strippable.
  for (const pw of ["password1234", "Passw0rd1234", "p@ssw0rd1234", "changeme1234"]) {
    assert.ok(localPasswordReasons(pw).length > 0, pw);
  }
});

test("a password containing the user's email local part is rejected", () => {
  const reasons = localPasswordReasons("kovalenko-is-here-now", {
    email: "olena.kovalenko@clinic.example",
  });
  assert.ok(reasons.includes("contains_identifier"));
});

test("short identifier fragments do not ban half the dictionary", () => {
  assert.deepEqual(localPasswordReasons("wanderlust morning", { email: "de@x.com" }), []);
});

test("sequential runs are rejected", () => {
  assert.ok(localPasswordReasons("abcdefghijklmn").includes("sequential"));
  assert.ok(localPasswordReasons("zzz12345678zzz").includes("sequential"));
});

test("a single repeated character is rejected", () => {
  assert.ok(localPasswordReasons("aaaaaaaaaaaaaaaa").includes("repeated"));
});

test("whitespace-only gets its own reason, not 'too short'", () => {
  assert.deepEqual(localPasswordReasons("                    "), ["whitespace_only"]);
});

test("minLength is honoured", () => {
  assert.deepEqual(localPasswordReasons("twelve chars", { minLength: 12 }), []);
  assert.ok(localPasswordReasons("twelve chars", { minLength: 20 }).includes("too_short"));
});

test("an empty password produces no reasons — the field is simply untouched", () => {
  assert.deepEqual(localPasswordReasons(""), []);
});

test("score is 0 below the length floor and rises with length", () => {
  assert.equal(passwordScore("short"), 0);
  assert.ok(passwordScore("elephant zoo marmalade tuesday") > passwordScore("elephant zoo"));
});

// ── Error readers ─────────────────────────────────────────────────────

test("passwordErrorCode reads the problem+json code", () => {
  assert.equal(passwordErrorCode({ problem: { code: "weak_password" } }), "weak_password");
  assert.equal(passwordErrorCode({ problem: {} }), null);
  assert.equal(passwordErrorCode(null), null);
});

test("weakPasswordReasons defaults to an empty array", () => {
  assert.deepEqual(weakPasswordReasons({ problem: { reasons: ["common"] } }), ["common"]);
  assert.deepEqual(weakPasswordReasons({ problem: {} }), []);
  assert.deepEqual(weakPasswordReasons(undefined), []);
});

test("weakPasswordMinLength returns null when absent", () => {
  assert.equal(weakPasswordMinLength({ problem: { min_length: 14 } }), 14);
  assert.equal(weakPasswordMinLength({ problem: {} }), null);
});

test("isInvalidToken covers both link kinds", () => {
  assert.ok(isInvalidToken({ problem: { code: "invalid_reset_token" } }));
  assert.ok(isInvalidToken({ problem: { code: "invalid_lockdown_token" } }));
  assert.ok(!isInvalidToken({ problem: { code: "weak_password" } }));
});
