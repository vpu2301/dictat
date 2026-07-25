// RequireRole.jsx — Renders <ForbiddenPage> if the user lacks the required role,
// or redirects to /login if there is no session at all.
import React, { useEffect } from "react";
import { useAuth, hasAnyRole } from "./AuthContext.jsx";
import { CLINICAL_ROLES, hasClinicalAccess } from "./permissions.js";
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

/**
 * S14 — gate a surface that shows clinical content (notes, dictations,
 * reports). Admits clinician / nurse; refuses an administrator who holds
 * neither, which since S14 is every admin-only account.
 *
 * This is presentation, not enforcement: the server denies these calls
 * regardless. What it buys is an honest, deep-link-safe answer instead of
 * a page that renders and then fills with 403s.
 *
 * Deliberately NOT applied to a single report's route — an admin holding a
 * break-glass grant must be able to open exactly that report, and the
 * report view turns the backend's `phi_access_required` 403 into the
 * request flow.
 */
export function RequireClinical({ children, navigate }) {
  const { state } = useAuth();
  useEffect(() => {
    if (!state && typeof navigate === "function") navigate("/login");
  }, [state, navigate]);
  if (!state) return null;
  if (!hasClinicalAccess(state.claims)) {
    return (
      <ForbiddenPage required={CLINICAL_ROLES} actual={state.claims.roles} navigate={navigate} />
    );
  }
  return children;
}
