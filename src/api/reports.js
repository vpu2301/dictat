// reports.js — structured diagnostic reports (sprint 08): list/search, read,
// version diff, draft autosave, lifecycle (finalize / revert / cancel),
// amendment, and signing handoff.
//
// Lives on the report-service (:8006) under the /v1/reports prefix per the
// backend integration guide (2026-06-20 §3). NOT the legacy "core" service.
//
// A report is produced from a finalized dictation session against a structured
// template. Versioning and amendments are first-class (medico-legal trail).

import { apiAt, getAccessToken, ApiError } from "./client.js";
import { SERVICES } from "./services.js";

const a = (p, init) => apiAt(SERVICES.report, p, init);

// The guide exposes full-text search (GET /v1/reports/search) rather than a
// bare list; the Reports page uses it with empty filters to show everything.
export async function listReports({
  status, template, query, limit = 50, cursor,
  // Dashboard extras: `total: "exact"` makes the backend return total_exact
  // (a cheap exact count without paging); the encounter-date window + author
  // filter let the owner dashboard derive period/per-doctor counts server-side.
  total, author_id, encounter_date_from, encounter_date_to,
} = {}) {
  const qs = new URLSearchParams();
  // `status` may be a single value or an array; the backend `?status=` is a
  // `list[str]`, so emit one repeated param per value (lets "All" mean "all
  // active statuses" rather than literally-everything incl. cancelled).
  if (status) {
    (Array.isArray(status) ? status : [status]).forEach((s) => s && qs.append("status", s));
  }
  if (template) qs.set("template", template);
  // Backend search param is `q`; keep `query` as the public alias.
  if (query)    qs.set("q", query);
  if (author_id) qs.set("author_id", author_id);
  if (encounter_date_from) qs.set("encounter_date_from", encounter_date_from);
  if (encounter_date_to)   qs.set("encounter_date_to", encounter_date_to);
  if (total)    qs.set("total", total);
  if (limit)    qs.set("limit", String(limit));
  if (cursor)   qs.set("cursor", cursor);
  const tail = qs.toString() ? `?${qs}` : "";
  return a(`/v1/reports/search${tail}`, { method: "GET" });
}

// Pull the hit array out of a search response (the endpoint returns
// { hits, next_cursor, total_estimated } — NOT { items }).
export function reportHits(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.hits)) return res.hits;
  return [];
}

// Exact count of reports matching a filter, via the cheap total=exact path.
export async function countReports(params = {}) {
  const r = await listReports({ ...params, limit: 1, total: "exact" });
  const exact = r && (r.total_exact ?? r.total_estimated);
  return typeof exact === "number" ? exact : reportHits(r).length;
}

// GET /v1/reports/{id} → ReportEnvelope. With include_content the envelope also
// carries `content.sections` and a resolved, localized `section_labels`
// ([{ section_key, name: { uk, en } }] | null) so the read view/PDF can title
// sections without re-fetching the template (frontend guide §3).
export async function getReport(id, { includeContent = true } = {}) {
  const tail = includeContent ? "?include_content=true" : "";
  return a(`/v1/reports/${encodeURIComponent(id)}${tail}`, { method: "GET" });
}

// Adapt the editor's flat shape to the backend's nested `content` contract.
// report-service expects { content: { template_id, template_schema_version,
// sections: [{section_key, text}], ... } } and rejects unknown fields
// (extra="forbid"). It does NO template/section validation at create — that is
// deferred to finalize — so a light mapping is enough for drafts.
export function buildReportContent({ template_id, template_schema_version, body, title, encounter_date }) {
  let sections = [];
  if (typeof body === "string") {
    // Free-text editor: park the whole document in a single "note" section.
    if (body.trim()) sections = [{ section_key: "note", text: body }];
  } else if (body && typeof body === "object") {
    // Section-keyed map { sectionKey: text } → [{ section_key, text }].
    sections = Object.entries(body)
      .filter(([, v]) => v != null && String(v).length > 0)
      .map(([k, v]) => ({ section_key: String(k), text: String(v) }));
  }
  return {
    template_id,
    template_schema_version: template_schema_version ?? 1,
    ...(title ? { title } : {}),
    ...(encounter_date ? { encounter_date } : {}),
    sections,
  };
}

