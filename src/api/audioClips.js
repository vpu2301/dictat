// audioClips.js — tap-to-hear replay (sprint 15, ADR-0037).
//
// report-service (:8006):
//   GET  /v1/reports/{id}/sections/{key}/audio-clips   segment timings + speakers
//   POST /v1/audio-clips                               mint a clip (tokenised URL)
//   GET  /v1/audio-clips/{clip_id}?t=…                 decrypt-and-stream Ogg
//
// Two contract facts shape this module:
//
//  1. The `?t=` token NARROWS the window, it never replaces authentication —
//     the stream GET still needs the bearer, so the clip cannot be handed to
//     an <audio src> directly. We fetch the bytes and hand over an object URL.
//  2. Unavailability is a first-class ANSWER, not a failure: 410 carries a
//     machine-readable `code` naming exactly why the recording is gone. The UI
//     renders that honestly instead of "something went wrong".

import { apiAt, getAccessToken, ApiError } from "./client.js";
import { SERVICES } from "./services.js";
import { isMissingPurposeError } from "./reports.js";

const a = (p, init) => apiAt(SERVICES.report, p, init);

// Backend cap (`clip_max_span_ms`): a longer span 422s — "replay is review,
// not export". Callers clamp BEFORE asking so the user sees audio, not an error.
export const CLIP_MAX_SPAN_MS = 60_000;

// GET the section's audio segments. `[]` is a legitimate answer (batch reports
// carry no session transcript) and means "no replay affordance here".
//
// Same non-author ?purpose= rule as every single-report content surface: try
// bare (author reads must NOT send one), retry once as clinical_continuity.
export async function listSectionAudioSegments(reportId, sectionKey, { purpose } = {}) {
  const path = (p) =>
    `/v1/reports/${encodeURIComponent(reportId)}/sections/${encodeURIComponent(sectionKey)}` +
    `/audio-clips${p ? `?purpose=${encodeURIComponent(p)}` : ""}`;
  try {
    const r = await a(path(purpose), { method: "GET" });
    return Array.isArray(r) ? r : [];
  } catch (e) {
    if (!purpose && isMissingPurposeError(e)) {
      const r = await a(path("clinical_continuity"), { method: "GET" });
      return Array.isArray(r) ? r : [];
    }
    throw e;
  }
}

// POST /v1/audio-clips → { clip_id, clip_url, expires_at_unix }.
// The span is clamped to the backend's cap here so a long sentence degrades to
// "the first 60 s of it" rather than a 422 the clinician can do nothing about.
export async function createAudioClip({ reportId, startMs, endMs }, { purpose } = {}) {
  const start = Math.max(0, Math.round(startMs));
  const end = Math.min(Math.round(endMs), start + CLIP_MAX_SPAN_MS);
  const body = JSON.stringify({ report_id: reportId, start_ms: start, end_ms: end });
  const path = (p) => `/v1/audio-clips${p ? `?purpose=${encodeURIComponent(p)}` : ""}`;
  try {
    return await a(path(purpose), { method: "POST", body });
  } catch (e) {
    if (!purpose && isMissingPurposeError(e)) {
      return a(path("clinical_continuity"), { method: "POST", body });
    }
    throw e;
  }
}

// Fetch the clip bytes WITH the bearer (the token alone is not credentials) and
// return an object URL for <audio src>. Callers must revokeObjectURL on unmount.
export async function fetchClipObjectUrl(clipUrl) {
  const token = getAccessToken();
  const r = await fetch(`${SERVICES.report}${clipUrl}`, {
    method: "GET",
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!r.ok) {
    let problem = null;
    try { problem = await r.json(); } catch {}
    throw new ApiError(r.status, problem || { title: `clip_stream_failed_${r.status}` });
  }
  const blob = await r.blob();
  return URL.createObjectURL(blob);
}

// Mint + stream in one call. Returns { url, revoke } — `revoke` is idempotent.
export async function loadClip({ reportId, startMs, endMs }, { purpose } = {}) {
  const clip = await createAudioClip({ reportId, startMs, endMs }, { purpose });
  const url = await fetchClipObjectUrl(clip.clip_url);
  let revoked = false;
  return {
    clipId: clip.clip_id,
    url,
    expiresAtUnix: clip.expires_at_unix,
    revoke: () => { if (!revoked) { revoked = true; URL.revokeObjectURL(url); } },
  };
}

// ── Honest error taxonomy ────────────────────────────────────────────────
//
// The backend answers 410 with a problem body whose `code` names the reason.
// FastAPI wraps a dict `detail=` as { detail: {...} }, so the code can sit at
// either level depending on the route — read both rather than guess.

const GONE_CODES = new Set([
  "no_audio_source",
  "audio_not_retained",
  "audio_erased",
  "audio_partially_retained",
  "clip_expired",
  "clip_link_expired",
]);

export function clipErrorCode(err) {
  const p = err?.problem;
  if (!p) return null;
  const direct = p.code ?? p.detail?.code;
  if (typeof direct === "string") return direct;
  return null;
}

// kind: 'gone' (audio is not coming back) | 'expired' (the LINK died — retry
// works) | 'rate_limited' | 'too_long' | 'forbidden' | 'other'.
export function classifyClipError(err) {
  const status = err?.status;
  const code = clipErrorCode(err);
  if (status === 429) {
    const ra = Number(err?.problem?.retry_after ?? err?.problem?.detail?.retry_after);
    return { kind: "rate_limited", code, retryAfterSec: Number.isFinite(ra) ? ra : null };
  }
  if (status === 422) return { kind: "too_long", code };
  if (status === 403 && code === "clip_link_expired") return { kind: "expired", code };
  if (status === 403) return { kind: "forbidden", code };
  if (status === 410) {
    if (code === "clip_expired" || code === "clip_link_expired") return { kind: "expired", code };
    return { kind: "gone", code: GONE_CODES.has(code) ? code : "audio_erased" };
  }
  return { kind: "other", code };
}
