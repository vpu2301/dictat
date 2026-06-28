// autocomplete.js — ranked snippet suggestions for the report editor.
//
// Its own service (:8007, prefix /autocomplete) per the integration guide §3 —
// NOT part of nlp-service. Suggestions are best-effort and must never block
// dictation: callers catch failures and fall back to an empty list.
//
//   POST   /autocomplete/suggest                  ranked suggestions
//   POST   /autocomplete/phrases                  create phrase (201)
//   DELETE /autocomplete/phrases/{phrase_id}      remove phrase (204)
//   POST   /autocomplete/telemetry                usage events (204, PII-scrubbed)

import { apiAt } from "./client.js";
import { SERVICES } from "./services.js";

const a = (p, init) => apiAt(SERVICES.autocomplete, p, init);

// POST /autocomplete/suggest → array of { id, source, text, confidence }.
// The backend ranks personal / specialty / template / general snippets for the
// current section and leading text.
export async function suggest({ template_id, section_id, prefix = "", language = "uk", limit = 3 }) {
  const body = { prefix, language, limit };
  if (section_id)  body.section_id  = section_id;
  if (template_id) body.template_id  = template_id;
  return a("/autocomplete/suggest", { method: "POST", body: JSON.stringify(body) });
}

// Save a personal phrase (201). body: { text, language, section_id? }
export async function createPhrase(body) {
  return a("/autocomplete/phrases", { method: "POST", body: JSON.stringify(body) });
}

// Remove a personal phrase (204).
export async function deletePhrase(phraseId) {
  return a(`/autocomplete/phrases/${encodeURIComponent(phraseId)}`, { method: "DELETE" });
}

// Fire-and-forget usage telemetry (204). Server-side PII scrubbing.
export async function sendTelemetry(event) {
  return a("/autocomplete/telemetry", { method: "POST", body: JSON.stringify(event) });
}
