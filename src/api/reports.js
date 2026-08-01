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
//
// Read-purpose: the backend 422s a non-author read without ?purpose= (allowed:
// clinical_continuity | audit | legal | qa_review | consultation; the value is
// audit-logged). Author reads must NOT send one (logged as "author"), and we
// can't know authorship before the response — so try bare first and retry once
// with purpose=clinical_continuity (opening a colleague's report inside the
// clinical workflow IS care continuity; audit/legal readers pass their own).
export function isMissingPurposeError(err) {
  return err?.status === 422 &&
    /missing-read-purpose/.test(String(err?.problem?.detail ?? err?.message ?? ""));
}

// Bare-then-retry GET for purpose-gated endpoints: try without ?purpose= (author
// reads must not send one), and on the 422 retry once as clinical_continuity.
async function getWithPurposeRetry(pathFor, purpose) {
  try {
    return await a(pathFor(purpose), { method: "GET" });
  } catch (err) {
    if (!purpose && isMissingPurposeError(err)) {
      return a(pathFor("clinical_continuity"), { method: "GET" });
    }
    throw err;
  }
}

export async function getReport(id, { includeContent = true, purpose } = {}) {
  return getWithPurposeRetry((p) => {
    const qs = new URLSearchParams();
    if (includeContent) qs.set("include_content", "true");
    if (p) qs.set("purpose", p);
    return `/v1/reports/${encodeURIComponent(id)}?${qs}`;
  }, purpose);
}

