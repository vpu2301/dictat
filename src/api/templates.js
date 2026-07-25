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
// can warn BEFORE saving. Structural = section added/removed, id changed,
// field_type changed, required flipped, or min_chars raised. Everything else
// (name, aliases, asr/synthesis prompt, order, default_content, metadata,
// min_chars lowered) is cosmetic. Backend remains authoritative.
export function classifyEdit(original, edited) {
  const o = original?.sections || [];
  const e = edited?.sections || [];
  const oById = new Map(o.map((s) => [s.id, s]));
  const eById = new Map(e.map((s) => [s.id, s]));

  // Added or removed section ids → structural.
  if (o.length !== e.length) return "structural";
  for (const id of eById.keys()) if (!oById.has(id)) return "structural";
  for (const id of oById.keys()) if (!eById.has(id)) return "structural";

  let changed = false;
  for (const [id, es] of eById) {
    const os = oById.get(id);
    if ((os.field_type || "") !== (es.field_type || "")) return "structural";
    if (!!os.required !== !!es.required) return "structural";
    if ((es.min_chars ?? 0) > (os.min_chars ?? 0)) return "structural"; // raised
    // Sprint-13: removing (or renaming — remove+add) an option value is
    // structural: stored selections in report field_specific_metadata would
    // dangle. Adding options / label / alias edits are cosmetic.
    const newValues = new Set((es.options || []).map((o) => o?.value));
    for (const o of os.options || []) {
      if (!newValues.has(o?.value)) return "structural";
    }
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

  return changed ? "cosmetic" : "no_change";
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
