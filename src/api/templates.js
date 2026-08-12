// templates.js — report-service Templates API (Sprint 06).
//
// Contract: docs FRONTEND-TASK-templates-page.md. Base path /templates on the
// report-service (:8006, see SERVICES.report). The bearer JWT carries the
// tenant (`tid`) and roles — the backend derives visibility + permissions from
// it, so the FE never sends a tenant id in the URL or body.
//
// STRICT bodies (the backend models are extra="forbid"): for PUT/POST send
// EXACTLY the TemplateDefinition shape (§3) — round-trip the schema_jsonb you
// received and mutate only what changed. Any unknown field 422s the whole
// request. The list endpoint deliberately omits schema_jsonb (keep it light);
// fetch detail lazily when a row is opened (cached 60 s server-side).

import { apiAt } from "./client.js";
import { SERVICES } from "./services.js";

const a = (p, init) => apiAt(SERVICES.report, p, init);

function qs(params) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// ── HTTP surface ───────────────────────────────────────────────────────────

// GET /templates — TemplateSummary[] (metadata only, no schema_jsonb).
//   opts: { specialty, language: 'uk'|'en', tenant_only, include_deprecated, limit }
export async function listTemplates(opts = {}) {
  const { specialty, language, tenant_only, include_deprecated, limit } = opts;
  return a(`/templates${qs({ specialty, language, tenant_only, include_deprecated, limit })}`, { method: "GET" });
}

// GET /templates/{id} — TemplateDetail (summary + schema_jsonb). 404 if not
// visible (RLS returns 404, never 403 — do not leak existence).
export async function getTemplate(id) {
  return a(`/templates/${encodeURIComponent(id)}`, { method: "GET" });
}

// POST /templates/clone — clone a system template into the caller's tenant.
// tenant_admin only. → 201 { id } (new tenant row, parent_template_id set,
// status='draft').
export async function cloneTemplate({ system_template_id, new_name, new_code } = {}) {
  const body = { system_template_id };
  if (new_name) body.new_name = new_name;
  if (new_code) body.new_code = new_code;
  return a(`/templates/clone`, { method: "POST", body: JSON.stringify(body) });
}

