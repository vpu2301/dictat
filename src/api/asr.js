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

// DELETE /asr/jobs/{id} → 202 { status: "cancelled" | "cancel_requested" },
// or 409 when the job already reached a terminal state.
//
// The two outcomes are NOT the same event, and collapsing them is what made
// Cancel look broken. A QUEUED job is cancelled outright. A RUNNING one can
// only be ASKED to stop: the service sets `cancel_requested` and leaves the
// status alone, and the worker acts on it at its next checkpoint. Reporting
// "Скасовано" for both meant the clinician was told a job had stopped while it
// went right on transcribing, with the Cancel button still sitting there.
export async function cancelJob(id) {
  const r = await a(`/asr/jobs/${encodeURIComponent(id)}`, { method: "DELETE" });
  return r?.status === "cancelled" ? "cancelled" : "cancel_requested";
}

// Asked to stop, not stopped yet. The status stays `running` until the worker
// acts, so "stopping" is a state of its own — read off the job rather than
// remembered in the button, so it survives a reload and shows up in any other
// tab watching the same job.
export function isCancelling(job) {
  return !!job && !!job.cancel_requested && ASR_ACTIVE.has(job.status);
}

// Backend GET /asr/jobs/{id}/result returns the plaintext asr_models
// TranscriptResultView: segments carry NLP-processed `text` (dictated
// «крапка» applied, numbers normalized) + `raw_text` + char-range
// `confidence_spans` when `nlp_applied`, plus raw ms-based `words`.
// TranscriptView renders seconds and `word`/`confidence`, so adapt here
// at the API boundary. Processed segments render their text with span
// shading; unprocessed ones keep the per-word path.
function toViewOutput(o) {
  const nlp = !!o.nlp_applied;
  const segments = o.segments.map((s) => ({
    start: (s.start_ms ?? 0) / 1000,
    end: (s.end_ms ?? 0) / 1000,
    text: s.text,
    rawText: s.raw_text,
    processed: nlp,
    spans: Array.isArray(s.confidence_spans) ? s.confidence_spans : [],
    words: !nlp && Array.isArray(s.words) && s.words.length > 0
      ? s.words.map((w) => ({
          start: (w.start_ms ?? 0) / 1000,
          end: (w.end_ms ?? 0) / 1000,
          word: w.text,
          confidence: w.probability,
        }))
      : undefined,
  }));
  return {
    language: o.language,
    nlp_applied: nlp,
    nlp_pipeline_version: o.nlp_pipeline_version || null,
    duration_s: segments.length ? segments[segments.length - 1].end : 0,
    text: segments.map((s) => s.text).join(" ").trim(),
    segments,
  };
}

// Returns { output, missing: boolean }. `missing: true` → the UI renders the
// gap banner (backend not yet serving the proxy-decrypt shape, e.g. the old
// JobResultView { job_id, presigned_url } — a link to ciphertext the browser
// can't use; ADR-0011 forbids client-side decrypt).
export async function getJobResult(id) {
  try {
    const r = await a(`/asr/jobs/${encodeURIComponent(id)}/result`, { method: "GET" });
    if (!r || typeof r !== "object" || !Array.isArray(r.segments)) {
      return { output: null, missing: true };
    }
    return { output: toViewOutput(r), missing: false };
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 405)) {
      return { output: null, missing: true };
    }
    throw e;
  }
}

export const ASR_TERMINAL = new Set(["complete", "failed", "cancelled"]);
export const ASR_ACTIVE   = new Set(["queued", "running"]);
