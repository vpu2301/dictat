// mfa.js — TOTP enrolment, verification and admin reset (sprint 16).
//
// Backend: auth-service `routers/mfa.py`, ADR-0039. Three endpoints, and one
// rule that shapes this whole module:
//
//   THE SECRET IS A SECRET. `POST /auth/mfa/enrol` hands back a base32 TOTP
//   secret and an `otpauth://` URI containing it. That value is the second
//   factor. It must live in a React state variable for the length of the
//   enrolment and nowhere else — not localStorage, not sessionStorage, not a
//   URL, not a log line, not a component that survives the flow. Persisting it
//   anywhere the first factor's attacker can also reach turns two factors back
//   into one. e2e/mfa.spec.js asserts this by scraping both storages and the
//   console after a completed enrolment.
//
// The endpoint is spelled `enrol`, one L — matching the backend route, which
// matches the ADR. Not a typo.

import { api } from "./client.js";

/**
 * Begin enrolment. Returns { provisioning_uri, secret, issuer, account }.
 *
 * Enrolment is PENDING until verified: the backend stores the new secret under
 * a separate attribute and only promotes it once a code proves the user's
 * authenticator actually has it. So abandoning this screen costs nothing and
 * locks nobody out — which is why the UI can offer "start over" freely.
 */
export async function enrolMfa() {
  return api("/auth/mfa/enrol", { method: "POST" });
}

/** Complete enrolment with the first valid code. Returns { enrolled, enrolled_at }. */
export async function verifyMfa(code) {
  return api("/auth/mfa/verify", {
    method: "POST",
    body: JSON.stringify({ code: String(code).replace(/\D/g, "") }),
  });
}

/**
 * Admin-assisted reset — the lost-phone path. `user.reset_mfa`, tenant-scoped,
 * audited `sec`, and it ends every live session that user holds (a reset that
 * left an `mfa=true` session running would hand the account to whoever has the
 * old device). 204 on success.
 */
export async function resetMfa(sub) {
  return api(`/auth/mfa/${encodeURIComponent(sub)}`, { method: "DELETE" });
}

// ── Error taxonomy ─────────────────────────────────────────────────────
//
// The backend answers with an RFC 7807 problem whose `detail` names the cause
// in prose. Prose is for humans, and these particular humans are clinicians
// mid-login — so map it to a code the UI can translate, and be explicit that
// an unrecognised failure stays unrecognised rather than being guessed at.

const has = (e, needle) =>
  String((e && e.problem && e.problem.detail) || (e && e.message) || "")
    .toLowerCase()
    .includes(needle);

/** Classify a failure from enrolMfa(). */
export function classifyEnrolError(err) {
  const status = err && err.status;
  // The surface exists but the deployment has not switched it on
  // (MDX_MFA_ENROLMENT_ENABLED). Distinct from "you may not" — nothing the
  // user does will help, and the copy should say so.
  if (status === 403 && has(err, "not enabled")) return "not_enabled";
  // A secret is already stored. Re-enrolling would silently invalidate the
  // authenticator the user still has; only an admin reset clears it.
  if (status === 409) return "already_enrolled";
  // The envelope/KMS path is down. Fails closed by design.
  if (status === 503) return "unavailable";
  if (status === 401) return "unauthenticated";
  return "unknown";
}

/** Classify a failure from verifyMfa(). */
export function classifyVerifyError(err) {
  const status = err && err.status;
  if (status === 400) return "invalid_code";
  if (status === 403 && has(err, "not enabled")) return "not_enabled";
  // Either no pending enrolment at all, or one whose ciphertext no longer
  // decrypts. Both are recovered the same way: start over.
  if (status === 409) return "restart_enrolment";
  if (status === 503) return "unavailable";
  if (status === 401) return "unauthenticated";
  return "unknown";
}

// ── Login-time signals ─────────────────────────────────────────────────
//
// MFA at login is NOT a separate endpoint: auth-service's direct-grant proxy
// takes the TOTP code as an `otp` field on `POST /auth/login` and refuses the
// token without it. The refusal is a 401 carrying `WWW-Authenticate: MFA` and
// a machine `code`.

/**
 * "This login needs a TOTP code" — the signal that flips the login form into
 * its second step. `otp_unavailable` is deliberately NOT included: it means
 * the secret store is broken, and asking for a code that can never be checked
 * would strand the user in a loop.
 */
export function isOtpChallenge(err) {
  const code = err && err.problem && err.problem.code;
  if (code === "otp_required" || code === "otp_invalid") return true;
  // Older builds of the service signalled only through the header. Treat that
  // as a challenge too rather than showing "wrong password" to someone whose
  // password was right.
  if (code) return false;
  const wwwAuth = err && err.problem && err.problem.www_authenticate;
  return err && err.status === 401 && String(wwwAuth || "").toLowerCase().includes("mfa");
}

/** The login-time MFA code, or null when this failure is about something else. */
export function otpErrorCode(err) {
  const code = err && err.problem && err.problem.code;
  return ["otp_required", "otp_invalid", "otp_unavailable"].includes(code) ? code : null;
}

// ── The grace flow ─────────────────────────────────────────────────────
//
// Detecting the 403 `mfa_enrolment_required` lives in src/auth/mfaGrace.js,
// which imports nothing — client.js has to act on that signal, and client.js
// is what this module imports, so a shared leaf module is the only way to keep
// the two out of an import cycle. Re-exported here so callers have one place
// to reach for anything MFA.
export { MFA_ENROLMENT_REQUIRED, MFA_ENROLMENT_ROUTE, isMfaEnrolmentRequired } from "../auth/mfaGrace.js";
