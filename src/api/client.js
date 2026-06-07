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
