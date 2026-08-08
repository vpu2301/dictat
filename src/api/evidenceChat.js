// evidenceChat.js — which answer backend #/chat runs on, and how it is
// authenticated.
//
// The evidence chat module (src/chat) needs two things from this host: a base
// URL and `getToken()`. It is deliberately incurious about where either comes
// from, which is what lets this file answer the question for it.
//
// There are two possible answers, and `chatBackend()` at the bottom picks one:
//
//  1. `platform` — DEFAULT. This product's own `evidence-answer` (:8013,
//     SERVICES.evidenceAnswer), under the same Keycloak as every other service
//     here. The token is the session's own bearer; there is no second account,
//     no shared secret in the bundle, and nothing to arrange before it works.
//     This is the one that ships.
//
//  2. `evidenzai` — the separate product this chat UI was ported from, whose
//     answer API the module borrowed while this platform had none of its own.
//     Everything below documents that path. It is now OPT-IN
//     (`VITE_EVIDENCE_CHAT_DIALECT=evidenzai`) and dev-only, because its auth
//     story never had an answer — see the next paragraph.
//
// ── The problem, for option 2 ─────────────────────────────────────────────
// That backend is a separate product with its own accounts (email + password,
// Argon2, its own JWTs). This platform authenticates against Keycloak. There
// is no trust relationship between the two: a Keycloak access token means
// nothing to it, and it issues nothing this platform would accept.
//
// ── What this does, and what it is not ────────────────────────────────────
// In a DEV build only, it logs in once with a service account from `.env` and
// keeps the access token in memory for the tab. That is a development seam for
// pointing the UI at a real backend on a developer's machine. It is NOT a
// shipping auth story, and the guard is not cosmetic: Vite inlines env values
// into the bundle, so a password here would be readable by anyone who opens
// the JS in a browser. `import.meta.env.DEV` is statically false in a
// production build, so the whole credential path compiles out.
//
// ── What shipping needs (pick one, in another sprint) ─────────────────────
//  1. Token exchange: that backend accepts this platform's Keycloak token for
//     a linked account. Backend work in its repo; nothing changes here but the
//     body of `getToken`.
//  2. Per-clinician sign-in: the module gains a small "connect" step and each
//     clinician holds their own account. No shared secret, works in prod.
//  3. Server-side proxy: this platform's gateway holds the credential and
//     proxies /query. The browser never sees a second token at all.
//
// All three land behind `getToken()` and change nothing above it. Option 1 in
// the list at the top of this file — using our own service — is the fourth
// answer, and the one that was taken.

import { SERVICES } from "./services.js";
import { getAccessToken, tryRefresh } from "./client.js";

const env = (typeof import.meta !== "undefined" && import.meta.env) || {};

const DEV_EMAIL = env.VITE_EVIDENCE_CHAT_EMAIL || "";
const DEV_PASSWORD = env.VITE_EVIDENCE_CHAT_PASSWORD || "";

/** Configured AND able to authenticate — both, or the module stays on fixtures. */
export function evidenceChatConfigured() {
  if (!SERVICES.evidenceChat) return false;
  return !!(import.meta.env?.DEV && DEV_EMAIL && DEV_PASSWORD);
}

// In memory for the life of the tab. Deliberately not localStorage: a bearer
// token for a clinical API does not belong in storage a stray script can read,
// and losing it on reload costs one login round-trip.
let session = null;   // { accessToken, refreshToken, expiresAt }
let inFlight = null;

const url = (path) => `${String(SERVICES.evidenceChat).replace(/\/+$/, "")}/api/v1${path}`;

async function post(path, body) {
  const response = await fetch(url(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let detail = null;
    try { detail = await response.json(); } catch { /* not every failure is JSON */ }
    const error = new Error(detail?.message_en || detail?.code || `Evidence chat auth failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

// A minute of slack: a token that expires while the request is in flight is a
// 401 the user reads as "the service is broken".
const SKEW_MS = 60_000;
const store = (pair) => {
  session = {
    accessToken: pair.access_token,
    refreshToken: pair.refresh_token || null,
    expiresAt: Date.now() + Math.max(0, (pair.expires_in || 3600) * 1000) - SKEW_MS,
  };
  return session.accessToken;
};

async function authenticate() {
  if (session?.refreshToken) {
    try {
      return store(await post("/auth/refresh", { refresh_token: session.refreshToken }));
    } catch {
      // A rotated or expired refresh token is not an error worth surfacing —
      // it just means logging in again.
      session = null;
    }
  }
  return store(await post("/auth/login", { email: DEV_EMAIL, password: DEV_PASSWORD }));
}

/**
 * The module's whole view of auth. Returns a bearer token, or throws — and a
 * throw surfaces in the chat as a failed answer with a real message, which is
 * the honest outcome when the evidence backend will not talk to us.
 */
export async function getEvidenceChatToken() {
  if (session && Date.now() < session.expiresAt) return session.accessToken;
  // Concurrent sends must not each start a login; the first one wins and the
  // rest wait on it.
  if (!inFlight) {
    inFlight = authenticate().finally(() => { inFlight = null; });
  }
  return inFlight;
}

/** What <ChatEmbed backend={…}> takes for the EvidenzAI dialect. */
export function evidenceChatBackend() {
  if (!evidenceChatConfigured()) return null;
  return { baseUrl: SERVICES.evidenceChat, getToken: getEvidenceChatToken, dialect: "evidenzai" };
}

/** Test seam — drops the cached token. */
export function __resetEvidenceChatSession() { session = null; inFlight = null; }

// ── option 1: this platform's own answer service ──────────────────────────
//
// Nothing above applies here. `evidence-answer` trusts the same Keycloak realm
// the rest of the app does, so the token is the session's own bearer and the
// whole auth story is "hand over what we already have".
//
// The refresh is the one wrinkle. `client.js` refreshes on a 401 for ordinary
// calls, but the chat module holds its own `fetch` (it must: the module owns
// the stream), so the retry has to reach back here. It does that by calling
// `getToken({ refresh: true })` after a 401 — the same pre-flight refresh
// `streamAt()` performs, expressed as an argument.

export async function getPlatformChatToken({ refresh = false } = {}) {
  if (refresh) return (await tryRefresh()) || null;
  return getAccessToken() || (await tryRefresh()) || null;
}

/** What <ChatEmbed backend={…}> takes for this platform's own service. */
export function platformChatBackend() {
  if (!SERVICES.evidenceAnswer) return null;
  return {
    baseUrl: SERVICES.evidenceAnswer,
    getToken: getPlatformChatToken,
    dialect: "platform",
  };
}

/**
 * The backend `#/chat` runs on, or null to leave the module on its fixtures.
 *
 * Our own service wins unless this environment explicitly asks for the other
 * one. That default is the whole point: the borrowed backend was a stopgap, it
 * lives in a repo this one does not control, and when it stops running (or is
 * deleted) the chat must not go down with it.
 */
export function chatBackend() {
  if (env.VITE_EVIDENCE_CHAT_DIALECT === "evidenzai") {
    return evidenceChatBackend() || platformChatBackend();
  }
  return platformChatBackend() || evidenceChatBackend();
}