// Adapt the editor's flat shape to the backend's nested `content` contract.
// report-service expects { content: { template_id, template_schema_version,
// sections: [{section_key, text, icd10?, field_specific_metadata?}], ... } }
// and rejects unknown fields (extra="forbid"). It does NO template/section
// validation at create — that is deferred to finalize — but since Sprint 13
// it DOES validate any non-empty field_specific_metadata on the draft PUT.
//
// `section_meta` (Sprint 13) is the Studio's parallel map
// { [section_key]: { icd10?, field_specific_metadata? } } — confirmed
// diagnosis codes and typed field metadata. It MUST round-trip through every
// save: dropping it would destroy extractor proposals and confirmed values.
// A section that carries meta but no prose is still emitted (a confirmed
// diagnosis with an empty note is real content). Without section_meta the
// output is exactly the pre-S13 shape.
export function buildReportContent({ template_id, template_schema_version, body, title, encounter_date, section_meta }) {
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
  if (section_meta && typeof section_meta === "object") {
    const byKey = new Map(sections.map((s) => [s.section_key, s]));
    for (const [key, meta] of Object.entries(section_meta)) {
      if (!meta) continue;
      let s = byKey.get(String(key));
      if (!s) {
        s = { section_key: String(key), text: "" };
        byKey.set(s.section_key, s);
        sections.push(s);
      }
      if (Array.isArray(meta.icd10) && meta.icd10.length) s.icd10 = meta.icd10;
      if (meta.field_specific_metadata && Object.keys(meta.field_specific_metadata).length) {
        s.field_specific_metadata = meta.field_specific_metadata;
      }
      // Sprint 14: back-reference from a report section to the conversation
      // segments it was written from (report_models SectionIn field, the same
      // one dictation-service fills when IT writes the draft). Only conversation
      // transcripts have segment UUIDs, so this key is absent everywhere else —
      // the pre-S14 payload is byte-identical.
      if (Array.isArray(meta.transcript_segment_ids) && meta.transcript_segment_ids.length) {
        s.transcript_segment_ids = meta.transcript_segment_ids;
      }
      // Meta-only entry that resolved to nothing → drop the synthetic section.
      if (!s.text && !s.icd10 && !s.field_specific_metadata && !s.transcript_segment_ids) {
        byKey.delete(s.section_key);
        sections = sections.filter((x) => x !== s);
      }
    }
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
    patient_id, source_session_id, co_author_ids, section_meta,
  } = input;
  const payload = {
    content: buildReportContent({ template_id, template_schema_version, body, title, encounter_date, section_meta }),
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
    title, encounter_date, dictation_session_id, section_meta,
  } = input;
  const payload = {
    expected_version,
    content: buildReportContent({ template_id, template_schema_version, body, title, encounter_date, section_meta }),
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
// Both enforce the same non-author ?purpose= gate as getReport.
export async function listReportVersions(id, { purpose } = {}) {
  return getWithPurposeRetry((p) => {
    const qs = p ? `?${new URLSearchParams({ purpose: p })}` : "";
    return `/v1/reports/${encodeURIComponent(id)}/versions${qs}`;
  }, purpose);
}

export async function getReportVersion(id, version, { purpose } = {}) {
  return getWithPurposeRetry((p) => {
    const qs = p ? `?${new URLSearchParams({ purpose: p })}` : "";
    return `/v1/reports/${encodeURIComponent(id)}/versions/${encodeURIComponent(version)}${qs}`;
  }, purpose);
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
export function reportPdfUrl(id, { variant = "draft", lang, purpose } = {}) {
  const qs = new URLSearchParams();
  if (variant) qs.set("variant", variant);
  if (lang)    qs.set("lang", lang);
  if (purpose) qs.set("purpose", purpose);
  const tail = qs.toString() ? `?${qs}` : "";
  return `${SERVICES.report}/v1/reports/${encodeURIComponent(id)}/pdf${tail}`;
}

// Authed binary download: the PDF endpoint needs the bearer token, so a plain
// <a href> won't do. Fetch as a blob and trigger a save. Replaces the old
// client-side window.print() draft hack. Returns true on success; throws ApiError.
export async function downloadReportPdf(id, { variant = "draft", lang, filename, purpose } = {}) {
  const token = getAccessToken();
  const fetchPdf = (p) => fetch(reportPdfUrl(id, { variant, lang, purpose: p }), {
    method: "GET",
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  let res = await fetchPdf(purpose);
  if (!res.ok) {
    let problem = null;
    try { problem = await res.json(); } catch {}
    let err = new ApiError(res.status, problem || { title: `pdf_failed_${res.status}` });
    // The PDF endpoint enforces the same non-author ?purpose= gate as getReport;
    // retry once as clinical_continuity (see the read-purpose note above).
    if (!purpose && isMissingPurposeError(err)) {
      res = await fetchPdf("clinical_continuity");
      if (!res.ok) {
        problem = null;
        try { problem = await res.json(); } catch {}
        err = new ApiError(res.status, problem || { title: `pdf_failed_${res.status}` });
        throw err;
      }
    } else {
      throw err;
    }
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

// Classify a signReport() rejection into a translation-free descriptor
// (2026-07-24 — a correct dev password was "rejected" because the REPORT
// STATE was unsignable and the FE showed the raw error). The backend's 409
// carries `{'error': 'report_not_signable', 'current_status': …}` as a
// Python-repr detail string — parsed via the same pickProblemField as
// classifyAssignError. Kept pure (no i18n) so it's unit-testable.
//   { kind: "not_signable", current_status: "draft"|"signed"|"cancelled"|… }
//   { kind: "wrong_password" } | { kind: "locked" } | { kind: "unavailable" }
//   { kind: "unknown", message }
export function classifySignError(err) {
  const raw = err?.problem || {};
  const status = err?.status;
  const code = pickProblemField(raw, "error") || pickProblemField(raw, "code");
  if (status === 409 && code === "report_not_signable") {
    return { kind: "not_signable", current_status: pickProblemField(raw, "current_status") || null };
  }
  if (status === 401) return { kind: "wrong_password" };
  if (status === 423) return { kind: "locked" };
  if (status === 503) return { kind: "unavailable" };
  return { kind: "unknown", message: err?.message || null };
}

// ── Assign a batch transcription to a patient (sprint: dictation-assign) ──
// POST /v1/reports/from-transcript — creates a draft report from a COMPLETE
// asr job's transcript. Omit template_id for deterministic auto-match; the
// response's template_selection ("explicit" | "auto" | "fallback") tells the
// UI whether to warn that the default template was used.
export async function assignTranscript({ asr_job_id, patient_id, template_id, title, encounter_date }) {
  const body = { asr_job_id, patient_id };
  if (template_id) body.template_id = template_id;
  if (title && title.trim()) body.title = title.trim();
  if (encounter_date) body.encounter_date = encounter_date;
  return a("/v1/reports/from-transcript", { method: "POST", body: JSON.stringify(body) });
}

// Backend's 200-id ceiling for the bulk by-source-job lookup.
export const BY_SOURCE_JOB_CHUNK = 200;

// GET /v1/reports/by-source-job?ids=… — bulk "is this job already assigned?"
// lookup for list badges. Accepts any number of ids (chunked to the backend's
// 200-id limit); returns Map<asr_job_id, {report_id, code, status, patient_id}>.
export async function reportsBySourceJobs(ids = []) {
  const map = new Map();
  const uniq = [...new Set(ids.filter(Boolean))];
  for (let i = 0; i < uniq.length; i += BY_SOURCE_JOB_CHUNK) {
    const chunk = uniq.slice(i, i + BY_SOURCE_JOB_CHUNK);
    const rows = await a(`/v1/reports/by-source-job?ids=${chunk.map(encodeURIComponent).join(",")}`, { method: "GET" });
    for (const r of Array.isArray(rows) ? rows : []) {
      map.set(r.asr_job_id, { report_id: r.report_id, code: r.code, status: r.status, patient_id: r.patient_id });
    }
  }
  return map;
}

// Pull a string field out of a backend problem body, wherever it lives. The
// live report-service returns HTTPException(detail={dict}) which FastAPI
// serializes into the RFC 7807 `detail` as a Python *repr string*
// (e.g. detail: "{'code': 'already_assigned', 'report_code': 'REP-…'}"), so a
// plain object read misses it. We check, in order: the flat problem object,
// a nested detail object, and a regex over a stringified detail (single- or
// double-quoted). Verified live 2026-07-18 against job 229eabb6 (REP-2026-00381).
function pickProblemField(raw, key) {
  if (raw && raw[key] != null) return raw[key];
  const d = raw && raw.detail;
  if (d && typeof d === "object" && d[key] != null) return d[key];
  if (typeof d === "string") {
    const m = d.match(new RegExp(`['"]${key}['"]\\s*:\\s*['"]([^'"]*)['"]`));
    if (m) return m[1];
  }
  return undefined;
}

// Classify an assignTranscript() error into a translation-free descriptor the
// UI maps to localized copy. Kept pure (no i18n) so it's unit-testable.
// Returns one of:
//   { kind: "already_assigned", report_id, report_code }
//   { kind: "not_complete", job_status }
//   { kind: "field", code }            // patient_not_found / template_not_found / empty_transcript / no_templates
//   { kind: "erased" }                 // 410 — transcript gone by retention
//   { kind: "unavailable" }            // 503 — asr service down
//   { kind: "unknown", message }
export function classifyAssignError(err) {
  const raw = err?.problem || {};
  const status = err?.status;
  const code = pickProblemField(raw, "code");
  const jobStatus = pickProblemField(raw, "job_status");
  if (status === 409 && code === "already_assigned") {
    return {
      kind: "already_assigned",
      report_id: pickProblemField(raw, "report_id"),
      report_code: pickProblemField(raw, "report_code"),
    };
  }
  if (status === 409 && jobStatus) {
    return { kind: "not_complete", job_status: jobStatus };
  }
  if (status === 422 &&
      ["patient_not_found", "template_not_found", "empty_transcript", "no_templates"].includes(code)) {
    return { kind: "field", code };
  }
  if (status === 410) return { kind: "erased" };
  if (status === 503) return { kind: "unavailable" };
  return { kind: "unknown", message: err?.message || null };
}
