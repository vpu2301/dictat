// RootGate.jsx — On mount, try POST /auth/refresh once. If it succeeds, fetch
// /auth/me and seed AuthContext. While in-flight, render a spinner.
// If refresh fails, we render children anyway and let route guards send the
// user to /login as needed.
import React, { useEffect, useState } from "react";
import { tryRefresh } from "../api/client.js";
import { me as fetchMe } from "../api/endpoints.js";
import { useAuth } from "./AuthContext.jsx";

export function RootGate({ children }) {
  const { setState } = useAuth();
  const [phase, setPhase] = useState("loading"); // loading | ready

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tok = await tryRefresh();
        if (tok) {
          const meBody = await fetchMe();
          if (!cancelled) setState({ claims: meBody.claims, dbUser: meBody.db_user });
        }
      } catch {
        // ignore — unauthenticated boot is fine
      } finally {
        if (!cancelled) setPhase("ready");
      }
    })();
    return () => { cancelled = true; };
  }, [setState]);

  if (phase === "loading") {
    return (
      <div
        role="status"
        aria-label="Restoring session"
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "var(--bg)",
          color: "var(--muted)",
          fontFamily: "var(--sans)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div className="spinner" />
          <div style={{ fontSize: 13 }}>Restoring session…</div>
        </div>
      </div>
    );
  }
  return children;
}
