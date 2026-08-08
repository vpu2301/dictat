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
  // Sprint 12 — notification feed, WebSocket push, preferences.
  notification: env.VITE_NOTIFICATION_SERVICE_URL || env.VITE_NOTIFICATION_URL || "http://localhost:8004",
  // Sprint 15 — Layer C inline generative completion (ADR-0036). Its own
  // service because it owns a model process, a slot pool and a latency budget
  // that must never share a queue with the corpus autocomplete on :8007.
  generation:   env.VITE_GENERATION_SERVICE_URL   || env.VITE_GENERATION_URL   || "http://localhost:8009",

  // ── evidence (EVA-S03) ─────────────────────────────────────────────
  // The browser-facing evidence services. In production all three resolve to
  // the same same-origin gateway as every other service above; the ports are
  // the dev-compose split.
  evidenceRetrieval: env.VITE_EVIDENCE_RETRIEVAL_URL || "http://localhost:8011",
  evidenceAnswer:    env.VITE_EVIDENCE_ANSWER_URL    || "http://localhost:8013",
  evidenceWebsearch: env.VITE_EVIDENCE_WEBSEARCH_URL || "http://localhost:8014",
  //
  // NOT LISTED, DELIBERATELY: evidence-ingest (:8010).
  //
  // It is an INTERNAL-ONLY service. Corpus ingestion, snapshots, retractions
  // and quarantine decisions are operator work: the CLI and a service-token
  // ops API, bound to 127.0.0.1 in the compose file, with no browser-facing
  // auth path at all. The SPA must never call it — an `ingest:` entry here
  // would be the first step towards a client that cannot work, wired to a
  // port a clinic's browser cannot reach.
  //
  // The knowledge-admin portal that finally fronts those operations arrives in
  // S12 and will talk to whatever browser-facing API that sprint specifies;
  // until then `evidence.corpus.manage` has no UI (see handoff.md § Evidence).
  //
  // The services the SPA WILL call are evidence-retrieval and the answer API,
  // and they land in S03 — this comment is the reminder that :8010 is not one
  // of them.

  // ── evidence chat (EvidenzAI) ──────────────────────────────────────
  // NOT one of this platform's microservices. It is the separate EvidenzAI
  // product's API (its own repo, its own datastores, its own accounts), and it
  // is what answers the questions asked in #/chat — `POST {base}/api/v1/query`,
  // streamed as SSE. Blank by default: with no URL the chat module answers
  // from its fixtures, which is the correct behaviour for every environment
  // where that backend is not deployed and reachable.
  //
  // Distinct from `evidenceAnswer` (:8013) above, which is THIS platform's own
  // answer service, specified in EVA-S04 and not yet built. When it exists,
  // the chat module points at it by swapping this base URL and the small
  // response mapping in src/chat/data/ — the module itself does not change.
  evidenceChat: env.VITE_EVIDENCE_CHAT_URL || "",
};

// ── readiness paths ──────────────────────────────────────────────────
// Every service THIS platform builds answers /readyz (spec §A sprint 01), so
// that is the default and the map below stays empty for all of them. It exists
// for the foreign ones: `evidenceChat` is another product and never agreed to
// our convention, and probing it at /readyz gets a 404 that the health panel
// reads as "answering but not ready" — a service reported broken while it is
// serving fine. Lives here because this is the file that knows what each entry
// in SERVICES actually is; both health surfaces (components/HealthBadge.jsx
// and the owner console's fetchPlatformHealth) read it rather than each
// hardcoding a path.
export const DEFAULT_READY_PATH = "/readyz";

const READY_PATH_OF = {
  // EvidenzAI: liveness /api/v1/health/live, readiness here. Answers 200 with
  // {status:"degraded", hf:"down", postgres:"ok", …} when a dependency is out,
  // which names the broken part — worth reading, hence worth probing right.
  evidenceChat: "/api/v1/health/ready",
};

/** Readiness path for a SERVICES key. */
export const readyPathFor = (name) => READY_PATH_OF[name] || DEFAULT_READY_PATH;

// Derive the WS base from the dictation HTTP base. Always upgrade scheme.
export function dictationWsBase() {
  return wsBase(SERVICES.dictation);
}

// Sprint 12 — same derivation for the notification socket.
export function notificationWsBase() {
  return wsBase(SERVICES.notification);
}

function wsBase(http) {
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

// DEV-ONLY runtime override. Vite flags are build-time constants, so a
// Playwright spec cannot flip one — yet the evidence suite has to prove both
// states in a single run: that the devtools are invisible while off, and that
// they work while on. An invisibility test whose "on" case is never exercised
// passes just as happily against a module that is broken or deleted.
//
// `import.meta.env.DEV` is statically replaced with `false` in a production
// build, so this whole function is dead code there — a flag cannot be turned
// on in a clinic by writing to localStorage.
function devFlagOverride(key) {
  if (!import.meta.env?.DEV) return false;
  try {
    return localStorage.getItem(`mdx.flag.${key}`) === "1";
  } catch {
    return false;
  }
}
export const FEATURES = {
  templates:     flag("VITE_FEAT_TEMPLATES"),      // report-service template create (doc 02 §A4)
  reports:       flag("VITE_FEAT_REPORTS"),        // report-service /versions + /pdf (doc 02 §A)
  patients:      flag("VITE_FEAT_PATIENTS"),       // core-service patients/encounters (doc 01 M2)
  notes:         flag("VITE_FEAT_NOTES"),          // core-service notes + scribe (doc 01 M4/M5)
  anamnesis:     flag("VITE_FEAT_ANAMNESIS"),      // core-service anamnesis + privacy (doc 01 M3/M6)
  mfaEnrolment:  flag("VITE_FEAT_MFA_ENROLMENT"),  // backend /auth/mfa/* (future sprint)
  notifications: flag("VITE_FEAT_NOTIFICATIONS"),  // notification-service :8004 (sprint 12)
  // EVA-S03 — the evidence devtools (#/evidence/dev/*). Not a clinician
  // feature and never will be: these screens talk to the retrieval service in
  // its own vocabulary (connectors, fusion scores, snapshots) so the people
  // building the pipeline can see what it returned. Off everywhere by default;
  // on a developer's machine and, deliberately, nowhere else.
  evidenceDevtools: flag("VITE_FEAT_EVIDENCE_DEVTOOLS") || devFlagOverride("evidenceDevtools"),

  // EVA-S04 — the first CLINICIAN-facing evidence surface (#/evidence). This
  // is the flag that decides whether the module exists for a doctor at all;
  // `evidenceDevtools` above is a separate, developer-only switch and neither
  // implies the other. Backend dependency: evidence-answer (:8013).
  evidence: flag("VITE_FEAT_EVIDENCE") || devFlagOverride("evidence"),
  // Sub-flags of `evidence`, and meaningless without it. Split out because
  // they gate on things that arrive on their own schedules:
  //   · suggestions — GET /suggestions, which needs a specialty-seeded
  //     question bank the answer service does not ship with.
  //   · externalLinks — whether a web citation may be an <a> at all. OFF is
  //     the safe default and the one a clinic behind an egress proxy runs:
  //     the source still shows its domain and access date, but nothing in the
  //     evidence UI navigates out of the app.
  evidenceSuggestions:   flag("VITE_FEAT_EVIDENCE_SUGGESTIONS")    || devFlagOverride("evidenceSuggestions"),
  evidenceExternalLinks: flag("VITE_FEAT_EVIDENCE_EXTERNAL_LINKS") || devFlagOverride("evidenceExternalLinks"),
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
