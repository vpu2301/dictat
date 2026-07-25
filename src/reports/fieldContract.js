// fieldContract.js — Sprint 13: the FE mirror of the backend's typed
// field_specific_metadata contract (report_models/field_metadata.py, read from
// source 2026-07-22) plus the pinned Icd10Code shape (report_models/content.py).
//
// The backend validates every non-empty metadata dict on the draft-PUT write
// path; this module exists so the FE (a) renders only shapes it understands,
// (b) never writes a dict the backend would 422, and (c) performs the ONE
// state transition of the sprint — confirming a proposal — exactly per
// contract: `source:"extracted"` ⇒ proposal, `source:"manual"` ⇒ confirmed,
// confirming drops `confidence` (a clinician confirmation is not a
// probability). Nothing here ever auto-promotes extracted → manual.
//
// Confirmed diagnosis codes live in `section.icd10` — NOT in metadata.
// `structured_diagnosis` metadata carries extractor `proposals` only;
// confirming a proposal MOVES its code into `section.icd10`.

export const ICD10_CODE_RE = /^[A-Z][0-9]{2}(\.[0-9A-Z]{1,4})?$/;

export const FIELD_TYPES = [
  "free_text", "structured_diagnosis", "date", "date_with_note",
  "numeric_with_unit", "choice", "multi_choice",
];

export const CHOICE_FIELD_TYPES = ["choice", "multi_choice"];

// Field types whose sections may carry non-empty field_specific_metadata.
// free_text accepts none (backend registry omits it).
export const METADATA_FIELD_TYPES = [
  "choice", "multi_choice", "structured_diagnosis",
  "numeric_with_unit", "date", "date_with_note",
];

export function fieldTypeAcceptsMetadata(fieldType) {
  return METADATA_FIELD_TYPES.includes(fieldType);
}

const SOURCES = ["extracted", "manual"];

const bad = (reason) => ({ ok: false, reason });
const okEmpty = { ok: true, meta: null };