// Create a new draft report from the editor.
// input: { template_id, template_schema_version?, body, title?, encounter_date?,
//          patient_id?, source_session_id?, co_author_ids? }
// NOTE: `language`/`status` are client-only; the backend sets status="draft"
// and stores language on the template, so they are intentionally dropped here.
export async function createReport(input = {}) {
  const {
    template_id, template_schema_version, body, title, encounter_date,
    patient_id, source_session_id, co_author_ids,
  } = input;
  const payload = {
    content: buildReportContent({ template_id, template_schema_version, body, title, encounter_date }),
    ...(patient_id ? { patient_id } : {}),
    ...(source_session_id ? { source_session_id } : {}),
    ...(co_author_ids && co_author_ids.length ? { co_author_ids } : {}),
  };
  return a(`/v1/reports`, { method: "POST", body: JSON.stringify(payload) });
}

// Draft autosave (PUT /v1/reports/{id}/draft). The backend requires the full
// nested `content` plus `expected_version` for optimistic locking (it returns a
// new `version_number` to send on the next save). body_hash idempotency means an
// unchanged body replays without bumping the version.
// input: { expected_version, template_id, template_schema_version?, body,
//          title?, encounter_date?, dictation_session_id? }
export async function updateReport(id, input = {}) {
  const {
    expected_version, template_id, template_schema_version, body,
    title, encounter_date, dictation_session_id,
  } = input;
  const payload = {
    expected_version,
    content: buildReportContent({ template_id, template_schema_version, body, title, encounter_date }),
    ...(dictation_session_id ? { dictation_session_id } : {}),
  };
  return a(`/v1/reports/${encodeURIComponent(id)}/draft`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// Version diff for the history view (GET /v1/reports/{id}/diff).
// Optional ?from=&to= version selectors.
export async function reportDiff(id, { from, to } = {}) {
  const qs = new URLSearchParams();
  if (from != null) qs.set("from", String(from));
  if (to != null)   qs.set("to", String(to));
  const tail = qs.toString() ? `?${qs}` : "";
  return a(`/v1/reports/${encodeURIComponent(id)}/diff${tail}`, { method: "GET" });
}

// Version history helpers. The diff view fetches two snapshots and renders the
// delta client-side; these read individual versions under the report resource.
export async function listReportVersions(id) {
  return a(`/v1/reports/${encodeURIComponent(id)}/versions`, { method: "GET" });
}

export async function getReportVersion(id, version) {
  return a(`/v1/reports/${encodeURIComponent(id)}/versions/${encodeURIComponent(version)}`, { method: "GET" });
}

// POST /v1/reports/{id}/amend (AmendRequest, extra="forbid"). An amendment is a
// *new version* of the body, not just a note: it carries the amendment type, a
// reason (1..4000 chars), and the full replacement `content` (same nested shape
// as create/draft — build it with buildReportContent). 200 → report goes
// signed → amended and a new version is written.
export async function amendReport(id, { amendment_type, amendment_reason, content }) {
  return a(`/v1/reports/${encodeURIComponent(id)}/amend`, {
    method: "POST",
    body: JSON.stringify({ amendment_type, amendment_reason, content }),
  });
}

// ── Report synthesis (frontend guide §1) ───────────────────────────────────
// Turn each section's raw dictation into clean prose via the template's
// per-section synthesis_prompt. READ-ONLY: returns *proposed* text per section
// (both `original` raw dictation and synthesized `text`); it does NOT mutate the
// report. Apply the chosen text by writing it back through updateReport (draft
// autosave). `[[low-confidence]]` spans are preserved verbatim in `text`.
// 200 -> { job_id, status: "completed", sections: [{ section_key, original, text }] }
// Idempotent: same report+version+sections+language replays the same job_id.
export async function synthesizeReport(id, { sections, language } = {}) {
  return a(`/v1/reports/${encodeURIComponent(id)}/synthesize`, {
    method: "POST",
    body: JSON.stringify({ sections, language }),
  });
}

// GET /v1/reports/{id}/synthesize/{job_id} → { status, sections: [...] }.
export async function getSynthesis(id, jobId) {
  return a(`/v1/reports/${encodeURIComponent(id)}/synthesize/${encodeURIComponent(jobId)}`,
    { method: "GET" });
}

// ── Server-rendered PDF (frontend guide §2) ─────────────────────────────────
// GET /v1/reports/{id}/pdf?variant=draft|clean&lang=uk|en. variant=draft stamps
// a "DRAFT/ЧЕРНЕТКА" watermark + "not signed" banner; variant=clean is honored
// ONLY for signed reports (non-signed is forced to draft). 409 only for cancelled.
export function reportPdfUrl(id, { variant = "draft", lang } = {}) {
  const qs = new URLSearchParams();
  if (variant) qs.set("variant", variant);
  if (lang)    qs.set("lang", lang);
  const tail = qs.toString() ? `?${qs}` : "";
  return `${SERVICES.report}/v1/reports/${encodeURIComponent(id)}/pdf${tail}`;
}

// Authed binary download: the PDF endpoint needs the bearer token, so a plain
// <a href> won't do. Fetch as a blob and trigger a save. Replaces the old
// client-side window.print() draft hack. Returns true on success; throws ApiError.
export async function downloadReportPdf(id, { variant = "draft", lang, filename } = {}) {
  const token = getAccessToken();
  const res = await fetch(reportPdfUrl(id, { variant, lang }), {
    method: "GET",
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    let problem = null;
    try { problem = await res.json(); } catch {}
    throw new ApiError(res.status, problem || { title: `pdf_failed_${res.status}` });
  }
  const blob = await res.blob();
  // Prefer the server's Content-Disposition filename when present.
  const cd = res.headers.get("content-disposition") || "";
  const m = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(cd);
  let name = filename || (m && m[1]) || `report-${id}-${variant}.pdf`;
  try { name = decodeURIComponent(name); } catch {}
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}

// ── Lifecycle transitions (guide §3) ───────────────────────────────────────
// Finalize → the real "finalized"/completed transition (frontend guide §4).
// Sends `expected_version` (optimistic lock, same value tracked for draft
// autosave) so concurrent edits 409. On a 422 finalize_validation_failed the
// structured field errors live at the TOP LEVEL of the JSON (problem.problems,
// not problem.detail); surface them as `err.problems` for per-section UI.
// 200 -> { id, status: "finalized", version_number }
export async function finalizeReport(id, { expected_version, dictation_session_id } = {}) {
  const body = {};
  if (expected_version != null) body.expected_version = expected_version;
  if (dictation_session_id)     body.dictation_session_id = dictation_session_id;
  try {
    return await a(`/v1/reports/${encodeURIComponent(id)}/finalize`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch (err) {
    if (err && err.problem && Array.isArray(err.problem.problems)) {
      err.problems = err.problem.problems;
    }
    throw err;
  }
}

export async function revertReportToDraft(id) {
  return a(`/v1/reports/${encodeURIComponent(id)}/revert-to-draft`, { method: "POST" });
}

export async function cancelReport(id) {
  return a(`/v1/reports/${encodeURIComponent(id)}/cancel`, { method: "POST" });
}

// Mark the report signed (ties into signing-service).
export async function signReport(id, body = {}) {
  return a(`/v1/reports/${encodeURIComponent(id)}/sign`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
