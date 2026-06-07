// AuthContext.jsx — React context carrying { claims, dbUser } after login.
import React, { createContext, useContext, useMemo, useState, useCallback } from "react";

const AuthCtx = createContext({
  state: null,
  setState: () => {},
  clear: () => {},
});

export function AuthProvider({ children }) {
  const [state, setState] = useState(null); // null | { claims, dbUser }
  const clear = useCallback(() => setState(null), []);
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
