// synonyms.js — the medical synonym dictionary that expands report search
// queries (report-service `/v1/synonyms`, ADR-0038).
//
// A group is a set of interchangeable terms in one language: searching for any
// member matches documents containing any other. `source` says who owns the
// row:
//
//   "system" — shipped with the platform, read-only for every tenant. A PUT or
//              DELETE against one answers 403; the console must not offer it.
//   "tenant" — curated by this clinic's admin. Editable.
//
// Permission-wise this is deliberately NOT clinical: `synonym.read` rides along
// with searching (clinician, nurse, service, tenant_admin) and `synonym.write`
// is tenant_admin only — curating a dictionary is administration, and the rows
// carry vocabulary, never patient data. So the owner console can manage this
// surface in full without touching the admin ⟂ PHI wall.

import { apiAt } from "./client.js";
import { SERVICES } from "./services.js";

const r = (path, init) => apiAt(SERVICES.report, path, init);

// A group must have at least two terms to mean anything — one term expands to
// itself — and at most twelve, because query expansion is O(terms) against the
// index. Both bounds are the backend's (SynonymGroupBody, 422 outside them);
// checking here keeps the console from a round-trip to be told what it knows.
export const SYNONYM_MIN_TERMS = 2;
export const SYNONYM_MAX_TERMS = 12;

// report-service content is uk/en only — see dictation/languages.js
// TEMPLATE_CODES for why that differs from what you can dictate in.
export const SYNONYM_LANGS = ["uk", "en"];

/** null when the group is valid, otherwise a machine-readable reason. */
export function validateGroup({ language, terms }) {
  const t = normaliseTerms(terms);
  if (!SYNONYM_LANGS.includes(language)) return "language";
  if (t.length < SYNONYM_MIN_TERMS) return "too_few";
  if (t.length > SYNONYM_MAX_TERMS) return "too_many";
  return null;
}

/** GET /v1/synonyms → SynonymGroupOut[] ({ group_id, language, source, terms }). */
export async function listSynonymGroups() {
  return r("/v1/synonyms", { method: "GET" });
}

/** POST /v1/synonyms — { language, terms[] } → the created group. 201. */
export async function createSynonymGroup({ language, terms }) {
  return r("/v1/synonyms", {
    method: "POST",
    body: JSON.stringify({ language, terms: normaliseTerms(terms) }),
  });
}

/** PUT /v1/synonyms/{group_id} — replaces the term set. 403 on a system group. */
export async function updateSynonymGroup(groupId, { language, terms }) {
  return r(`/v1/synonyms/${encodeURIComponent(groupId)}`, {
    method: "PUT",
    body: JSON.stringify({ language, terms: normaliseTerms(terms) }),
  });
}

/** DELETE /v1/synonyms/{group_id} — 204. 403 on a system group. */
export async function deleteSynonymGroup(groupId) {
  return r(`/v1/synonyms/${encodeURIComponent(groupId)}`, { method: "DELETE" });
}

/** "набряк, набряки , edema" → ["набряк", "набряки", "edema"]. Order kept. */
export function parseTerms(text) {
  return normaliseTerms(String(text || "").split(/[,\n]/));
}

function normaliseTerms(terms) {
  const seen = new Set();
  const out = [];
  for (const t of terms || []) {
    const v = String(t || "").trim();
    if (!v) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;      // the backend rejects duplicates within a group
    seen.add(k);
    out.push(v);
  }
  return out;
}

/** Tenant-owned groups are editable; system ones are the platform's. */
export function isEditable(group) {
  return String(group?.source || "").toLowerCase() === "tenant";
}
