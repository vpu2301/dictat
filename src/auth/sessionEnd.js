// sessionEnd.js — one announcement for "this session is over", and why.
//
// Before sprint 16 the fetch client ended a session by doing two things
// inline: dropping the in-memory access token and assigning `location.hash =
// "/login"`. Both were necessary; together they were not sufficient, and the
// gap produced a bug you can only see once tokens can die early:
//
//   AuthContext still held { claims, dbUser }. App.jsx reads that state, sees
//   an authenticated user sitting on an auth route, and its `gateToHome`
//   effect navigates straight back to the workspace — which immediately makes
//   another 401. The user watched the app flicker between two screens with no
//   explanation, and the reason ("your session was revoked") existed only as a
//   thrown ApiError somewhere up the stack.
//
// Sprint 16's revocation denylist (ADR-0040) turns that from a rare race into
// a designed-for event: an administrator deactivating a user, or a refresh
// replay, now kills live access tokens within the second. So the end of a
// session becomes something the app announces once, and every interested part
// listens for:
//
//   · AuthProvider clears its state, so the router stops fighting the redirect
//   · LoginPage reads the reason and says what happened, instead of an error dump
//   · the dictation room stops capture and preserves its IndexedDB ring
//     (sprint-04 guarantee) so a revocation never costs a clinician their audio
//
// A leaf module by design — it imports nothing, so anything may import it.

// Why the session ended. Ordered roughly by how much explaining the user is
// owed.
export const SESSION_END = {
  // Signed out on purpose, here, by this user. Not an incident.
  SIGNED_OUT: "signed_out",
  // The refresh cookie is gone or rejected: the ordinary end of a long day.
  EXPIRED: "expired",
  // A signature-valid access token was refused — the session was killed
  // server-side before it expired (logout elsewhere, admin deactivation,
  // MFA reset). ADR-0040's denylist.
  REVOKED: "revoked",
  // A refresh token was presented twice. Either a stolen cookie or a broken
  // client; either way the backend force-revokes everything and refuses to
  // let us retry. The user must sign in again and someone should look.
  REPLAY: "replay",
};

const VALID = new Set(Object.values(SESSION_END));

// The reason survives the navigation to /login — the module outlives the route
// change because this is a single-page app, so no storage is involved (and no
// storage SHOULD be: "why did your session end" is not something to leave on
// a shared clinic workstation's disk).
let pendingReason = null;

const listeners = new Set();

/**
 * Subscribe. Returns an unsubscribe function.
 *
 * Listeners must not throw — one broken subscriber cannot be allowed to stop
 * the rest of the app from learning that the session is gone.
 */
export function onSessionEnd(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Announce the end of the session.
 *
 * Idempotent per reason: the fetch client can discover a revocation on six
 * parallel requests at once, and the user should be told once. Deliberately
 * does NOT clear the access token or navigate — the fetch client owns the
 * token and the router owns the URL. This only says what happened.
 */
export function endSession(reason) {
  const r = VALID.has(reason) ? reason : SESSION_END.EXPIRED;
  if (pendingReason === r) return r;
  pendingReason = r;
  for (const fn of [...listeners]) {
    try { fn(r); } catch { /* a subscriber's failure is not a session's problem */ }
  }
  return r;
}

/** The reason, without consuming it. */
export function peekSessionEndReason() {
  return pendingReason;
}

/**
 * Read the reason and clear it — the login screen calls this so a second visit
 * to /login (a back button, a reload of the SPA state) does not re-announce an
 * ending the user has already been told about and acted on.
 */
export function takeSessionEndReason() {
  const r = pendingReason;
  pendingReason = null;
  return r;
}

/**
 * Clear the reason without reading it. Called on a successful login: whatever
 * ended the previous session is history the moment a new one starts.
 */
export function clearSessionEndReason() {
  pendingReason = null;
}
