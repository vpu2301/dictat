// client.js — fetch wrapper with in-memory access token + 401 refresh-retry.
//
// Per backend contract:
//   - Access token lives in module memory (not localStorage).
//   - Refresh cookie `mdx_rt` rides along automatically with credentials:"include".
//     Path is /auth, HttpOnly, set by backend.
//   - Bearer JWT on every authed call. Audience = mdx-api, RS256, aud-pinned.
//   - Auth-service URL is the canonical BASE_URL (sprint 02). For other
//     services (asr/dictation/nlp) use apiAt() with the corresponding base.
//
// Replay-detection caveat (spec §B sprint 02): if /auth/refresh returns a
// "refresh_replay_detected" problem, the whole session is force-revoked —
// FE must NOT retry refresh and must redirect to /login.

import { SERVICES } from "./services.js";

let inMemoryAccessToken = null;
let refreshPromise = null;
const listeners = new Set();

export function setAccessToken(t) {
  inMemoryAccessToken = t;
  listeners.forEach((fn) => { try { fn(t); } catch {} });
}
export function getAccessToken() { return inMemoryAccessToken; }
export function onAccessTokenChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// Auth-service base — historical export name. Prefer SERVICES.auth in new code.
export const BASE_URL = SERVICES.auth;

export class ApiError extends Error {
  constructor(status, problem) {
    super((problem && (problem.detail || problem.title)) || `HTTP ${status}`);
    this.status = status;
    this.problem = problem || {};
    // Backend uses RFC 7807 problem+json with instance = "urn:uuid:<uuid4>".
    // Surface it so the UI can show the correlation id to the user.
    this.instance = (problem && problem.instance) || null;
  }
}

// Distinguishes a non-recoverable refresh-replay from an ordinary 401.
// Tripped by /auth/refresh returning problem.code === "auth_refresh_replay"
// (the backend's audit event name is auth.refresh_replay_detected).
let replayDetected = false;
export function wasReplayDetected() { return replayDetected; }

async function refreshOnce() {
  if (replayDetected) throw new Error("refresh_replay_locked");
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const r = await fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!r.ok) {
      let problem = null;
      try { problem = await r.json(); } catch {}
      const code = problem && (problem.code || (problem.detail && problem.detail.code));
      if (r.status === 401 && code === "auth_refresh_replay") {
        replayDetected = true;
      }
      throw new ApiError(r.status, problem || { title: "refresh_failed" });
    }
    const body = await r.json();
    setAccessToken(body.access_token);
  })().finally(() => { refreshPromise = null; });
  return refreshPromise;
}