function isPlainObject(v) {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

// Shared source/confidence rules (backend _StrictMeta):
//  - `source` is required whenever any other key is present;
//  - extracted ⇒ confidence required (0..1);
//  - manual ⇒ confidence must be ABSENT.
function checkSourceConfidence(meta) {
  if (!SOURCES.includes(meta.source)) {
    return `source must be one of ${SOURCES.join("|")}`;
  }
  const has = Object.prototype.hasOwnProperty.call(meta, "confidence");
  if (meta.source === "extracted") {
    if (!has || typeof meta.confidence !== "number" ||
        !(meta.confidence >= 0 && meta.confidence <= 1)) {
      return "extracted metadata requires confidence in [0,1]";
    }
  } else if (has && meta.confidence != null) {
    return "manual metadata must omit confidence";
  }
  return null;
}

function checkNoExtraKeys(meta, allowed) {
  for (const k of Object.keys(meta)) {
    if (!allowed.includes(k)) return `unknown key ${JSON.stringify(k)}`;
  }
  return null;
}

export function isRealIsoDate(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function parseProposal(p, i) {
  if (!isPlainObject(p)) return `proposals[${i}] must be an object`;
  const extra = checkNoExtraKeys(p, ["code", "display", "confidence"]);
  if (extra) return `proposals[${i}]: ${extra}`;
  const code = typeof p.code === "string" ? p.code.toUpperCase() : p.code;
  if (typeof code !== "string" || !ICD10_CODE_RE.test(code)) {
    return `proposals[${i}].code must match ${ICD10_CODE_RE}`;
  }
  if (p.display != null && (typeof p.display !== "string" || p.display.length > 200)) {
    return `proposals[${i}].display must be a string ≤ 200 chars`;
  }
  if (typeof p.confidence !== "number" || !(p.confidence >= 0 && p.confidence <= 1)) {
    return `proposals[${i}].confidence must be in [0,1]`;
  }
  return null;
}

// Parse a section's field_specific_metadata dict against its field_type.
// Returns { ok: true, meta: null } for an empty dict (always valid — every
// pre-S13 report), { ok: true, meta } with normalized values (ICD-10 codes
// uppercased), or { ok: false, reason }. Mirrors the backend's
// parse_field_metadata: unknown keys, wrong shapes, or metadata on a
// field_type that accepts none are all invalid.
export function parseFieldMeta(fieldType, metadata) {
  if (metadata == null) return okEmpty;
  if (!isPlainObject(metadata)) return bad("metadata must be an object");
  if (Object.keys(metadata).length === 0) return okEmpty;
  if (!fieldTypeAcceptsMetadata(fieldType)) {
    return bad(`field_type ${JSON.stringify(fieldType)} accepts no metadata keys`);
  }
  const srcErr = checkSourceConfidence(metadata);
  if (srcErr) return bad(srcErr);
  const base = metadata.source === "extracted"
    ? { source: "extracted", confidence: metadata.confidence }
    : { source: "manual" };

  switch (fieldType) {
    case "choice": {
      const extra = checkNoExtraKeys(metadata, ["source", "confidence", "selected"]);
      if (extra) return bad(extra);
      const s = metadata.selected;
      if (typeof s !== "string" || s.length < 1 || s.length > 64) {
        return bad("selected must be a string of 1..64 chars");
      }
      return { ok: true, meta: { ...base, selected: s } };
    }
    case "multi_choice": {
      const extra = checkNoExtraKeys(metadata, ["source", "confidence", "selected"]);
      if (extra) return bad(extra);
      const sel = metadata.selected;
      if (!Array.isArray(sel) || sel.length < 1 || sel.length > 50) {
        return bad("selected must be an array of 1..50 values (an empty selection is an empty metadata dict)");
      }
      if (!sel.every((v) => typeof v === "string" && v.length >= 1 && v.length <= 64)) {
        return bad("selected values must be strings of 1..64 chars");
      }
      if (new Set(sel).size !== sel.length) return bad("selected values must be unique");
      return { ok: true, meta: { ...base, selected: [...sel] } };
    }
    case "structured_diagnosis": {
      const extra = checkNoExtraKeys(metadata, ["source", "confidence", "proposals"]);
      if (extra) return bad(extra);
      const props = metadata.proposals;
      if (!Array.isArray(props) || props.length < 1 || props.length > 20) {
        return bad("proposals must be an array of 1..20 items");
      }
      const out = [];
      for (let i = 0; i < props.length; i++) {
        const err = parseProposal(props[i], i);
        if (err) return bad(err);
        const p = props[i];
        out.push({
          code: p.code.toUpperCase(),
          ...(p.display != null ? { display: p.display } : {}),
          confidence: p.confidence,
        });
      }
      return { ok: true, meta: { ...base, proposals: out } };
    }
    case "numeric_with_unit": {
      const extra = checkNoExtraKeys(metadata, ["source", "confidence", "value", "unit"]);
      if (extra) return bad(extra);
      if (typeof metadata.value !== "number" || !Number.isFinite(metadata.value)) {
        return bad("value must be a finite number");
      }
      if (typeof metadata.unit !== "string" || metadata.unit.length < 1 || metadata.unit.length > 32) {
        return bad("unit must be a string of 1..32 chars");
      }
      return { ok: true, meta: { ...base, value: metadata.value, unit: metadata.unit } };
    }
    case "date":
    case "date_with_note": {
      const extra = checkNoExtraKeys(metadata, ["source", "confidence", "date"]);
      if (extra) return bad(extra);
      if (!isRealIsoDate(metadata.date)) {
        return bad("date must be a real calendar date formatted YYYY-MM-DD");
      }
      return { ok: true, meta: { ...base, date: metadata.date } };
    }
    default:
      return bad(`field_type ${JSON.stringify(fieldType)} accepts no metadata keys`);
  }
}

// A proposal is machine-filled and unreviewed. This predicate is the ONE
// place the FE decides "render in proposal style".
export function isProposal(meta) {
  return !!meta && meta.source === "extracted";
}

// Confidence is shown as BANDS, never a raw percentage in the primary view
// (step 02 §4.1: a precise "82%" reads as authority the extractor doesn't
// have; the number lives behind hover/expand only). Thresholds pinned here
// so every renderer and the dot primitive agree.
export const CONFIDENCE_MEDIUM = 0.6;
export const CONFIDENCE_HIGH = 0.85;

export function confidenceBand(confidence) {
  const c = typeof confidence === "number" && Number.isFinite(confidence) ? confidence : 0;
  if (c >= CONFIDENCE_HIGH) return "high";
  if (c >= CONFIDENCE_MEDIUM) return "medium";
  return "low";
}

export function isConfirmed(meta) {
  return !!meta && meta.source === "manual";
}

// The confirm transition: same value, source flips to manual, confidence is
// dropped (contract: manual metadata must omit confidence). Works for any
// field type because it only touches the shared keys.
export function confirmMeta(meta) {
  if (!meta) return meta;
  const { confidence, ...rest } = meta;
  return { ...rest, source: "manual" };
}

// ── Icd10Code (section.icd10 — confirmed codes, the single authority) ──────

// Normalize one {code, display?} entry. Returns null when invalid.
export function normalizeIcd10Code(entry) {
  if (!isPlainObject(entry)) return null;
  const code = typeof entry.code === "string" ? entry.code.toUpperCase() : null;
  if (!code || !ICD10_CODE_RE.test(code)) return null;
  const display = typeof entry.display === "string" && entry.display
    ? entry.display.slice(0, 200)
    : null;
  return display ? { code, display } : { code };
}

// Normalize a section.icd10 list, dropping invalid entries and duplicate codes.
export function normalizeIcd10List(list) {
  const out = [];
  const seen = new Set();
  for (const entry of Array.isArray(list) ? list : []) {
    const c = normalizeIcd10Code(entry);
    if (c && !seen.has(c.code)) {
      seen.add(c.code);
      out.push(c);
    }
  }
  return out;
}

// ── Section-meta round-trip (Studio ⇄ draft PUT) ───────────────────────────
// The Studio's body state is { [section_key]: text }. Everything ELSE a
// section carries (icd10, field_specific_metadata) lives in a parallel
// section-meta map so the prose editor and its consumers stay untouched.
// This map MUST round-trip through every save: an autosave that dropped it
// would destroy extractor output and confirmed diagnoses.

// Extract { [section_key]: { icd10?, field_specific_metadata? } } from a
// report envelope's `content`, keeping only sections that carry something.
export function sectionMetaFromContent(content) {
  const out = {};
  for (const s of content?.sections || []) {
    if (!s?.section_key) continue;
    const entry = {};
    if (Array.isArray(s.icd10) && s.icd10.length) entry.icd10 = normalizeIcd10List(s.icd10);
    if (isPlainObject(s.field_specific_metadata) && Object.keys(s.field_specific_metadata).length) {
      entry.field_specific_metadata = s.field_specific_metadata;
    }
    if (Object.keys(entry).length) out[s.section_key] = entry;
  }
  return out;
}

// ── Typed write-helpers ────────────────────────────────────────────────────
// THE RULE (step 01, §6): all structured writes go through the ONE existing
// draft-save path. No renderer issues its own endpoint — these helpers only
// build the section-meta patch that Studio's onSectionMetaChange merges and
// the normal autosave PUT persists. Each returns
// { icd10?, field_specific_metadata? } — the section's next entry (an empty
// {} key value means "clear that key").

// Confirm the extracted choice/multi_choice/numeric/date value as-is:
// same value, source flips to manual, confidence dropped.
export function confirmChoice(meta) {
  return { field_specific_metadata: confirmMeta(meta) || {} };
}

// Clinician overrides (or first fills) a choice: a brand-new manual value.
// Passing null/empty clears the selection (empty dict, per contract).
export function overrideChoice(value) {
  return {
    field_specific_metadata: value ? { source: "manual", selected: String(value) } : {},
  };
}

// multi_choice override: an empty selection is an EMPTY METADATA DICT,
// never `selected: []` (backend rejects an empty list).
export function overrideMultiChoice(values) {
  const sel = (values || []).map(String).filter(Boolean);
  return {
    field_specific_metadata: sel.length ? { source: "manual", selected: [...new Set(sel)] } : {},
  };
}

// numeric_with_unit override: a manual value + unit. No clear-on-empty here
// (unlike overrideChoice) — a half-typed number must never wipe a staged
// proposal; callers validate via parseFieldMeta and no-op on invalid.
export function overrideNumeric(value, unit) {
  return { field_specific_metadata: { source: "manual", value, unit: String(unit ?? "") } };
}

// date / date_with_note override: a manual ISO date.
export function overrideDate(date) {
  return { field_specific_metadata: { source: "manual", date: String(date ?? "") } };
}

// Confirm one diagnosis proposal: MOVE its code into section.icd10 (the
// single authority for confirmed codes) and drop it from the proposals
// staging area. When the last proposal is consumed the metadata clears
// entirely (proposals has a min-length of 1 — an empty staging area is an
// empty dict). `entry` is the section's current { icd10?, field_specific_metadata? }.
export function confirmDiagnosis(entry, code) {
  const cur = entry || {};
  const meta = cur.field_specific_metadata || {};
  const proposals = Array.isArray(meta.proposals) ? meta.proposals : [];
  const hit = proposals.find((p) => p && String(p.code).toUpperCase() === String(code).toUpperCase());
  if (!hit) return { icd10: cur.icd10 || [], field_specific_metadata: meta };

  const confirmed = normalizeIcd10Code({ code: hit.code, display: hit.display });
  const icd10 = normalizeIcd10List([...(cur.icd10 || []), confirmed]);
  const rest = proposals.filter((p) => p !== hit);
  return {
    icd10,
    field_specific_metadata: rest.length ? { ...meta, proposals: rest } : {},
  };
}

// Remove a confirmed code from section.icd10. Proposals are untouched —
// un-confirming does not resurrect a proposal.
export function removeDiagnosisCode(entry, code) {
  const cur = entry || {};
  const up = String(code).toUpperCase();
  return { icd10: (cur.icd10 || []).filter((c) => c && c.code !== up) };
}

// ── Finalize violations (backend step 06 — parsed, never re-implemented) ───
// finalize 422 carries top-level `problems`: [{field, code, detail,
// section_key, reason}] items (409 stays reserved for status/version
// conflicts). The FE renders these per section; `diagnosis_not_confirmed`
// (proposals exist, nothing confirmed) and `missing_icd10` (nothing there
// at all) drive DIFFERENT copy — step 06.

export const FINALIZE_VIOLATION_CODES = [
  "min_chars", "missing_icd10",                       // existing
  "choice_not_selected", "numeric_not_filled",        // sprint-13
  "date_not_filled", "diagnosis_not_confirmed",       // sprint-13
];

// Normalize err.problems (see api/reports.finalizeReport) into
// { [section_key]: [{code, detail, field, reason}] }. Unknown codes are
// KEPT (forward-compat: a newer backend must not crash the surface);
// items with no section_key group under "" for report-level display.
export function violationsBySection(problems) {
  const out = {};
  for (const p of Array.isArray(problems) ? problems : []) {
    if (!p || typeof p !== "object") continue;
    const key = typeof p.section_key === "string" ? p.section_key : "";
    (out[key] ||= []).push({
      code: p.code ?? null,
      detail: p.detail ?? null,
      field: p.field ?? null,
      reason: p.reason ?? null,
    });
  }
  return out;
}

// ── Voice field operations (backend step 07, sprint-05 WS channel) ─────────
// A voice selection is an explicit clinician act ⇒ the resulting write is
// source:"manual" (never extracted). Unresolvable utterances arrive as an
// unknown/no-op op carrying arg.reason.

export const VOICE_FIELD_OPS = [
  "set_choice", "add_choice", "remove_choice",  // arg {section_id, value}
  "mark_diagnosis_text",                        // arg {text}
];

export const VOICE_OP_FAIL_REASONS = ["option_not_found", "not_a_choice_section"];

// ── Template option helpers (choice/multi_choice renderers) ────────────────

export function optionByValue(options, value) {
  return (options || []).find((o) => o && o.value === value) || null;
}

// Label for a stored option value; falls back to the raw value so a
// selection saved against a since-renamed option still renders something.
export function optionLabel(options, value) {
  const opt = optionByValue(options, value);
  return opt?.label || String(value ?? "");
}

// Exclusive-option convention (step 03 §4.2): the backend's ChoiceOption is
// extra=forbid with NO exclusivity flag today — flagging "none known"-style
// options is a NAMED BACKEND ASK, deliberately not slug-hardcoded here.
// Forward-compat: if the backend adds `exclusive: true` to an option, this
// picks it up and the multi_choice renderer enforces mutual exclusion;
// until then every option is a normal toggle.
export function exclusiveOptionValue(section) {
  const hit = (section?.options || []).find((o) => o && o.exclusive === true);
  return hit ? hit.value : null;
}
