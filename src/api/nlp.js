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

export async function processText({ text, words = [], language = "uk", target_kind = "generic", encounter_id, template_id }) {
  const body = { text, words, language, target_kind };
  if (encounter_id) body.encounter_id = encounter_id;
  if (template_id)  body.template_id  = template_id;
  return a("/nlp/process", { method: "POST", body: JSON.stringify(body) });
}

export async function processBatch({ segments, language = "uk", target_kind = "generic" }) {
  return a("/nlp/process/batch", {
    method: "POST",
    body: JSON.stringify({ segments, language, target_kind }),
  });
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

// Autocomplete suggestions for the report editor (sprint 10). The backend
// ranks personal / specialty / template / general snippets for the current
// section and leading text. Returns an array of
// { id, source, text, confidence }.
export async function suggest({ template_id, section_id, prefix = "", language = "uk", limit = 3 }) {
  const body = { section_id, prefix, language, limit };
  if (template_id) body.template_id = template_id;
  return a("/nlp/suggest", { method: "POST", body: JSON.stringify(body) });
}
