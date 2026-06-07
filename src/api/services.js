// services.js — single source of truth for backend service base URLs.
// Matches the four OpenAPI snapshots committed at
// medical-dictation-backend/docs/api/{auth,asr,dictation,nlp}-service-openapi.json.
//
// Endpoints are FLAT — no /api/v1 prefix per backend convention.

const env = (typeof import.meta !== "undefined" && import.meta.env) || {};

export const SERVICES = {
  auth:      env.VITE_AUTH_SERVICE_URL      || "http://localhost:8000",
  asr:       env.VITE_ASR_SERVICE_URL       || "http://localhost:8001",
  dictation: env.VITE_DICTATION_SERVICE_URL || "http://localhost:8002",
  nlp:       env.VITE_NLP_SERVICE_URL       || "http://localhost:8005",
  // Clinical / EHR service (sprints 08-15): patients, encounters, consents,
  // anamnesis, clinical notes, reports, structured templates.
  core:      env.VITE_CORE_SERVICE_URL      || "http://localhost:8003",
};

// Derive the WS base from the dictation HTTP base. Always upgrade scheme.
export function dictationWsBase() {
  const http = SERVICES.dictation;
  return http.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
}

export const KEYCLOAK = {
  base: env.VITE_KEYCLOAK_BASE_URL || "http://localhost:8088",
  issuer: env.VITE_AUTH_ISSUER || "http://localhost:8088/realms/medical-dictation",
  audience: env.VITE_AUTH_AUDIENCE || "mdx-api",
  clientId: env.VITE_AUTH_CLIENT_ID || "mdx-frontend",
};

// Build-time injected in vite.config.js
export const APP_VERSION =
  (typeof __APP_VERSION__ !== "undefined" && __APP_VERSION__) || "0.0.0";

// Feature flags — flip via .env when the matching backend sprint ships.
const flag = (k) => String(env[k] ?? "false").toLowerCase() === "true";
export const FEATURES = {
  reports:       flag("VITE_FEAT_REPORTS"),        // sprint 08
  patients:      flag("VITE_FEAT_PATIENTS"),       // sprint 11
  notes:         flag("VITE_FEAT_NOTES"),          // sprint 12
  anamnesis:     flag("VITE_FEAT_ANAMNESIS"),      // sprint 13
  templates:     flag("VITE_FEAT_TEMPLATES"),      // sprint 06
  mfaEnrolment:  flag("VITE_FEAT_MFA_ENROLMENT"),  // sprint 16
};

// Deep-link to Keycloak's "Forgot password" form. The realm handles the rest;
// backend has no FE-facing reset-password endpoint.
export function passwordResetUrl() {
  const params = new URLSearchParams({ client_id: KEYCLOAK.clientId });
  return `${KEYCLOAK.base}/realms/medical-dictation/login-actions/reset-credentials?${params}`;
}