// PUT /templates/{id} — full TemplateDefinition (NOT a patch). tenant_admin
// only. → { id, kind: 'cosmetic'|'structural'|'no_change' }. A 'structural'
// kind returns a NEW id (old row untouched). 409 if you try to edit a system
// row (clone first).
export async function updateTemplate(id, definition) {
  return a(`/templates/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(definition) });
}

// POST /templates — create from scratch (full TemplateDefinition). tenant_admin
// only. → 201 { id }.
export async function createTemplate(definition) {
  return a(`/templates`, { method: "POST", body: JSON.stringify(definition) });
}

// DELETE /templates/{id} — deprecate (soft delete). tenant_admin only. 204.
// Sets status='deprecated'; still fetchable by id, hidden from the default
// list. 409 if blocked by references.
export async function deleteTemplate(id) {
  return a(`/templates/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// GET /templates/{id}/sections/{sectionId}/prompt — tooling/debug affordance
// (preview the ASR prompt). → { prompt, language, section_name }.
export async function getSectionPrompt(id, sectionId) {
  return a(`/templates/${encodeURIComponent(id)}/sections/${encodeURIComponent(sectionId)}/prompt`, { method: "GET" });
}

// ── Re-bind (sprint 17) ─────────────────────────────────────────────────────
// The deprecate flow's other half: a template referenced by DRAFT reports
// cannot be deprecated (409) until each draft is re-bound to a successor.
// Both endpoints are template administration (`template.update`), and the
// listing is deliberately PHI-FREE — ids, statuses and timestamps only — a
// tenant_admin does not hold report.read.

// Exported for unit tests: the wire path/body builders.
export function boundReportsPath(id, limit) {
  const lim = Math.max(1, Math.min(200, Number(limit) || 50));
  return `/templates/${encodeURIComponent(id)}/bound-reports?limit=${lim}`;
}
export function rebindBody({ report_id, to_template_id } = {}) {
  return { report_id, to_template_id };
}

// GET /templates/{id}/bound-reports — bare array of
// { report_id, status: 'draft'|'finalized'|'signed'|'amended'|'cancelled',
//   created_at, updated_at }, updated_at DESC. 404 if the template is not
// visible (RLS — never "forbidden").
export async function listBoundReports(id, { limit } = {}) {
  return a(boundReportsPath(id, limit), { method: "GET" });
}

// POST /templates/{id}/rebind — move ONE draft report to a successor template.
// → { report_id, from_template_id, to_template_id }. Every guard is a 409
// with a distinct detail (see rebindErrorMessage); only drafts move —
// finalized/signed/amended reports keep their template forever.
export async function rebindReport(id, { report_id, to_template_id }) {
  return a(`/templates/${encodeURIComponent(id)}/rebind`, {
    method: "POST",
    body: JSON.stringify(rebindBody({ report_id, to_template_id })),
  });
}

// Map the rebind endpoints' problem-details onto operator-facing copy. Matched
// on status + detail substring: the route emits distinct details, no machine
// codes (backlogged as a backend ask in todo.md).
export function rebindErrorMessage(error, lang = "uk") {
  const L = (uk, en) => (lang === "uk" ? uk : en);
  const status = error?.status ?? 0;
  const detail = String(error?.problem?.detail || "");
  if (status === 404) return L("Шаблон або звіт не знайдено.", "Template or report not found.");
  if (status === 409) {
    if (detail.includes("not bound")) {
      return L("Звіт більше не прив'язаний до цього шаблону — оновіть список.",
               "The report is no longer bound to this template — refresh the list.");
    }
    if (detail.includes("only draft")) {
      return L("Переприв'язати можна лише чернетки — фіналізовані й підписані звіти зберігають свій шаблон.",
               "Only drafts can be re-bound — finalized and signed reports keep their template.");
    }
    if (detail.includes("already bound")) {
      return L("Звіт уже прив'язаний до обраного шаблону.",
               "The report is already bound to the chosen template.");
    }
    if (detail.includes("deprecated")) {
      return L("Цільовий шаблон знято з використання — оберіть чинний шаблон.",
               "The target template is deprecated — choose a current one.");
    }
    if (detail.includes("language")) {
      return L("Мова цільового шаблону не збігається з мовою поточного.",
               "The target template's language differs from the source.");
    }
  }
  return error?.message || L("Помилка", "Error");
}

// ── Validation mirrors (backend enforces too) — §3 ──────────────────────────

export const SLUG_RE = /^[a-z][a-z0-9_]*$/;
export const ASR_PROMPT_MAX = 896;      // ≈ 224 tokens
export const SYNTHESIS_PROMPT_MAX = 2000;
export const MAX_SECTIONS = 32;
export const FIELD_TYPES = [
  "free_text", "structured_diagnosis", "date", "date_with_note", "numeric_with_unit",
  "choice", "multi_choice", // sprint-13
];
// Sprint-13: field types that require options: [{value, label, voice_aliases}]
// (2..50 per section; forbidden on every other field_type).
export const CHOICE_FIELD_TYPES = ["choice", "multi_choice"];
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 50;

export function isSlug(s) {
  return typeof s === "string" && SLUG_RE.test(s);
}

// Validate a TemplateDefinition client-side. Returns { ok, errors } where
// errors is { field: message } keyed for inline display. Mirrors the backend
// rules so the editor can block obviously-invalid saves before the round-trip.
export function validateDefinition(def, lang = "en") {
  const L = (uk, en) => (lang === "uk" ? uk : en);
  const errors = {};
  if (!isSlug(def?.code)) {
    errors.code = L("Код має бути slug: ^[a-z][a-z0-9_]*$", "Code must be a slug: ^[a-z][a-z0-9_]*$");
  }
  const sections = Array.isArray(def?.sections) ? def.sections : [];
  if (sections.length < 1) {
    errors.sections = L("Потрібна щонайменше 1 секція", "At least 1 section is required");
  } else if (sections.length > MAX_SECTIONS) {
    errors.sections = L(`Не більше ${MAX_SECTIONS} секцій`, `At most ${MAX_SECTIONS} sections`);
  }

  // voice_aliases must be unique across the whole template.
  const aliasSeen = new Map(); // alias → first section index
  sections.forEach((s, i) => {
    if (!isSlug(s?.id)) {
      errors[`sec.${i}.id`] = L("ID секції має бути slug", "Section id must be a slug");
    }
    if (!s?.name?.trim?.()) {
      errors[`sec.${i}.name`] = L("Назва обов'язкова", "Name is required");
    }
    if (!FIELD_TYPES.includes(s?.field_type)) {
      errors[`sec.${i}.field_type`] = L("Невідомий тип поля", "Unknown field type");
    }
    if (s?.asr_prompt && s.asr_prompt.length > ASR_PROMPT_MAX) {
      errors[`sec.${i}.asr_prompt`] = L(`ASR-підказка ≤ ${ASR_PROMPT_MAX} символів`, `ASR prompt ≤ ${ASR_PROMPT_MAX} chars`);
    }
    if (s?.synthesis_prompt && s.synthesis_prompt.length > SYNTHESIS_PROMPT_MAX) {
      errors[`sec.${i}.synthesis_prompt`] = L(`Synthesis-підказка ≤ ${SYNTHESIS_PROMPT_MAX} символів`, `Synthesis prompt ≤ ${SYNTHESIS_PROMPT_MAX} chars`);
    }
    for (const raw of s?.voice_aliases || []) {
      const alias = String(raw || "").trim().toLowerCase();
      if (!alias) continue;
      if (aliasSeen.has(alias)) {
        errors[`sec.${i}.voice_aliases`] = L(
          `Псевдонім «${alias}» вже використано в іншій секції`,
          `Alias "${alias}" is already used by another section`,
        );
      } else {
        aliasSeen.set(alias, i);
      }
    }

    // Sprint-13 options mirror (backend TemplateSection._validate_options):
    // choice/multi_choice need 2..50 options with slug values, unique values,
    // case-insensitively unique labels, and per-section unique option
    // aliases; every other field_type must define none.
    const opts = Array.isArray(s?.options) ? s.options : [];
    if (CHOICE_FIELD_TYPES.includes(s?.field_type)) {
      if (opts.length < MIN_OPTIONS || opts.length > MAX_OPTIONS) {
        errors[`sec.${i}.options`] = L(
          `Потрібно ${MIN_OPTIONS}–${MAX_OPTIONS} варіантів`,
          `${MIN_OPTIONS}–${MAX_OPTIONS} options are required`,
        );
      } else {
        const values = new Set(), labels = new Set(), optAliases = new Set();
        for (const o of opts) {
          if (!isSlug(o?.value) || values.has(o.value)) {
            errors[`sec.${i}.options`] = L(
              "Значення варіантів мають бути унікальними slug",
              "Option values must be unique slugs",
            );
            break;
          }
          values.add(o.value);
          const lbl = String(o?.label || "").trim().toLowerCase();
          if (!lbl || labels.has(lbl)) {
            errors[`sec.${i}.options`] = L(
              "Назви варіантів мають бути унікальними",
              "Option labels must be unique (case-insensitive)",
            );
            break;
          }
          labels.add(lbl);
          let dup = false;
          for (const rawA of o?.voice_aliases || []) {
            const al = String(rawA || "").trim().toLowerCase();
            if (!al) continue;
            if (optAliases.has(al)) {
              errors[`sec.${i}.options`] = L(
                `Псевдонім «${al}» вже використано іншим варіантом`,
                `Alias "${al}" is already used by another option`,
              );
              dup = true;
              break;
            }
            optAliases.add(al);
          }
          if (dup) break;
        }
      }
    } else if (opts.length) {
      errors[`sec.${i}.options`] = L(
        "Варіанти дозволені лише для типів choice/multi_choice",
        "Options are only allowed on choice/multi_choice sections",
      );
    }
  });

  return { ok: Object.keys(errors).length === 0, errors };
}

// Predict the backend's cosmetic/structural classification (§2.4) so the editor
// can warn BEFORE saving — live, as the admin types (sprint 17). Mirrors
// `template_models.schema.classify_edit`: STRUCTURAL = code/language changed,
// section added/removed (an id change reads as both), field_type changed,
// required flipped, min_chars RAISED (loosening is cosmetic), or a choice
// option value removed/renamed. Everything else (name, aliases, prompts,
// order, default_content, metadata, added options, label edits) is cosmetic.
// The backend computes reason strings too but does not return them, so this
// mirror is the only source for the banner's reason list. Backend remains
// authoritative for the verdict that matters (the PUT's `kind`).
//
// Returns { kind: 'cosmetic'|'structural'|'no_change', reasons: [...] } where
// each reason is a structured record for formatEditReason to localize.
export function classifyEditDetailed(original, edited) {
  const reasons = [];
  if ((original?.code || "") !== (edited?.code || "")) {
    reasons.push({ rule: "code_changed", from: original?.code || "", to: edited?.code || "" });
  }
  if ((original?.language || "") !== (edited?.language || "")) {
    reasons.push({ rule: "language_changed", from: original?.language || "", to: edited?.language || "" });
  }

  const o = original?.sections || [];
  const e = edited?.sections || [];
  const oById = new Map(o.map((s) => [s.id, s]));
  const eById = new Map(e.map((s) => [s.id, s]));

  const added = [...eById.keys()].filter((id) => !oById.has(id));
  const removed = [...oById.keys()].filter((id) => !eById.has(id));
  if (added.length) reasons.push({ rule: "sections_added", values: added });
  if (removed.length) reasons.push({ rule: "sections_removed", values: removed });

  let changed = false;
  for (const [id, es] of eById) {
    const os = oById.get(id);
    if (!os) continue;
    if ((os.field_type || "") !== (es.field_type || "")) {
      reasons.push({ rule: "field_type_changed", section: id, from: os.field_type || "", to: es.field_type || "" });
    }
    if (!!os.required !== !!es.required) {
      reasons.push({ rule: "required_flipped", section: id, from: !!os.required, to: !!es.required });
    }
    if ((es.min_chars ?? 0) > (os.min_chars ?? 0)) {
      reasons.push({ rule: "min_chars_increased", section: id, from: os.min_chars ?? 0, to: es.min_chars ?? 0 });
    }
    // Sprint-13: removing (or renaming — remove+add) an option value is
    // structural: stored selections in report field_specific_metadata would
    // dangle. Adding options / label / alias edits are cosmetic.
    const newValues = new Set((es.options || []).map((x) => x?.value));
    const lost = (os.options || []).map((x) => x?.value).filter((v) => !newValues.has(v));
    if (lost.length) reasons.push({ rule: "option_values_removed", section: id, values: lost });

    if (JSON.stringify(os.options || []) !== JSON.stringify(es.options || [])) changed = true;
    // Cosmetic-only diffs.
    if (
      (os.name || "") !== (es.name || "") ||
      (os.asr_prompt || "") !== (es.asr_prompt || "") ||
      (os.synthesis_prompt || "") !== (es.synthesis_prompt || "") ||
      (os.default_content || "") !== (es.default_content || "") ||
      (os.order ?? 0) !== (es.order ?? 0) ||
      (es.min_chars ?? 0) !== (os.min_chars ?? 0) ||           // lowered → cosmetic
      JSON.stringify(os.voice_aliases || []) !== JSON.stringify(es.voice_aliases || [])
    ) changed = true;
  }
  if ((original?.name || "") !== (edited?.name || "")) changed = true;
  if (JSON.stringify(original?.metadata || {}) !== JSON.stringify(edited?.metadata || {})) changed = true;

  if (reasons.length) return { kind: "structural", reasons };
  return { kind: changed ? "cosmetic" : "no_change", reasons: [] };
}

// Back-compat: verdict only.
export function classifyEdit(original, edited) {
  return classifyEditDetailed(original, edited).kind;
}

// One structured reason → operator-facing copy for the live banner.
export function formatEditReason(r, lang = "uk") {
  const L = (uk, en) => (lang === "uk" ? uk : en);
  const list = (vs) => (vs || []).map((v) => `«${v}»`).join(", ");
  switch (r?.rule) {
    case "code_changed":
      return L(`Змінено код: ${r.from} → ${r.to}`, `Code changed: ${r.from} → ${r.to}`);
    case "language_changed":
      return L(`Змінено мову: ${r.from} → ${r.to}`, `Language changed: ${r.from} → ${r.to}`);
    case "sections_added":
      return L(`Додано секції: ${list(r.values)}`, `Sections added: ${list(r.values)}`);
    case "sections_removed":
      return L(`Вилучено секції: ${list(r.values)}`, `Sections removed: ${list(r.values)}`);
    case "field_type_changed":
      return L(`Секція «${r.section}»: тип поля ${r.from} → ${r.to}`,
               `Section "${r.section}": field type ${r.from} → ${r.to}`);
    case "required_flipped":
      return L(`Секція «${r.section}»: змінено обов'язковість`,
               `Section "${r.section}": required flag flipped`);
    case "min_chars_increased":
      return L(`Секція «${r.section}»: мінімум символів підвищено ${r.from} → ${r.to}`,
               `Section "${r.section}": min chars raised ${r.from} → ${r.to}`);
    case "option_values_removed":
      return L(`Секція «${r.section}»: вилучено або перейменовано значення варіантів: ${list(r.values)}`,
               `Section "${r.section}": option values removed/renamed: ${list(r.values)}`);
    default:
      return String(r?.rule || "");
  }
}

// ── Studio adapter ──────────────────────────────────────────────────────────
// The dictation Studio + TipTap editor consume a legacy bilingual template
// shape (name/{uk,en}, sections[].name/{uk,en}, anchor, icon). Map a backend
// summary/detail onto it so the dictation screen keeps working against the real
// API. Summaries carry no schema_jsonb → no sections (fetch detail for those).

const SPECIALTY_ICON = {
  cardiology: "heart", family_medicine: "user", emergency_department: "shield",
  neurology: "brain", internal_medicine: "fileText", surgery: "scalpel",
  pediatrics: "user", obstetrics: "user", dermatology: "layers",
  psychiatry: "brain", endocrinology: "fileText", radiology: "scan",
  discharge: "fileText", referral: "fileText",
};

export function specialtyIcon(specialty) {
  if (!specialty) return "fileText";
  const key = Object.keys(SPECIALTY_ICON).find((k) => String(specialty).startsWith(k));
  return key ? SPECIALTY_ICON[key] : "fileText";
}

export function toStudioTemplate(tpl) {
  if (!tpl) return null;
  const def = tpl.schema_jsonb || null;
  const sections = (def?.sections || [])
    .slice()
    .sort((x, y) => (x.order ?? 0) - (y.order ?? 0))
    .map((s) => {
      const alias = (s.voice_aliases && s.voice_aliases[0]) || s.name || "";
      return {
        id: s.id,
        required: !!s.required,
        field_type: s.field_type,
        voice_aliases: s.voice_aliases || [],
        // Sprint-13: choice/multi_choice options [{value, label, voice_aliases}]
        // — chip labels come from `label`, the saved value is `value`.
        options: s.options || [],
        min_chars: s.min_chars ?? 0,
        name: { uk: s.name, en: s.name },
        anchor: { uk: alias.toLowerCase(), en: alias.toLowerCase() },
      };
    });
  return {
    id: tpl.id,
    code: tpl.code,
    specialty: tpl.specialty,
    icon: specialtyIcon(tpl.specialty),
    name: { uk: tpl.name, en: tpl.name },
    builtin: !!tpl.is_system,
    is_system: !!tpl.is_system,
    tenant_id: tpl.tenant_id ?? null,
    parent_template_id: tpl.parent_template_id ?? null,
    status: tpl.status,
    language: tpl.language,
    schema_version: tpl.schema_version,
    sections,
    schema_jsonb: def,
  };
}
