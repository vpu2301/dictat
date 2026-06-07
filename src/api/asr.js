// asr.js — Fetchers for the asr-service (batch transcription).
//
// All requests reuse the auth-service in-memory access token via apiAt().
//
//   GET /asr/prompts                — list (id, language, specialty, is_default)
//   GET /asr/jobs/{id}/result       — proxy decrypt of TranscriptionOutput

import { apiAt, ApiError } from "./client.js";
import { SERVICES } from "./services.js";

export const ASR_BASE_URL = SERVICES.asr;

const a = (path, init) => apiAt(ASR_BASE_URL, path, init);

// ── Prompts ─────────────────────────────────────────────────────────────
// GET /asr/prompts → [{ id, language, specialty, is_default }]. Returns the
// list straight from the backend (empty array if none); the picker renders an
// empty state rather than relying on any client-side placeholder.
export async function listPrompts() {
  const r = await a("/asr/prompts", { method: "GET" });
  return Array.isArray(r) ? r : (r && r.prompts) || [];
}

// ── Jobs ────────────────────────────────────────────────────────────────
export async function listJobs({ status, cursor, limit = 25 } = {}) {
  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  if (cursor) qs.set("cursor", cursor);
  if (limit)  qs.set("limit", String(limit));
  const path = `/asr/jobs${qs.toString() ? `?${qs.toString()}` : ""}`;
  return a(path, { method: "GET" });
}

export async function getJob(id) {
  return a(`/asr/jobs/${encodeURIComponent(id)}`, { method: "GET" });
}

// Submits a new job. Backend accepts multipart/form-data with the audio
// file under `audio` and the rest as flat fields.
export async function submitJob({ file, prompt_id, language, encounter_id }) {
  const fd = new FormData();
  fd.append("audio", file);
  fd.append("prompt_id", prompt_id);
  fd.append("language", language);
  if (encounter_id) fd.append("encounter_id", encounter_id);
  return a("/asr/jobs", { method: "POST", body: fd });
}

export async function cancelJob(id) {
  return a(`/asr/jobs/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// Returns { output, missing: boolean }. When the backend proxy endpoint
// isn't deployed yet, `missing` is true and the UI should render the gap
// banner instead of attempting any client-side decrypt of `result_url`.
export async function getJobResult(id) {
  try {
    const r = await a(`/asr/jobs/${encodeURIComponent(id)}/result`, { method: "GET" });
    return { output: r, missing: false };
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 405)) {
      return { output: null, missing: true };
    }
    throw e;
  }
}

export const ASR_TERMINAL = new Set(["complete", "failed", "cancelled"]);
export const ASR_ACTIVE   = new Set(["queued", "running"]);
