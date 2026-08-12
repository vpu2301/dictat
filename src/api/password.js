// password.js — account recovery and password management.
//
// Backend: services/auth-service/src/auth_service/routers/password.py.
//
// Three of these four calls run with NO session — the reset and lockdown
// links arrive from an email, in whatever browser the user happens to be
// reading mail in. `api()` attaches a bearer only if one exists, so the
// same client works signed in or out; nothing here may assume a token.
//
// THE ERROR TAXONOMY IS THE INTERESTING PART. The backend answers with
// RFC 7807 problem+json and a machine-readable `code`, deliberately so
// that the SPA can render each failure in the user's language rather
// than echoing English prose from the server. `passwordErrorCode` and
// `weakPasswordReasons` are the two readers for that.

import { api } from "./client.js";

/**
 * Ask for a reset link.
 *
 * ALWAYS resolves for a well-formed address — 202 whether or not an
 * account exists, whether it is deactivated, and whether the request was
 * throttled. That is the backend refusing to be an account-enumeration
 * oracle, and the UI must preserve it: show the same "check your email"
 * screen every time. Resist the temptation to add a "no such account"
 * message; it would undo the whole property.
 */
export async function requestPasswordReset(email, lang) {
  return api("/auth/password/forgot", {
    method: "POST",
    body: JSON.stringify(lang ? { email, lang } : { email }),
  });
}

/** Set a new password using a token from the reset email. 204 on success. */
export async function resetPassword(token, newPassword) {
  return api("/auth/password/reset", {
    method: "POST",
    body: JSON.stringify({ token, new_password: newPassword }),
  });
}

/** Change your own password. Requires the current one. 204 on success. */
export async function changePassword(currentPassword, newPassword) {
  return api("/auth/password/change", {
    method: "POST",
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
}

/**
 * "This wasn't me" — the button in the security-notification email.
 *
 * Ends every session, cancels outstanding reset links, and returns a
 * fresh `reset_token` so the page can go straight to setting a new
 * password without waiting for a second email.
 */
export async function triggerAccountLockdown(token) {
  return api("/auth/security/lockdown", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

/** The rules this deployment enforces, so the meter agrees with the server. */
export async function fetchPasswordPolicy() {
  return api("/auth/password/policy");
}

/** Recent security activity on the signed-in account. */
export async function fetchPasswordEvents() {
  return api("/auth/password/events");
}

/** Devices currently signed in. */
export async function fetchSessions() {
  return api("/auth/sessions");
}

/** Sign out everywhere, including this device. 204 on success. */
export async function revokeAllSessions() {
  return api("/auth/sessions/revoke-all", { method: "POST" });
}

// ── Error taxonomy ────────────────────────────────────────────────────

/** The backend's machine-readable failure code, or null. */
export function passwordErrorCode(err) {
  const p = err && err.problem;
  if (!p) return null;
  return p.code || (p.detail && p.detail.code) || null;
}

/** Reason slugs from a `weak_password` rejection (empty array otherwise). */
export function weakPasswordReasons(err) {
  const p = (err && err.problem) || {};
  return Array.isArray(p.reasons) ? p.reasons : [];
}

/** The server-enforced minimum, when it told us. */
export function weakPasswordMinLength(err) {
  const p = (err && err.problem) || {};
  return Number.isFinite(p.min_length) ? p.min_length : null;
}

export function isInvalidToken(err) {
  const code = passwordErrorCode(err);
  return code === "invalid_reset_token" || code === "invalid_lockdown_token";
}

// ── Client-side strength, for the meter only ──────────────────────────
//
// A MIRROR of services/auth-service/src/auth_service/domain/password_policy.py,
// and deliberately a partial one. It exists to give instant feedback as
// somebody types; the server's copy is the one that decides. Anything
// this misses is caught there and comes back as `weak_password`, which
// is why it is safe for this to be the loose approximation and unsafe to
// ever treat it as the gate.

const COMMON_FRAGMENTS = [
  "password", "passwort", "пароль", "qwerty", "123456", "letmein",
  "welcome", "admin", "iloveyou", "abc123", "changeme", "klarnote",
  "dictation", "medical", "clinic", "monkey", "dragon", "secret",
];

const LEET = { 0: "o", 1: "l", 3: "e", 4: "a", 5: "s", 7: "t", "@": "a", $: "s", "!": "i" };

function deleet(s) {
  return s.replace(/[013457@$!]/g, (c) => LEET[c] || c);
}

/**
 * Reason slugs for a candidate password — the same vocabulary the
 * backend uses, so one message table serves both.
 */
export function localPasswordReasons(password, { minLength = 12, email = "", displayName = "" } = {}) {
  const reasons = [];
  if (!password) return reasons;
  if (!password.trim()) return ["whitespace_only"];
  if (password.length < minLength) reasons.push("too_short");
  if (password.length > 128) reasons.push("too_long");

  const norm = password.normalize("NFKC").toLowerCase();
  // Strip padding from the ORIGINAL, then de-leet — not the other way
  // round. De-leeting maps digits to letters, so `password1234` becomes
  // `passwordl2ea` and the trailing junk is no longer strippable. The
  // backend had exactly this bug and its test suite caught it.
  const stripped = norm.replace(/^[\W\d_]+|[\W\d_]+$/g, "");
  const candidates = [norm, deleet(norm), stripped, deleet(stripped)];
  if (COMMON_FRAGMENTS.some((f) => candidates.includes(f))) reasons.push("common");

  const fragments = [];
  for (const raw of [email, displayName]) {
    if (!raw) continue;
    const local = String(raw).toLowerCase().split("@")[0];
    fragments.push(local, ...local.split(/[.\-_+\s]+/));
  }
  if (fragments.filter((f) => f.length >= 4).some((f) => norm.includes(f))) {
    reasons.push("contains_identifier");
  }

  if (new Set(password).size <= 2 && password.length >= 4) reasons.push("repeated");

  const SEQS = ["abcdefghijklmnopqrstuvwxyz", "0123456789", "qwertyuiop", "asdfghjkl", "zxcvbnm"];
  for (const seq of SEQS) {
    const rev = [...seq].reverse().join("");
    for (let i = 0; i + 5 <= seq.length; i += 1) {
      if (norm.includes(seq.slice(i, i + 5)) || norm.includes(rev.slice(i, i + 5))) {
        reasons.push("sequential");
        i = seq.length;
        break;
      }
    }
    if (reasons.includes("sequential")) break;
  }

  return [...new Set(reasons)];
}

/** 0–4 for the meter. Display only — never a gate. */
export function passwordScore(password) {
  if (!password || password.length < 12) return 0;
  const variety =
    (/[a-z]/.test(password) ? 1 : 0) +
    (/[A-Z]/.test(password) ? 1 : 0) +
    (/\d/.test(password) ? 1 : 0) +
    (/[^\w]/.test(password) ? 1 : 0);
  let score = 1;
  if (password.length >= 16) score += 1;
  if (password.length >= 20) score += 1;
  if (variety >= 3) score += 1;
  return Math.min(score, 4);
}
