// nlp.js — REST calls for nlp-service (sprint 05 backend).
//
// Note: voice-command detection is server-side via /nlp/process; the FE
// does NOT need to call this directly during a live dictation. The
// dictation-service runs the pipeline itself and bundles the result in
// `final.operations[]` / `final.voice_command` / `final.confidence_spans[]`.
//
// This client exists for:
//   - The batch ASR flow (FE post-processes a finalized transcript)
//   - The abbreviations admin UI (sprint 05 backend)

import { apiAt } from "./client.js";
import { SERVICES } from "./services.js";

const a = (p, init) => apiAt(SERVICES.nlp, p, init);

// ProcessRequest is extra="forbid" server-side: {text, words, language} plus
// the documented optional knobs ONLY. (This used to send target_kind /
// encounter_id / template_id — fields the strict model never had; every real
// call would have 422'd. No caller existed, which is how it went unnoticed.)
export async function processText({ text, words = [], language = "uk" }) {
  return a("/nlp/process", {
    method: "POST",
    body: JSON.stringify({ text, words, language }),
  });
}

export async function processBatch({ segments, language = "uk" }) {
  return a("/nlp/process/batch", {
    method: "POST",
    body: JSON.stringify({ segments, language }),
  });
}

// Admin sandbox (sprint 17): run admin-TYPED text through the pipeline to see
// what the tenant's dictionary does to it. Sends only fields every deployment
// of the strict ProcessRequest model accepts ({ text, language,
// stages_disabled }) — the wire model is extra="forbid", so nothing else rides
// along. `stages_disabled` values: "voice_commands" | "punctuation" |
// "number_norm" | "date_norm" | "abbreviation" | "field_extraction" |
// "confidence". Response: { text, words, pipeline_version, metadata,
// confidence_spans[], voice_commands[], operations[], warnings[] }.
export async function processSandbox({ text, language = "uk", stages_disabled = [] }) {
  const body = { text, language };
  if (stages_disabled.length) body.stages_disabled = stages_disabled;
  return a("/nlp/process", { method: "POST", body: JSON.stringify(body) });
}

export async function listAbbreviations({ language, limit = 100, cursor } = {}) {
  const qs = new URLSearchParams();
  if (language) qs.set("language", language);
  if (limit)    qs.set("limit", String(limit));
  if (cursor)   qs.set("cursor", cursor);
  const tail = qs.toString() ? `?${qs}` : "";
  return a(`/nlp/abbreviations${tail}`, { method: "GET" });
}

export async function upsertAbbreviation({ language, expanded, abbreviated, direction, domain, case_sensitive }) {
  return a("/nlp/abbreviations", {
    method: "PUT",
    body: JSON.stringify({ language, expanded, abbreviated, direction, domain, case_sensitive }),
  });
}

export async function deleteAbbreviation(id) {
  return a(`/nlp/abbreviations/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// Autocomplete suggestions moved to their own service — see api/autocomplete.js
// (POST /autocomplete/suggest on :8007). nlp-service no longer serves /suggest.
