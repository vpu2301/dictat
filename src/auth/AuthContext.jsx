// AuthContext.jsx — React context carrying { claims, dbUser } after login.
import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from "react";

import { onSessionEnd } from "./sessionEnd.js";
import { clearBreakGlass } from "../patients/breakGlass.js";

// Everything a session leaves behind in tab storage that the NEXT person at
// this workstation must not inherit. sessionStorage is scoped to the tab, not
// to the session, so signing out does not clear it on its own.
//
// The break-glass episode memory is here because it names a patient and a
// stated reason, and because it drives a banner: inherited, it told the next
// user — usually a clinician with standing access — that their ordinary read
// was an exception being counted (2026-08-09). The store is owner-scoped as
// well; this is the second lock, not the first.
function forgetSessionTraces() {
  if (typeof sessionStorage === "undefined") return;
  clearBreakGlass(sessionStorage);
}

// Exported so a test can render a real component AS a given role
// (src/testing/renderRole.mjs) instead of asserting about its source text.
// Proving that a nurse is not SERVED the sign button — rather than that the
// string "Підписати" is absent from a file — needs the provider, and the
// provider needs the context. App code must keep using `useAuth()`.
export const AuthContext = createContext({
  state: null,
  setState: () => {},
  clear: () => {},
});
const AuthCtx = AuthContext;

export function AuthProvider({ children }) {
  const [state, setState] = useState(null); // null | { claims, dbUser }
  // `clear` is how the app says "this session is over" locally — the sign-out
  // button and the company console both call it.
  const clear = useCallback(() => {
    forgetSessionTraces();
    setState(null);
  }, []);

  // Sprint 16. The fetch client can now discover mid-session that the session
  // is over — expired, revoked by an administrator, or force-killed after a
  // refresh replay — and it announces that on the session-end bus.
  //
  // This subscription is what makes the announcement true for the router. The
  // client already redirected to /login, but App.jsx decides which screen to
  // render from THIS state: an authenticated user sitting on an auth route
  // trips its `gateToHome` effect and gets sent back to the workspace, which
  // 401s, which redirects to /login… A revoked clinician used to watch the app
  // flicker between two screens. Clearing here breaks the loop at its cause.
  useEffect(() => onSessionEnd(() => {
    forgetSessionTraces();
    setState(null);
  }), []);

  const value = useMemo(() => ({ state, setState, clear }), [state, clear]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}

export function useClaims() {
  const a = useContext(AuthCtx);
  return a.state ? a.state.claims : null;
}

export function hasAnyRole(claims, roles) {
  if (!claims || !Array.isArray(claims.roles)) return false;
  return claims.roles.some((r) => roles.includes(r));
}
