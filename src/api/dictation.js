// dictation.js — REST companion calls for dictation-service.
//
// WS upgrade lives in src/dictation/wsClient.js. This file holds the HTTP
// endpoints (sprint 04 backend): list sessions, fetch one, finalize.
// Sprint 04 §C.1: there is NO POST /reports yet — finalize is the only
// server-side commit available.

import { apiAt } from "./client.js";
import { SERVICES } from "./services.js";

const a = (p, init) => apiAt(SERVICES.dictation, p, init);

export async function getSession(id) {
  return a(`/dictate/sessions/${encodeURIComponent(id)}`, { method: "GET" });
}

export async function listSessions({ status, limit = 25, cursor } = {}) {
  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  if (limit)  qs.set("limit", String(limit));
  if (cursor) qs.set("cursor", cursor);
  const tail = qs.toString() ? `?${qs}` : "";
  return a(`/dictate/sessions${tail}`, { method: "GET" });
}

// Spec §D sprint 04: "Save flow" uses /finalize, not POST /reports.
// Backend writes dictation_sessions.transcript_jsonb + uploads encrypted audio.
export async function finalizeSession(id) {
  return a(`/dictate/sessions/${encodeURIComponent(id)}/finalize`, { method: "POST" });
}
