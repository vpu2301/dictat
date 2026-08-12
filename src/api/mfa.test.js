// mfa.test.js — the failure taxonomy. Pure mapping, no network.
//
// These are the strings and statuses auth-service actually returns
// (services/auth-service/src/auth_service/routers/{mfa,login}.py). Getting one
// wrong does not break a build — it shows a clinician the wrong instruction at
// the moment they cannot log in, which is worse.

import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyEnrolError,
  classifyVerifyError,
  isMfaEnrolmentRequired,
  isOtpChallenge,
  otpErrorCode,
} from "./mfa.js";

// Shaped like src/api/client.js ApiError.
const apiError = (status, problem = {}) => ({ status, problem, message: problem.detail || "" });

// ── enrol ──────────────────────────────────────────────────────────────

test("enrol: a switched-off deployment is not a permission problem", () => {
  const err = apiError(403, {
    detail: "MFA enrolment is not enabled on this deployment (MDX_MFA_ENROLMENT_ENABLED)",
  });
  assert.equal(classifyEnrolError(err), "not_enabled");
});

test("enrol: an already-enrolled account points at the admin reset", () => {
  const err = apiError(409, { detail: "already enrolled; ask an administrator to reset MFA first" });
  assert.equal(classifyEnrolError(err), "already_enrolled");
});

test("enrol: a dead key store is temporary, not permanent", () => {
  assert.equal(classifyEnrolError(apiError(503, { detail: "MFA secret store unavailable: no master key" })), "unavailable");
});

test("enrol: a 403 that is NOT the disabled-surface one stays unknown", () => {
  // Guessing here would tell a user to wait for an administrator to enable a
  // feature that is already enabled.
  assert.equal(classifyEnrolError(apiError(403, { detail: "forbidden" })), "unknown");
});

// ── verify ─────────────────────────────────────────────────────────────

test("verify: a wrong code is a 400 and is retryable in place", () => {
  assert.equal(classifyVerifyError(apiError(400, { detail: "invalid TOTP code" })), "invalid_code");
});

test("verify: both 409 shapes mean the same thing — start over", () => {
  assert.equal(
    classifyVerifyError(apiError(409, { detail: "no pending enrolment; call POST /auth/mfa/enrol first" })),
    "restart_enrolment",
  );
  assert.equal(
    classifyVerifyError(apiError(409, { detail: "pending enrolment is unreadable; restart enrolment" })),
    "restart_enrolment",
  );
});

// ── login-time challenge ───────────────────────────────────────────────

test("otp_required opens the code step", () => {
  const err = apiError(401, { code: "otp_required", www_authenticate: 'MFA realm="medical-dictation"' });
  assert.ok(isOtpChallenge(err));
  assert.equal(otpErrorCode(err), "otp_required");
});

test("otp_invalid keeps the user on the code step rather than blaming the password", () => {
  const err = apiError(401, { code: "otp_invalid", detail: "invalid TOTP code" });
  assert.ok(isOtpChallenge(err));
  assert.equal(otpErrorCode(err), "otp_invalid");
});

test("otp_unavailable is NOT a challenge — asking again would loop forever", () => {
  // The secret store is down and the backend fails closed. A code field here
  // would be a box that can never be satisfied.
  const err = apiError(401, { code: "otp_unavailable", detail: "MFA verification unavailable; try again" });
  assert.equal(isOtpChallenge(err), false);
  assert.equal(otpErrorCode(err), "otp_unavailable");
});

test("a plain wrong password is not an MFA challenge", () => {
  const err = apiError(401, { detail: "invalid credentials" });
  assert.equal(isOtpChallenge(err), false);
  assert.equal(otpErrorCode(err), null);
});

test("a header-only MFA challenge is still a challenge", () => {
  // The `requires_mfa` dep answers 401 + WWW-Authenticate with no machine code.
  // Reading that as a bad password would tell someone whose password was right
  // to check their password.
  const err = apiError(401, { www_authenticate: 'MFA realm="medical-dictation"' });
  assert.ok(isOtpChallenge(err));
  assert.equal(otpErrorCode(err), null);
});

// ── the grace signal ───────────────────────────────────────────────────

test("403 mfa_enrolment_required is recognised in both problem shapes", () => {
  assert.ok(isMfaEnrolmentRequired(apiError(403, { code: "mfa_enrolment_required" })));
  assert.ok(isMfaEnrolmentRequired(apiError(403, { detail: { code: "mfa_enrolment_required" } })));
});

test("the grace signal is a 403 and nothing else", () => {
  // A 401 carrying the same code would be the re-login path, not enrolment;
  // routing it to the enrolment screen would strand an enrolled user there.
  assert.equal(isMfaEnrolmentRequired(apiError(401, { code: "mfa_enrolment_required" })), false);
  assert.equal(isMfaEnrolmentRequired(apiError(403, { code: "insufficient_scope" })), false);
  assert.equal(isMfaEnrolmentRequired(apiError(403, { detail: "forbidden" })), false);
  assert.equal(isMfaEnrolmentRequired(null), false);
});
