// generation.js — Layer C inline generative completion (sprint 15, ADR-0036).
//
// generation-service (:8009), NOT autocomplete-service: Layer C owns a model
// process with its own slot pool and latency budget.
//
//   GET  /readyz                  → { status, layer_c_enabled, model }
//   POST /v1/completions/inline   → 200 completion | 204 silence
//
// The single doctrine of this module: **silence is a valid answer**. A typing
// clinician must never see an error because ghost text failed to materialise,
// so every non-200 — 204, 429, timeout, network death, malformed body —
// resolves to `null`. Nothing here ever throws at the caller.

import { getAccessToken } from "./client.js";
import { SERVICES } from "./services.js";

// Wire cap from the backend's Pydantic model (max_length=1000). Sending more
// would 422 — we slice the TAIL because the words nearest the caret are the
// ones the continuation must agree with.
export const MAX_PREFIX_CHARS = 1000;

// The backend enum is uk|en only. Every other UI language dictates in one of
// those two (Studio's dictation language picker offers exactly UK/EN).
export function completionLanguage(lang) {
  return lang === "uk" ? "uk" : "en";
}

// GET /readyz — the ONLY way the FE learns whether Layer C exists for this
// deployment (there is no bootstrap/config payload; see docs/sprint-15).
// Unauthenticated probe, so it works before the token lands. Any failure means
// "no Layer C" — never a visible error.
export async function generationReadyz({ signal } = {}) {
  try {
    const r = await fetch(`${SERVICES.generation}/readyz`, { method: "GET", signal });
    if (!r.ok) return { enabled: false, model: null, reachable: false };
    const body = await r.json();
    return {
      enabled: body?.layer_c_enabled === true,
      model: body?.model ?? null,
      reachable: true,
    };
  } catch {
    return { enabled: false, model: null, reachable: false };
  }
}

// POST /v1/completions/inline.
//
// Returns { request_id, completion, model, latency_ms } on 200,
// or null on 204 / 429 / abort / any failure. `retryAfterMs` is attached to
// the module-level last-429 hint rather than thrown, because the caller's job
// is to stop asking, not to explain.
//
// `signal` comes from the hook's AbortController: a newer keystroke cancels the
// in-flight request so a stale ghost can never land.
export async function inlineCompletion(
  { reportId, sectionKey, textBeforeCursor, language = "uk" },
  { signal } = {},
) {
  const prefix = String(textBeforeCursor ?? "").slice(-MAX_PREFIX_CHARS);
  if (!reportId || !sectionKey || !prefix) return null;

  const token = getAccessToken();
  let r;
  try {
    r = await fetch(`${SERVICES.generation}/v1/completions/inline`, {
      method: "POST",
      credentials: "include",
      signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      // extra="forbid" on the wire model: these four keys, no more.
      body: JSON.stringify({
        report_id: reportId,
        section_key: String(sectionKey).slice(0, 64),
        text_before_cursor: prefix,
        language: completionLanguage(language),
      }),
    });
  } catch {
    return null; // network death / abort — silence
  }

  if (r.status === 429) {
    const ra = Number(r.headers.get("retry-after"));
    return { rateLimited: true, retryAfterMs: Number.isFinite(ra) ? ra * 1000 : 30_000 };
  }
  if (r.status !== 200) return null; // 204 (the common case), 4xx, 5xx — all silent
  try {
    const body = await r.json();
    const completion = typeof body?.completion === "string" ? body.completion : "";
    if (!completion) return null;
    return {
      requestId: body.request_id ?? null,
      completion,
      model: body.model ?? null,
      latencyMs: Number(body.latency_ms) || 0,
    };
  } catch {
    return null;
  }
}
