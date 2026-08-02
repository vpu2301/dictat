// chat/SessionContext.jsx — "who am I / which workspace".
//
// The seam the brief cares about most. In this variant it is filled from props
// the host passes to <ChatEmbed>; there is no login path, no token, no storage
// read. Next sprint the host's real identity injection lands behind exactly
// this shape and no screen changes.

import React, { createContext, useContext, useMemo } from "react";

const SessionContext = createContext(null);

export function SessionProvider({ user, workspace, children }) {
  const value = useMemo(() => ({
    user: user || null,
    workspace: workspace || null,
  }), [user, workspace]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession() outside <SessionProvider> — mount the module via <ChatEmbed>.");
  }
  return ctx;
}