async function request(baseUrl, path, init = {}) {
  const exec = async () => {
    const headers = new Headers(init.headers || {});
    if (inMemoryAccessToken) headers.set("Authorization", `Bearer ${inMemoryAccessToken}`);
    if (init.body && !(init.body instanceof FormData) &&
        !(init.body instanceof URLSearchParams) &&
        !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    return fetch(`${baseUrl}${path}`, { ...init, headers, credentials: "include" });
  };

  let r;
  try {
    r = await exec();
  } catch (e) {
    throw new ApiError(0, { title: "Network error", detail: String(e && e.message ? e.message : e) });
  }

  if (r.status === 401 && inMemoryAccessToken && !replayDetected) {
    try {
      await refreshOnce();
      r = await exec();
    } catch {
      setAccessToken(null);
      if (typeof window !== "undefined" && !location.hash.startsWith("#/login")) {
        location.hash = "/login";
      }
      throw new ApiError(401, { title: "Session expired", detail: "Please log in again." });
    }
  }

  if (!r.ok) {
    const problem = await r.json().catch(() => ({ detail: r.statusText, title: `HTTP ${r.status}` }));
    // MFA / step-up is signalled via the WWW-Authenticate response header
    // (CORS-exposed by the backend), not the JSON body. Surface it on the
    // problem so callers like LoginPage can detect an MFA challenge.
    const wwwAuth = r.headers.get("www-authenticate");
    if (wwwAuth && problem && typeof problem === "object" && problem.www_authenticate == null) {
      problem.www_authenticate = wwwAuth;
    }
    throw new ApiError(r.status, problem);
  }
  if (r.status === 204) return undefined;
  const ct = r.headers.get("content-type") || "";
  if (ct.includes("application/json")) return r.json();
  return r.text();
}

// Auth-service shortcut.
export async function api(path, init = {}) {
  return request(BASE_URL, path, init);
}

// Arbitrary microservice (asr/dictation/nlp) using the same auth flow.
export async function apiAt(baseUrl, path, init = {}) {
  return request(baseUrl, path, init);
}

// ── streaming addendum (EVA-S04) ────────────────────────────────────────
//
// `request()` above buys the whole response before returning it, which is
// right for JSON and wrong for a server-sent-event stream whose entire point
// is arriving in pieces. `streamAt` is the same call with the same auth — the
// in-memory bearer, the single-flight refresh, the ApiError shape — stopping
// one step earlier and handing back the live `Response`.
//
// WHY NOT `EventSource`. It cannot set a header. Authenticating a stream would
// mean either a cookie (this platform has none for the API) or the token in
// the query string, where it lands in every proxy access log between the
// clinic and the service. A `fetch` with `Authorization` is the only version
// of this that is not a credential leak, and its body is a ReadableStream, so
// nothing is given up. See src/api/sse.js for the frame parser.
//
// THE 401 THAT MATTERS IS THE FIRST ONE. A token that expires mid-stream does
// not produce a second 401 — the response is already open and stays open. So
// the refresh-retry here is pre-flight only, exactly like `request()`. A drop
// after the headers is a transport failure, and the caller recovers by
// re-reading the resource with an ordinary GET (which refreshes normally).
// That is why the answer service must let a stream be resumed as a fetch.
export async function streamAt(baseUrl, path, init = {}) {
  const exec = async () => {
    const headers = new Headers(init.headers || {});
    headers.set("Accept", "text/event-stream");
    if (inMemoryAccessToken) headers.set("Authorization", `Bearer ${inMemoryAccessToken}`);
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    return fetch(`${baseUrl}${path}`, { ...init, headers, credentials: "include" });
  };

  let r;
  try {
    r = await exec();
  } catch (e) {
    throw new ApiError(0, { title: "Network error", detail: String(e && e.message ? e.message : e) });
  }

  if (r.status === 401 && inMemoryAccessToken && !replayDetected) {
    try {
      await refreshOnce();
      r = await exec();
    } catch {
      setAccessToken(null);
      if (typeof window !== "undefined" && !location.hash.startsWith("#/login")) {
        location.hash = "/login";
      }
      throw new ApiError(401, { title: "Session expired", detail: "Please log in again." });
    }
  }

  if (!r.ok) {
    const problem = await r.json().catch(() => ({ detail: r.statusText, title: `HTTP ${r.status}` }));
    throw new ApiError(r.status, problem);
  }
  return r;
}

// RootGate bootstrap: try refresh once, surface the new access token.
// Returns null on any failure (replay or otherwise) — never throws.
export async function tryRefresh() {
  try {
    const r = await fetch(`${BASE_URL}/auth/refresh`, { method: "POST", credentials: "include" });
    if (!r.ok) {
      if (r.status === 401) {
        const p = await r.json().catch(() => null);
        const code = p && (p.code || (p.detail && p.detail.code));
        if (code === "auth_refresh_replay") replayDetected = true;
      }
      return null;
    }
    const body = await r.json();
    setAccessToken(body.access_token);
    return body.access_token;
  } catch {
    return null;
  }
}

// ── E2E test seam (dev only) ────────────────────────────────────────────
// Exposes the live client on window so the Playwright suite (e2e/auth.spec.js)
// can drive single-flight / silent-refresh / refresh-fail→logout
// deterministically against route-mocked endpoints. Gated to Vite dev
// (import.meta.env.DEV) so it is never present in a production bundle.
if (typeof window !== "undefined" && import.meta.env && import.meta.env.DEV) {
  window.__mdxClient = { api, apiAt, getAccessToken, setAccessToken, tryRefresh, wasReplayDetected };
}
