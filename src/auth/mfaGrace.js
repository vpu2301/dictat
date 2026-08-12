// mfaGrace.js — the "enrol first" signal, and where it leads.
//
// A leaf module ON PURPOSE: it imports nothing. The fetch client has to act on
// this signal, and src/api/mfa.js (which owns the enrolment calls) imports the
// fetch client — so parking the detection in either of them would close an
// import cycle. It lives here and both read it.
//
// THE SIGNAL. Once a deployment turns on `MDX_REQUIRE_MFA`, auth-service and
// core-service split a caller whose token lacks `mfa` by enrolment status
// (auth-service `deps.requires_mfa`, sprint 16 / ADR-0039):
//
//   · already enrolled, holding a pre-enrolment token → 401 + `WWW-Authenticate:
//     MFA`. They have an authenticator; they need to log in again with a code.
//     That is the login form's job (src/api/mfa.js `isOtpChallenge`).
//   · not enrolled → 403 with `code: "mfa_enrolment_required"`. This one. It
//     is not a refusal, it is a precondition: the platform is saying "you may
//     do this, once you have a second factor".
//
// Which is why the response is a redirect to enrolment and NOT the standard
// forbidden page. A forbidden page tells a clinician to contact an
// administrator about something they can fix themselves in forty seconds, and
// the grace flow exists precisely so a tenant can stage enrolment without
// locking its staff out first.

export const MFA_ENROLMENT_REQUIRED = "mfa_enrolment_required";

// Hash route of the enrolment screen (src/pages/MfaPage.jsx, wired in App.jsx).
// `required=1` tells that screen it was reached by the grace signal rather than
// by a click, so it can open by explaining the interruption. In the URL rather
// than in a module variable so a reload keeps the explanation.
export const MFA_ENROLMENT_ROUTE = "/mfa?required=1";

// The path alone — for "am I already there?" checks that must not be defeated
// by a query string.
export const MFA_ENROLMENT_PATH = "/mfa";

/**
 * Where enrolment sends the user afterwards. Only an in-app hash path is
 * acceptable: the value round-trips through the URL, so a crafted link could
 * otherwise send a freshly-enrolled admin to an arbitrary origin ("//evil")
 * or loop them straight back into /mfa. Anything suspect collapses to "/".
 */
export function sanitizeMfaReturn(raw) {
  const p = String(raw || "");
  if (!p.startsWith("/")) return "/";
  if (p.startsWith("//")) return "/"; // protocol-relative — not an in-app path
  if (p === MFA_ENROLMENT_PATH
      || p.startsWith(`${MFA_ENROLMENT_PATH}?`)
      || p.startsWith(`${MFA_ENROLMENT_PATH}/`)) return "/"; // no enrolment loop
  return p;
}

/**
 * The enrolment route carrying the way back. The fetch client calls this with
 * the hash path the user was on when the 403 grace signal arrived, so the
 * "done" screen can return them to the exact surface that was interrupted —
 * an admin bounced out of a role editor should land back in the roster, not
 * on the home screen.
 */
export function mfaEnrolmentRoute(returnTo) {
  const back = sanitizeMfaReturn(returnTo);
  if (back === "/") return MFA_ENROLMENT_ROUTE;
  return `${MFA_ENROLMENT_ROUTE}&return=${encodeURIComponent(back)}`;
}

/**
 * Is this ApiError the grace signal?
 *
 * The code rides as an RFC 9457 extension member on the problem body. Where a
 * FastAPI route raises with a dict `detail=`, the problem middleware nests it
 * one level down instead — so both shapes are accepted rather than making the
 * frontend depend on which style a given service happened to use.
 */
export function isMfaEnrolmentRequired(err) {
  if (!err || err.status !== 403) return false;
  const p = err.problem || {};
  if (p.code === MFA_ENROLMENT_REQUIRED) return true;
  return !!(p.detail && typeof p.detail === "object" && p.detail.code === MFA_ENROLMENT_REQUIRED);
}
