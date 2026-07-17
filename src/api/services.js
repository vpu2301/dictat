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
  // The platform is split per the backend integration guide (2026-06-20):
  // reports + templates, autocomplete, and signing are distinct services on
  // their own ports — NOT one monolithic "core" service. In production all of
  // these point at the same same-origin gateway (guide §7).
  report:       env.VITE_REPORT_SERVICE_URL       || env.VITE_REPORT_URL       || "http://localhost:8006",
  autocomplete: env.VITE_AUTOCOMPLETE_SERVICE_URL || env.VITE_AUTOCOMPLETE_URL || "http://localhost:8007",
  signing:      env.VITE_SIGNING_SERVICE_URL      || env.VITE_SIGNING_URL      || "http://localhost:8008",
  // Clinical / EHR endpoints not yet covered by the integration guide
  // (patients, encounters, consents, anamnesis, clinical notes, scribe).
  core:      env.VITE_CORE_SERVICE_URL      || env.VITE_CORE_URL || "http://localhost:8003",
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

// Feature flags — flip via .env only once the gating backend is deployed AND
// CORS-reachable in that environment (doc 03 §1). Comment = backend dependency.
const flag = (k) => String(env[k] ?? "false").toLowerCase() === "true";
export const FEATURES = {
  templates:     flag("VITE_FEAT_TEMPLATES"),      // report-service template create (doc 02 §A4)
  reports:       flag("VITE_FEAT_REPORTS"),        // report-service /versions + /pdf (doc 02 §A)
  patients:      flag("VITE_FEAT_PATIENTS"),       // core-service patients/encounters (doc 01 M2)
  notes:         flag("VITE_FEAT_NOTES"),          // core-service notes + scribe (doc 01 M4/M5)
  anamnesis:     flag("VITE_FEAT_ANAMNESIS"),      // core-service anamnesis + privacy (doc 01 M3/M6)
  mfaEnrolment:  flag("VITE_FEAT_MFA_ENROLMENT"),  // backend /auth/mfa/* (future sprint)
};

// /signup "Request access" leads (doc 03 §4.1). Admin-invite-only platform —
// there is no self-serve account creation; leads are emailed to this address.
// Blank → the form shows its success state without composing a mail draft.
export const ACCESS_REQUEST_EMAIL = env.VITE_ACCESS_REQUEST_EMAIL || "";

// Deep-link to Keycloak's "Forgot password" form. The realm handles the rest;
// backend has no FE-facing reset-password endpoint.
export function passwordResetUrl() {
  const params = new URLSearchParams({ client_id: KEYCLOAK.clientId });
  return `${KEYCLOAK.base}/realms/medical-dictation/login-actions/reset-credentials?${params}`;
}
