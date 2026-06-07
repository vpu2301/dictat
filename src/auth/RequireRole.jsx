// RequireRole.jsx — Renders <ForbiddenPage> if the user lacks the required role,
// or redirects to /login if there is no session at all.
import React, { useEffect } from "react";
import { useAuth, hasAnyRole } from "./AuthContext.jsx";
import { ForbiddenPage } from "../pages/ForbiddenPage.jsx";

export function RequireAuth({ children, navigate }) {
  const { state } = useAuth();
  useEffect(() => {
    if (!state && typeof navigate === "function") navigate("/login");
  }, [state, navigate]);
  if (!state) return null;
  return children;
}

export function RequireRole({ any, children, navigate }) {
  const { state } = useAuth();
  useEffect(() => {
    if (!state && typeof navigate === "function") navigate("/login");
  }, [state, navigate]);
  if (!state) return null;
  if (!hasAnyRole(state.claims, any)) {
    return <ForbiddenPage required={any} actual={state.claims.roles} navigate={navigate} />;
  }
  return children;
}
