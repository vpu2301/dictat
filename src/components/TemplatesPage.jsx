// TemplatesPage.jsx — clinic-admin Templates library wired to report-service
// (Sprint 06; contract: FRONTEND-TASK-templates-page.md).
//
// Browse own + system templates (tenant-scoped, RLS-enforced), preview a
// template's full section structure, clone a system template into the tenant,
// edit a tenant template (cosmetic-vs-structural aware), and deprecate a tenant
// template. Templates are NOT PHI but ARE tenant-scoped — we only ever render
// what the backend returns for the caller's tenant.
//
// RBAC: read/list/preview is open to all clinical roles; clone/update/deprecate
// is tenant_admin only. We hide write controls for non-admins (the backend also
// 403s the action). See §5.

import React, { useMemo, useState, useCallback, useEffect } from "react";
import { Icon, Empty } from "./UI.jsx";
import { Loading, asList } from "./DataStates.jsx";
import { ApiErrorView } from "./ApiErrorView.jsx";
import { Pagination } from "./Pagination.jsx";
import { MenuSelect } from "./MenuSelect.jsx";
import { useAsync } from "../api/useAsync.js";
import { usePermission } from "../auth/permissions.js";
import { getStarredIds, toggleStar } from "../api/templatePrefs.js";
import {
  listTemplates, getTemplate, cloneTemplate, createTemplate, updateTemplate, deleteTemplate,
  getSectionPrompt, validateDefinition, classifyEditDetailed, formatEditReason, isSlug,
  FIELD_TYPES, CHOICE_FIELD_TYPES,
  ASR_PROMPT_MAX, SYNTHESIS_PROMPT_MAX, MAX_SECTIONS, MIN_OPTIONS, MAX_OPTIONS, specialtyIcon,
} from "../api/templates.js";
import { tr } from "../i18n.js";

const T = (lang, uk, en) => tr(lang, uk, en);

// Client-side pagination over the fetched list (the list endpoint returns up to
// `limit` rows in one shot; we page through them locally).
const TEMPLATE_PAGE_SIZE_OPTIONS = [12, 24, 48, 96];

// Seeded specialties (§7) for the filter dropdown — stable regardless of the
// active server-side filter. Backend specialty is a free slug; unknown values
// still render (raw) in the list, this just powers the picker.
// Exported for the Dictate home quick-start tiles (same label vocabulary).
export const SPECIALTIES = [
  ["cardiology",          "Кардіологія",      "Cardiology"],
  ["family_medicine",     "Сімейна медицина", "Family medicine"],
  ["emergency_department","Невідкладна",      "Emergency dept."],
  ["neurology",           "Неврологія",       "Neurology"],
  ["internal_medicine",   "Терапія",          "Internal medicine"],
  ["surgery",             "Хірургія",         "Surgery"],
  ["pediatrics",          "Педіатрія",        "Pediatrics"],
  ["obstetrics",          "Акушерство",       "Obstetrics"],
  ["dermatology",         "Дерматологія",     "Dermatology"],
  ["psychiatry",          "Психіатрія",       "Psychiatry"],
  ["endocrinology",       "Ендокринологія",   "Endocrinology"],
  ["radiology",           "Радіологія",       "Radiology"],
];
// ── Categories ───────────────────────────────────────────────────────────────
// The backend has no `category` column on templates (the list endpoint returns
// code/name/specialty/language/status and nothing else), so the split is
// derived here from the code. "Forms" are the standalone documents a visit
// produces — discharge summary, referral, operative note, intake sheet — as
// opposed to the per-specialty visit notes. Tenant clones keep the seed code as
// a stem (`referral_letter_uk_custom`), so we match the stem, not the full code.
export const FORM_CODE_STEMS = [
  "discharge_summary",
  "referral_letter",
  "operative_note",
  "anamnesis_intake",
];
export function isFormTemplate(tpl) {
  const code = String(tpl?.code || "").toLowerCase();
  if (FORM_CODE_STEMS.some((stem) => code.includes(stem))) return true;
  // Hand-authored tenant templates that call themselves a form.
  return /(^|_)forms?(_|$)/.test(code) || /(^|\s)форм[аи](\s|$)/i.test(tpl?.name || "");
}

// Forms sit next to report templates and note structures as a tab of the
// library page, so the split is a partition rather than a filter: the reports
// tab is every template that is NOT a form.
const inCategory = (tpl, category) =>
  category === "forms" ? isFormTemplate(tpl) : !isFormTemplate(tpl);

export const FIELD_TYPE_LABELS = {
  free_text:            ["Вільний текст",       "Free text"],
  structured_diagnosis: ["Структ. діагноз",     "Structured diagnosis"],
  date:                 ["Дата",                "Date"],
  date_with_note:       ["Дата з приміткою",    "Date + note"],
  numeric_with_unit:    ["Число з одиницею",    "Numeric + unit"],
  choice:               ["Один варіант",        "Single choice"],
  multi_choice:         ["Кілька варіантів",    "Multiple choice"],
};

// ── Error → message mapping (§6) ─────────────────────────────────────────────
// Never say "forbidden" on a 404 — RLS returns 404 for another tenant's row to
// avoid leaking existence.
function templateErrorMessage(error, lang, context) {
  const status = error?.status ?? 0;
  if (status === 404) return T(lang, "Шаблон не знайдено.", "Template not found.");
  if (status === 409) {
    if (context === "delete") return T(lang, "Цей шаблон використовується і не може бути депрекований.", "This template is in use and can't be deprecated.");
    return T(lang, "Системні шаблони не можна редагувати — спочатку клонуйте.", "System templates can't be edited — clone it first.");
  }
  if (status === 422) return T(lang, "Помилка валідації — перевірте поля.", "Validation error — check the fields.");
  return error?.message || T(lang, "Помилка", "Error");
}

// Pull field-level messages out of a 422 body. Two wire shapes exist: the
// FastAPI default puts the array in `detail`; the platform's RFC-9457 handler
// keeps `detail` a sentence and carries the array as an `errors` member.
function pydanticErrors(error) {
  const p = error?.problem || {};
  const d = Array.isArray(p.detail) ? p.detail : Array.isArray(p.errors) ? p.errors : [];
  return d.map((e) => ({
    loc: Array.isArray(e.loc) ? e.loc.filter((x) => x !== "body").join(".") : "",
    msg: e.msg || String(e),
  }));
}

export function ErrorBanner({ error, lang, context }) {
  if (!error) return null;
  const fields = error.status === 422 ? pydanticErrors(error) : [];
  return (
    <div role="alert" className="tpl-err-banner">
      <Icon name="flag" size={14} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{templateErrorMessage(error, lang, context)}</div>
        {fields.length > 0 && (
          <ul className="tpl-err-fields">
            {fields.map((f, i) => (
              <li key={i}><code>{f.loc}</code> {f.msg}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Origin / status badges ───────────────────────────────────────────────────
// Exported (with StatusBadge, ErrorBanner, SectionRow, TemplateFormModal,
// CloneModal, FIELD_TYPE_LABELS) for the sprint-17 admin surface, which reuses
// this machinery at /admin/templates rather than forking a second editor.
export function OriginBadge({ tpl, lang }) {
  const system = tpl.is_system || tpl.tenant_id == null;
  return (
    <span className={`tpl-badge ${system ? "system" : "custom"}`}>
      <Icon name={system ? "shield" : "user"} size={10} />
      {system ? T(lang, "Системний", "System") : T(lang, "Власний", "Custom")}
    </span>
  );
}
export function StatusBadge({ status, lang }) {
  if (status === "active") return null;
  const map = {
    draft:      [T(lang, "Чернетка", "Draft"), "draft"],
    deprecated: [T(lang, "Депрекований", "Deprecated"), "deprecated"],
  };
  const row = map[status];
  if (!row) return null;
  return <span className={`tpl-badge status ${row[1]}`}>{row[0]}</span>;
}


// ── Main page ─────────────────────────────────────────────────────────────────
// `category` is the library tab this list belongs to — "reports" (visit note
// templates) or "forms" (the standalone documents). It is a prop, not state:
// the tab strip that switches it lives on TemplateLibraryPage.
export function TemplatesPage({ lang, navigate, embedded = false, category = "reports" }) {
  const canWrite = usePermission("templates.write", "template");

  const [specialty, setSpecialty]   = useState("");
  const [language, setLanguage]     = useState("");
  const [showDeprecated, setShowDep]= useState(false);
  const [customOnly, setCustomOnly] = useState(false);
  const [starredOnly, setStarredOnly] = useState(false);
  const [search, setSearch]         = useState("");

  // Per-user favorites (interim localStorage-backed — see templatePrefs.js).
  const [stars, setStars] = useState(() => getStarredIds());
  const onToggleStar = useCallback((id) => {
    toggleStar(id);
    setStars(getStarredIds());
  }, []);

  const [page, setPage]             = useState(1);
  const [pageSize, setPageSize]     = useState(TEMPLATE_PAGE_SIZE_OPTIONS[0]);

  const [openId, setOpenId]   = useState(null);   // detail modal target
  const [cloneFor, setCloneFor] = useState(null); // summary being cloned
  const [creating, setCreating] = useState(false);// blank-template form
  const [toast, setToast]     = useState(null);

  const req = useAsync(
    () => listTemplates({
      specialty: specialty || undefined,
      language: language || undefined,
      tenant_only: customOnly || undefined,
      include_deprecated: showDeprecated || undefined,
      limit: 200,
    }),
    [specialty, language, customOnly, showDeprecated],
  );

  // Scoped to the tab up front, so every count below it — the header, the
  // chips, the pager — describes this tab and not the whole library.
  const all = useMemo(
    () => asList(req.data).filter((t) => inCategory(t, category)),
    [req.data, category],
  );
  const list = useMemo(() => {
    let out = all;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter((t) =>
        `${t.name || ""} ${t.code || ""} ${t.specialty || ""}`.toLowerCase().includes(q));
    }
    if (starredOnly) out = out.filter((t) => stars.has(t.id));
    // Surface starred templates first; otherwise preserve server order.
    return out.slice().sort((a, b) => (stars.has(b.id) ? 1 : 0) - (stars.has(a.id) ? 1 : 0));
  }, [all, search, starredOnly, stars]);

  const customCount = all.filter((t) => !(t.is_system || t.tenant_id == null)).length;
  const starredCount = all.filter((t) => stars.has(t.id)).length;

  // Client-side pagination over the filtered list.
  const pageCount = Math.max(1, Math.ceil(list.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageItems = useMemo(
    () => list.slice((safePage - 1) * pageSize, safePage * pageSize),
    [list, safePage, pageSize],
  );

  // Reset to page 1 whenever the filtered result set changes.
  useEffect(() => {
    setPage(1);
  }, [search, category, specialty, language, customOnly, showDeprecated, starredOnly]);

  const fireToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }, []);

  // After a clone: reload + open the new tenant template's detail.
  const onCloned = useCallback((newId) => {
    setCloneFor(null);
    req.reload();
    setOpenId(newId);
    fireToast(T(lang, "Шаблон клоновано", "Template cloned"));
  }, [req, lang, fireToast]);

  // After an edit: reload; if structural, the id changed → follow it.
  const onEdited = useCallback((res) => {
    req.reload();
    if (res?.kind === "structural" && res.id) {
      setOpenId(res.id);
      fireToast(T(lang, "Створено нову версію шаблону", "New template version created"));
    } else if (res?.kind === "cosmetic") {
      fireToast(T(lang, "Зміни збережено", "Changes saved"));
    } else {
      fireToast(T(lang, "Без змін", "No changes"));
    }
  }, [req, lang, fireToast]);

  // After a create: reload + open the fresh template's detail.
  const onCreated = useCallback((res) => {
    setCreating(false);
    req.reload();
    if (res?.id) setOpenId(res.id);
    fireToast(T(lang, "Шаблон створено", "Template created"));
  }, [req, lang, fireToast]);

  const onDeprecated = useCallback(() => {
    setOpenId(null);
    req.reload();
    fireToast(T(lang, "Шаблон депрековано", "Template deprecated"));
  }, [req, lang, fireToast]);

  return (
    // `embedded`: a tab of the Templates page, which owns the frame and the
    // title. The counts move up into that header, so nothing is lost.
    <div className={embedded ? "page-embedded" : "page"}>
      {!embedded && (
      <div className="page-h">
        <div>
          <h1>{category === "forms"
            ? T(lang, "Форми", "Forms")
            : T(lang, "Шаблони звітів", "Report templates")}</h1>
          <p className="sub">
            {all.length} {T(lang, "шаблонів", "templates")}
            {customCount > 0 && ` · ${customCount} ${T(lang, "власних", "custom")}`}
            {!canWrite && ` · ${T(lang, "лише перегляд", "read-only")}`}
          </p>
        </div>
      </div>
      )}

      {/* Toolbar */}
      <div className="ptable-toolbar" style={{ marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <label className="search-input">
          <Icon name="search" size={14} />
          <input
            placeholder={T(lang, "Пошук шаблону…", "Search templates…")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        <MenuSelect
          icon="filter"
          value={specialty}
          onChange={setSpecialty}
          ariaLabel={T(lang, "Спеціальність", "Specialty")}
          options={[
            { value: "", label: T(lang, "Всі спеціальності", "All specialties") },
            ...[...SPECIALTIES]
              .map(([v, uk, en]) => ({ value: v, label: T(lang, uk, en) }))
              .sort((a, b) => a.label.localeCompare(b.label)),
          ]}
        />

        <MenuSelect
          icon="flag"
          value={language}
          onChange={setLanguage}
          ariaLabel={T(lang, "Мова", "Language")}
          options={[
            { value: "", label: T(lang, "Всі мови", "All languages") },
            { value: "uk", label: T(lang, "Українська", "Ukrainian") },
            { value: "en", label: T(lang, "Англійська", "English") },
          ]}
        />

        <button
          type="button"
          className={"tpl-filter-chip" + (customOnly ? " on" : "")}
          onClick={() => setCustomOnly((v) => !v)}
          aria-pressed={customOnly}
        >
          {T(lang, "Лише власні", "Custom only")}
        </button>
        <button
          type="button"
          className={"tpl-filter-chip" + (starredOnly ? " on" : "")}
          onClick={() => setStarredOnly((v) => !v)}
          aria-pressed={starredOnly}
        >
          <Icon name="star" size={12} fill={starredOnly ? "currentColor" : "none"} />
          <span>{T(lang, "Лише обрані", "Starred only")}{starredCount > 0 ? ` (${starredCount})` : ""}</span>
        </button>
        <button
          type="button"
          className={"tpl-filter-chip" + (showDeprecated ? " on" : "")}
          onClick={() => setShowDep((v) => !v)}
          aria-pressed={showDeprecated}
        >
          {T(lang, "Показати депрековані", "Show deprecated")}
        </button>

        <div style={{ flex: 1 }} />
        {canWrite && (
          <button type="button" className="btn accent" onClick={() => setCreating(true)}>
            <Icon name="plus" size={13} /> {T(lang, "Новий шаблон", "New template")}
          </button>
        )}
      </div>

      {/* Body states */}
      {req.loading ? (
        <Loading lang={lang} />
      ) : req.error ? (
        <ApiErrorView error={req.error} lang={lang} />
      ) : list.length === 0 ? (
        <Empty
          icon="layers"
          title={T(lang, "Шаблонів не знайдено", "No templates found")}
          body={category === "forms" && all.length === 0
            ? T(lang, "У цій категорії ще немає шаблонів — форми це виписки, скерування, протоколи та анкети.",
                      "Nothing in this tab yet — forms are discharge summaries, referrals, operative notes and intake sheets.")
            : T(lang, "Спробуйте змінити фільтри.", "Try adjusting the filters.")}
          action={canWrite ? (
            <button type="button" className="btn accent" onClick={() => setCreating(true)}>
              <Icon name="plus" size={13} /> {T(lang, "Новий шаблон", "New template")}
            </button>
          ) : null}
        />
      ) : (
        <>
          <TemplateTable items={pageItems} lang={lang} onOpen={setOpenId}
            stars={stars} onToggleStar={onToggleStar} />
          <Pagination
            page={safePage}
            pageCount={pageCount}
            onPage={setPage}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(pageCount, p + 1))}
            total={list.length}
            pageSize={pageSize}
            pageSizeOptions={TEMPLATE_PAGE_SIZE_OPTIONS}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
            lang={lang}
          />
        </>
      )}

      {/* Detail / preview modal */}
      {openId && (
        <TemplateDetailModal
          id={openId}
          lang={lang}
          canWrite={canWrite}
          onClose={() => setOpenId(null)}
          onClone={(summary) => setCloneFor(summary)}
          onEdited={onEdited}
          onDeprecated={onDeprecated}
        />
      )}

      {/* Create-from-scratch form */}
      {creating && (
        <TemplateFormModal
          lang={lang}
          onClose={() => setCreating(false)}
          onSaved={onCreated}
        />
      )}

      {/* Clone modal (can be triggered from detail) */}
      {cloneFor && (
        <CloneModal
          source={cloneFor}
          lang={lang}
          onClose={() => setCloneFor(null)}
          onCloned={onCloned}
        />
      )}

      {toast && <div className="tpl-toast" role="status">{toast}</div>}
    </div>
  );
}

// Shared star toggle. Stops propagation so it never triggers the row/card open.
function StarButton({ starred, lang, onToggle, className = "" }) {
  return (
    <button
      type="button"
      className={`tpl-star-btn ${className}` + (starred ? " on" : "")}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      aria-pressed={starred}
      title={starred
        ? T(lang, "Прибрати з обраних", "Remove from starred")
        : T(lang, "Додати в обрані", "Add to starred")}
    >
      <Icon name="star" size={15} fill={starred ? "currentColor" : "none"} />
    </button>
  );
}

// ── List view ─────────────────────────────────────────────────────────────────
function TemplateTable({ items, lang, onOpen, stars, onToggleStar }) {
  return (
    <div className="ptable">
      <div className="tpl-thead">
        <span>{T(lang, "Назва", "Name")}</span>
        <span>{T(lang, "Код", "Code")}</span>
        <span>{T(lang, "Спеціальність", "Specialty")}</span>
        <span>{T(lang, "Походження", "Origin")}</span>
        <span>{T(lang, "Мова", "Lang")}</span>
        <span>{T(lang, "Версія", "Ver.")}</span>
        <span>{T(lang, "Статус", "Status")}</span>
      </div>
      {items.map((tpl) => (
        <TemplateRow key={tpl.id} tpl={tpl} lang={lang} onOpen={() => onOpen(tpl.id)}
          starred={stars.has(tpl.id)} onToggleStar={onToggleStar} />
      ))}
    </div>
  );
}

function TemplateRow({ tpl, lang, onOpen, starred, onToggleStar }) {
  const specLabel = SPECIALTIES.find((s) => s[0] === tpl.specialty);
  return (
    <div
      className="tpl-trow"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      style={{ opacity: tpl.status === "deprecated" ? 0.6 : 1 }}
    >
      <div className="tpl-trow-name">
        <StarButton starred={starred} lang={lang} onToggle={() => onToggleStar(tpl.id)} className="sm" />
        <div className="tpl-card-icon"><Icon name={specialtyIcon(tpl.specialty)} size={16} /></div>
        <span>{tpl.name}</span>
      </div>
      <span className="tpl-cell-mut"><code>{tpl.code}</code></span>
      <span className="tpl-cell-mut">{specLabel ? T(lang, specLabel[1], specLabel[2]) : tpl.specialty}</span>
      <span><OriginBadge tpl={tpl} lang={lang} /></span>
      <span className="tpl-cell-mut">{(tpl.language || "").toUpperCase()}</span>
      <span className="tpl-cell-mut">v{tpl.schema_version}</span>
      <span>
        <StatusBadge status={tpl.status} lang={lang} />
        {tpl.status === "active" && <span className="tpl-cell-mut">{T(lang, "Активний", "Active")}</span>}
      </span>
    </div>
  );
}

// ── Detail / preview modal ───────────────────────────────────────────────────
function TemplateDetailModal({ id, lang, canWrite, onClose, onClone, onEdited, onDeprecated }) {
  const req = useAsync(() => getTemplate(id), [id]);
  const [editing, setEditing]   = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const tpl = req.data;
  const def = tpl?.schema_jsonb;
  const system = tpl ? (tpl.is_system || tpl.tenant_id == null) : false;
  const sections = useMemo(
    () => (def?.sections || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [def],
  );

  // Hand off to the full editor once we have the detail in hand.
  if (editing && tpl) {
    return (
      <TemplateFormModal
        detail={tpl}
        lang={lang}
        onClose={() => setEditing(false)}
        onSaved={(res) => { setEditing(false); onClose(); onEdited(res); }}
      />
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="tpl-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tpl-modal-head">
          <div>
            <h2>{tpl?.name || T(lang, "Шаблон", "Template")}</h2>
            <p>{T(lang, "Структура звіту та налаштування ASR", "Report structure and ASR configuration")}</p>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>

        <div className="tpl-modal-body">
          {req.loading ? (
            <Loading lang={lang} />
          ) : req.error ? (
            <ErrorBanner error={req.error} lang={lang} context="detail" />
          ) : (
            <>
              <div className="tpl-detail-meta">
                <span className="chip">{tpl.code}</span>
                <OriginBadge tpl={tpl} lang={lang} />
                <span className="tpl-badge lang">{(tpl.language || "").toUpperCase()}</span>
                <span className="tpl-badge version">v{tpl.schema_version}</span>
                <StatusBadge status={tpl.status} lang={lang} />
                {tpl.parent_template_id && (
                  <span className="tpl-badge" title={tpl.parent_template_id}>
                    {T(lang, "клон", "cloned")}
                  </span>
                )}
              </div>

              <div className="rail-h" style={{ padding: "12px 0 8px", fontSize: 11 }}>
                {T(lang, "СЕКЦІЇ", "SECTIONS")} · {sections.length}
              </div>
              <div className="tpl-detail-sections">
                {sections.map((s, i) => (
                  <SectionRow key={s.id || i} s={s} idx={i} lang={lang} templateId={tpl.id} />
                ))}
              </div>

              {def?.metadata && Object.keys(def.metadata).length > 0 && (
                <div className="tpl-detail-metadata">
                  <div className="rail-h" style={{ padding: "12px 0 8px", fontSize: 11 }}>
                    {T(lang, "МЕТАДАНІ", "METADATA")}
                  </div>
                  {Object.entries(def.metadata).map(([k, v]) => (
                    <div key={k} className="tpl-meta-row"><code>{k}</code><span>{String(v)}</span></div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="tpl-modal-foot">
          <button className="btn" onClick={onClose}>{T(lang, "Закрити", "Close")}</button>
          <div style={{ flex: 1 }} />
          {canWrite && tpl && system && (
            <button className="btn accent" onClick={() => onClone(tpl)}>
              <Icon name="layers" size={13} /> {T(lang, "Клонувати", "Clone")}
            </button>
          )}
          {canWrite && tpl && !system && tpl.status !== "deprecated" && (
            <>
              <button className="btn danger" onClick={() => setConfirmDel(true)}>
                <Icon name="x" size={13} /> {T(lang, "Депрекувати", "Deprecate")}
              </button>
              <button className="btn accent" onClick={() => setEditing(true)}>
                <Icon name="edit" size={13} /> {T(lang, "Редагувати", "Edit")}
              </button>
            </>
          )}
        </div>

        {confirmDel && (
          <DeprecateConfirm
            tpl={tpl}
            lang={lang}
            onClose={() => setConfirmDel(false)}
            onDone={() => { setConfirmDel(false); onDeprecated(); }}
          />
        )}
      </div>
    </div>
  );
}

// One section row in the preview, with an on-demand "ASR prompt" peek (§2.6).
export function SectionRow({ s, idx, lang, templateId }) {
  const [showPrompt, setShowPrompt] = useState(false);
  const promptReq = useAsync(
    () => getSectionPrompt(templateId, s.id),
    [templateId, s.id],
    { enabled: showPrompt },
  );
  const ft = FIELD_TYPE_LABELS[s.field_type];
  return (
    <div className="tpl-detail-row">
      <div className="tpl-sec-num">{idx + 1}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="tpl-detail-row-head">
          <span style={{ fontWeight: 600 }}>{s.name}</span>
          <code className="tpl-sec-id">{s.id}</code>
          {s.required && <span className="req-tag">{T(lang, "Обов'язк.", "Required")}</span>}
          <span className="tpl-badge fieldtype">{ft ? T(lang, ft[0], ft[1]) : s.field_type}</span>
          {typeof s.min_chars === "number" && s.min_chars > 0 && (
            <span className="psub" style={{ fontSize: 11 }}>min {s.min_chars}</span>
          )}
        </div>
        {s.voice_aliases?.length > 0 && (
          <div className="tpl-aliases">
            {s.voice_aliases.map((a) => <span key={a} className="tpl-alias">«{a}»</span>)}
          </div>
        )}
        {s.options?.length > 0 && (
          <div className="tpl-aliases">
            {s.options.map((o) => (
              <span key={o.value} className="chip" style={{ fontSize: 11 }}>{o.label || o.value}</span>
            ))}
          </div>
        )}
        {s.asr_prompt && (
          <button className="tpl-prompt-toggle" onClick={() => setShowPrompt((v) => !v)}>
            <Icon name="mic" size={11} /> {showPrompt
              ? T(lang, "Сховати ASR-підказку", "Hide ASR prompt")
              : T(lang, "ASR-підказка", "ASR prompt")}
          </button>
        )}
        {showPrompt && (
          <div className="tpl-prompt-box">
            {promptReq.loading
              ? <span className="psub">{T(lang, "Завантаження…", "Loading…")}</span>
              : promptReq.error
                ? <span className="psub">{s.asr_prompt}</span>
                : (promptReq.data?.prompt || s.asr_prompt)}
          </div>
        )}
        {s.synthesis_prompt && (
          <div className="psub" style={{ fontSize: 11, marginTop: 4 }}>
            {T(lang, "Synthesis:", "Synthesis:")} {s.synthesis_prompt}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Clone modal (§2.3) ────────────────────────────────────────────────────────
export function CloneModal({ source, lang, onClose, onCloned }) {
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const codeBad = newCode.trim() !== "" && !isSlug(newCode.trim());

  const submit = async () => {
    if (codeBad || busy) return;
    setBusy(true); setError(null);
    try {
      const res = await cloneTemplate({
        system_template_id: source.id,
        new_name: newName.trim() || undefined,
        new_code: newCode.trim() || undefined,
      });
      onCloned(res?.id);
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <h2>{T(lang, "Клонувати шаблон", "Clone template")}</h2>
          <p>{T(lang,
            "Створює власну копію у вашій клініці (статус «чернетка»), яку можна редагувати.",
            "Creates an editable copy in your tenant (status “draft”).")}</p>
        </div>
        <div className="modal-body" style={{ display: "grid", gap: 12 }}>
          <div className="tpl-clone-source">
            <Icon name={specialtyIcon(source.specialty)} size={16} />
            <div>
              <div style={{ fontWeight: 600 }}>{source.name}</div>
              <span className="chip" style={{ fontSize: 11 }}>{source.code}</span>
            </div>
          </div>
          <label className="tpl-field">
            <span>{T(lang, "Нова назва (необов'язково)", "New name (optional)")}</span>
            <input className="ti" value={newName} onChange={(e) => setNewName(e.target.value)}
              placeholder={source.name} />
          </label>
          <label className="tpl-field">
            <span>{T(lang, "Новий код (необов'язково)", "New code (optional)")}</span>
            <input className="ti mono" value={newCode} onChange={(e) => setNewCode(e.target.value)}
              placeholder={`${source.code}_custom`} />
            {codeBad && <span className="tpl-inline-err">{T(lang, "Код має бути slug (a-z, 0-9, _)", "Code must be a slug (a-z, 0-9, _)")}</span>}
          </label>
          <ErrorBanner error={error} lang={lang} context="clone" />
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose} disabled={busy}>{T(lang, "Скасувати", "Cancel")}</button>
          <button className="btn accent" onClick={submit} disabled={codeBad || busy}>
            <Icon name="layers" size={13} /> {busy ? T(lang, "Клонування…", "Cloning…") : T(lang, "Клонувати", "Clone")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Deprecate confirm (§2.5) ──────────────────────────────────────────────────
function DeprecateConfirm({ tpl, lang, onClose, onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const submit = async () => {
    setBusy(true); setError(null);
    try {
      await deleteTemplate(tpl.id);
      onDone();
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <h2>{T(lang, "Депрекувати шаблон?", "Deprecate template?")}</h2>
          <p>{T(lang,
            "Шаблон зникне зі списку за замовчуванням, але залишиться доступним за прямим посиланням. Наявні звіти продовжать його використовувати.",
            "It disappears from the default list but stays reachable by direct link. Existing reports keep using it.")}</p>
        </div>
        <div className="modal-body"><ErrorBanner error={error} lang={lang} context="delete" /></div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose} disabled={busy}>{T(lang, "Скасувати", "Cancel")}</button>
          <button className="btn danger" onClick={submit} disabled={busy}>
            <Icon name="x" size={13} /> {busy ? "…" : T(lang, "Депрекувати", "Deprecate")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Full form: create from scratch + edit (§2.4 + §3) ────────────────────────
const blankSection = () => ({
  _origId: null, id: "", name: "", field_type: "free_text", required: false,
  min_chars: 0, asr_prompt: "", synthesis_prompt: "", default_content: "",
  voice_aliases: "", options: [],
});

const blankOption = () => ({ value: "", label: "", voice_aliases: "" });

function fromSection(s) {
  return {
    _origId: s.id,
    id: s.id || "",
    name: s.name || "",
    field_type: s.field_type || "free_text",
    required: !!s.required,
    min_chars: s.min_chars ?? 0,
    asr_prompt: s.asr_prompt || "",
    synthesis_prompt: s.synthesis_prompt || "",
    default_content: s.default_content || "",
    voice_aliases: (s.voice_aliases || []).join(", "),
    options: (s.options || []).map((o) => ({
      value: o.value || "",
      label: o.label || "",
      voice_aliases: (o.voice_aliases || []).join(", "),
    })),
  };
}

const parseAliases = (raw) =>
  String(raw || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);

// Draft → wire options. Only meaningful for choice/multi_choice sections.
// `baseOptions` are the originals we were served: round-trip them by value so
// fields the backend added (and we don't edit) survive the PUT.
const buildOptions = (s, baseOptions = []) => {
  const byValue = new Map(baseOptions.map((o) => [o.value, o]));
  return (s.options || []).map((o) => {
    const value = o.value.trim();
    const out = { ...(byValue.get(value) || {}), value, label: o.label.trim() };
    const aliases = parseAliases(o.voice_aliases);
    if (aliases.length) out.voice_aliases = aliases;
    else delete out.voice_aliases;
    return out;
  });
};

// `detail` present → edit that tenant template (PUT). Absent → create a blank
// one (POST). The two differ only in the seed state, the save call and the
// structural-change gate (a brand-new template has no old version to warn about).
export function TemplateFormModal({ detail = null, lang, onClose, onSaved }) {
  const creating = !detail;
  const originalDef = detail?.schema_jsonb || {};
  const [code, setCode]           = useState(originalDef.code || detail?.code || "");
  const [name, setName]           = useState(originalDef.name || detail?.name || "");
  const [language, setLanguage]   = useState(originalDef.language || detail?.language || "uk");
  const [specialty, setSpecialty] = useState(originalDef.specialty || detail?.specialty || "");
  const [meta, setMeta] = useState({
    moh_order_ref: originalDef.metadata?.moh_order_ref || "",
    billing_code:  originalDef.metadata?.billing_code || "",
    fhir_template: originalDef.metadata?.fhir_template || "",
  });
  const [sections, setSections] = useState(() => {
    const seeded = (originalDef.sections || [])
      .slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(fromSection);
    return seeded.length ? seeded : [blankSection()];
  });

  const [confirmStructural, setConfirmStructural] = useState(null); // built def awaiting confirm
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Sprint 17 — the LIVE cosmetic/structural banner. The FE mirror of the
  // backend classifier runs as the admin types (debounced a keystroke's
  // breath), so whether this edit will version the template is visible BEFORE
  // save, not in a surprise confirm. Creating has no old version to compare.
  const [liveEdit, setLiveEdit] = useState(null); // {kind, reasons} | null
  useEffect(() => {
    if (creating) return undefined;
    const t = setTimeout(() => {
      try {
        setLiveEdit(classifyEditDetailed(originalDef, buildDefinition()));
      } catch {
        setLiveEdit(null); // half-typed drafts may not build; stay quiet
      }
    }, 250);
    return () => clearTimeout(t);
    // buildDefinition is re-created each render; the deps below are its inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creating, code, name, language, specialty, sections, meta]);

  // Switching a section to/from choice/multi_choice moves the options with it:
  // the choice types need 2..50, every other type must carry none (§3).
  const setSection = (i, key, val) =>
    setSections((prev) => prev.map((s, idx) => {
      if (idx !== i) return s;
      const next = { ...s, [key]: val };
      if (key === "field_type") {
        if (CHOICE_FIELD_TYPES.includes(val)) {
          if (!next.options.length) next.options = [blankOption(), blankOption()];
        } else {
          next.options = [];
        }
      }
      return next;
    }));
  const setOption = (i, oi, key, val) =>
    setSections((prev) => prev.map((s, idx) => (idx === i
      ? { ...s, options: s.options.map((o, oidx) => (oidx === oi ? { ...o, [key]: val } : o)) }
      : s)));
  const addOption = (i) =>
    setSections((prev) => prev.map((s, idx) => (idx === i
      ? { ...s, options: [...s.options, blankOption()] } : s)));
  const removeOption = (i, oi) =>
    setSections((prev) => prev.map((s, idx) => (idx === i
      ? { ...s, options: s.options.filter((_, oidx) => oidx !== oi) } : s)));
  const addSection = () => setSections((prev) => [...prev, blankSection()]);
  const removeSection = (i) => setSections((prev) => prev.filter((_, idx) => idx !== i));
  const move = (i, dir) => setSections((prev) => {
    const j = i + dir;
    if (j < 0 || j >= prev.length) return prev;
    const next = [...prev];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  // Build a strict TemplateDefinition, round-tripping the original section
  // objects (mutate only what changed — §9) so backend-added fields survive.
  const buildDefinition = () => {
    const byId = new Map((originalDef.sections || []).map((s) => [s.id, s]));
    const builtSections = sections.map((s, i) => {
      const base = s._origId && byId.has(s._origId) ? { ...byId.get(s._origId) } : {};
      const out = {
        ...base,
        id: s.id.trim(),
        name: s.name.trim(),
        voice_aliases: parseAliases(s.voice_aliases),
        required: !!s.required,
        field_type: s.field_type,
        asr_prompt: s.asr_prompt || "",
        min_chars: Number(s.min_chars) || 0,
        order: i,
      };
      if (s.synthesis_prompt.trim()) out.synthesis_prompt = s.synthesis_prompt.trim();
      else delete out.synthesis_prompt;
      if (s.default_content.trim()) out.default_content = s.default_content.trim();
      else delete out.default_content;
      if (CHOICE_FIELD_TYPES.includes(s.field_type)) out.options = buildOptions(s, base.options || []);
      else delete out.options;
      return out;
    });
    const def = {
      ...originalDef,
      code: code.trim(),
      name: name.trim(),
      language,
      specialty: specialty.trim(),
      schema_version: originalDef.schema_version ?? 1,
      sections: builtSections,
    };
    const metaOut = {};
    if (meta.moh_order_ref.trim()) metaOut.moh_order_ref = meta.moh_order_ref.trim();
    if (meta.billing_code.trim())  metaOut.billing_code  = meta.billing_code.trim();
    if (meta.fhir_template.trim()) metaOut.fhir_template = meta.fhir_template.trim();
    if (Object.keys(metaOut).length) def.metadata = metaOut;
    else delete def.metadata;
    return def;
  };

  const validation = useMemo(() => {
    // Validate against a lightweight projection (name strings etc.).
    const projected = {
      code: code.trim(),
      sections: sections.map((s) => ({
        id: s.id.trim(), name: s.name, field_type: s.field_type,
        asr_prompt: s.asr_prompt, synthesis_prompt: s.synthesis_prompt,
        voice_aliases: parseAliases(s.voice_aliases),
        options: CHOICE_FIELD_TYPES.includes(s.field_type) ? buildOptions(s) : [],
      })),
    };
    return validateDefinition(projected, lang);
  }, [code, sections, lang]);

  const doSave = async (def) => {
    setBusy(true); setError(null);
    try {
      const res = creating ? await createTemplate(def) : await updateTemplate(detail.id, def);
      onSaved(res);
    } catch (e) {
      setError(e);
      setBusy(false);
      setConfirmStructural(null);
    }
  };

  // The definition-level validator doesn't cover `name` (the backend does);
  // block the obvious empty-name save here so it never round-trips.
  const nameMissing = !name.trim();
  const canSave = validation.ok && !nameMissing && !busy;

  const onSaveClick = () => {
    if (!canSave) return;
    const def = buildDefinition();
    if (creating) {          // nothing to version against yet
      doSave(def);
      return;
    }
    const { kind } = classifyEditDetailed(originalDef, def);
    if (kind === "structural") {
      setConfirmStructural(def);   // gate behind the new-version warning
    } else {
      doSave(def);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="tpl-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tpl-modal-head">
          <div>
            <h2>{creating
              ? T(lang, "Новий шаблон", "New template")
              : T(lang, "Редагувати шаблон", "Edit template")}</h2>
            <p>{creating
              ? T(lang, "Створюється у вашій клініці зі статусом «чернетка»",
                        "Created in your tenant with status “draft”")
              : T(lang, "Зміни структури створюють нову версію",
                        "Structural changes create a new version")}</p>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>

        <div className="tpl-modal-body">
          {!creating && liveEdit && liveEdit.kind !== "no_change" && (
            <div
              className={"tpl-live-banner " + liveEdit.kind}
              role="status"
              data-testid="edit-kind-banner"
              data-kind={liveEdit.kind}
            >
              <Icon name={liveEdit.kind === "structural" ? "alert" : "check"} size={14} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>
                  {liveEdit.kind === "structural"
                    ? T(lang, "СТРУКТУРНА зміна — буде створено нову версію шаблону",
                              "STRUCTURAL change — a new template version will be created")
                    : T(lang, "Косметична зміна — версія не зміниться",
                              "Cosmetic change — the version stays")}
                </div>
                {liveEdit.kind === "structural" && (
                  <>
                    <ul className="tpl-live-reasons">
                      {liveEdit.reasons.map((r, i) => (
                        <li key={i}>{formatEditReason(r, lang)}</li>
                      ))}
                    </ul>
                    <div className="psub" style={{ fontSize: 11 }}>
                      {T(lang, "Наявні звіти продовжать використовувати стару версію.",
                                "Existing reports keep using the old version.")}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          <div className="tpl-build-row two">
            <label className="tpl-field">
              <span>{T(lang, "Назва", "Name")}</span>
              <input className="ti" value={name} onChange={(e) => setName(e.target.value)}
                placeholder={T(lang, "Напр. Кардіологічний огляд", "e.g. Cardiology consult")} />
              {nameMissing && <span className="tpl-inline-err">{T(lang, "Назва обов'язкова", "Name is required")}</span>}
            </label>
            <label className="tpl-field">
              <span>{T(lang, "Код", "Code")}</span>
              <input className="ti mono" value={code} onChange={(e) => setCode(e.target.value)}
                placeholder="cardiology_consult" />
              {validation.errors.code && <span className="tpl-inline-err">{validation.errors.code}</span>}
            </label>
          </div>
          <div className="tpl-build-row two">
            <label className="tpl-field">
              <span>{T(lang, "Мова", "Language")}</span>
              <select className="ti" value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="uk">{T(lang, "Українська", "Ukrainian")}</option>
                <option value="en">{T(lang, "Англійська", "English")}</option>
              </select>
            </label>
            <label className="tpl-field">
              <span>{T(lang, "Спеціальність", "Specialty")}</span>
              <input className="ti mono" value={specialty} list="tpl-specialties"
                onChange={(e) => setSpecialty(e.target.value)} placeholder="family_medicine" />
              <datalist id="tpl-specialties">
                {SPECIALTIES.map(([v, uk, en]) => (
                  <option key={v} value={v}>{T(lang, uk, en)}</option>
                ))}
              </datalist>
            </label>
          </div>

          {/* Sections */}
          <div className="tpl-build-sections-head">
            <span className="tpl-build-label" style={{ margin: 0 }}>
              {T(lang, "Секції", "Sections")} <span className="psub">{sections.length}/{MAX_SECTIONS}</span>
            </span>
            <button className="btn ghost sm" type="button" onClick={addSection}
              disabled={sections.length >= MAX_SECTIONS}>
              <Icon name="plus" size={12} /> {T(lang, "Додати секцію", "Add section")}
            </button>
          </div>
          {validation.errors.sections && <span className="tpl-inline-err">{validation.errors.sections}</span>}

          <div className="tpl-edit-sections">
            {sections.map((s, i) => (
              <SectionEditor
                key={i} s={s} idx={i} lang={lang} errors={validation.errors}
                count={sections.length}
                onChange={(k, v) => setSection(i, k, v)}
                onOptionChange={(oi, k, v) => setOption(i, oi, k, v)}
                onAddOption={() => addOption(i)}
                onRemoveOption={(oi) => removeOption(i, oi)}
                onRemove={() => removeSection(i)}
                onUp={() => move(i, -1)} onDown={() => move(i, 1)}
              />
            ))}
          </div>

          {/* Metadata */}
          <div className="rail-h" style={{ padding: "14px 0 6px", fontSize: 11 }}>
            {T(lang, "МЕТАДАНІ (необов'язково)", "METADATA (optional)")}
          </div>
          <div className="tpl-build-row" style={{ display: "grid", gap: 8 }}>
            {[["moh_order_ref", "MoH order ref"], ["billing_code", "Billing code"], ["fhir_template", "FHIR template"]].map(([k, label]) => (
              <label key={k} className="tpl-field">
                <span>{label}</span>
                <input className="ti mono" value={meta[k]}
                  onChange={(e) => setMeta((m) => ({ ...m, [k]: e.target.value }))} />
              </label>
            ))}
          </div>

          <ErrorBanner error={error} lang={lang} context="edit" />
        </div>

        <div className="tpl-modal-foot">
          <button className="btn" onClick={onClose} disabled={busy}>{T(lang, "Скасувати", "Cancel")}</button>
          <div style={{ flex: 1 }} />
          <button className="btn accent" onClick={onSaveClick} disabled={!canSave}>
            <Icon name="save" size={13} />
            {busy
              ? T(lang, "Збереження…", "Saving…")
              : creating ? T(lang, "Створити шаблон", "Create template") : T(lang, "Зберегти", "Save")}
          </button>
        </div>

        {/* Structural-change warning (§2.4) */}
        {confirmStructural && (
          <div className="modal-overlay" onClick={() => setConfirmStructural(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-h">
                <h2>{T(lang, "Структурна зміна", "Structural change")}</h2>
                <p>{T(lang,
                  "Це структурна зміна — вона створює нову версію шаблону. Наявні звіти продовжать використовувати стару версію.",
                  "This is a structural change — it creates a new template version. Existing reports keep using the old version.")}</p>
              </div>
              <div className="modal-foot">
                <button className="btn" onClick={() => setConfirmStructural(null)} disabled={busy}>
                  {T(lang, "Скасувати", "Cancel")}
                </button>
                <button className="btn accent" onClick={() => doSave(confirmStructural)} disabled={busy}>
                  {busy ? T(lang, "Збереження…", "Saving…") : T(lang, "Створити нову версію", "Create new version")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionEditor({
  s, idx, lang, errors, count, onChange,
  onOptionChange, onAddOption, onRemoveOption, onRemove, onUp, onDown,
}) {
  const e = (k) => errors[`sec.${idx}.${k}`];
  const asrLen = s.asr_prompt.length;
  const synLen = s.synthesis_prompt.length;
  const hasOptions = CHOICE_FIELD_TYPES.includes(s.field_type);
  return (
    <div className="tpl-edit-section">
      <div className="tpl-edit-section-head">
        <div className="tpl-sec-num">{idx + 1}</div>
        <input className="ti" style={{ flex: 1 }} placeholder={T(lang, "Назва секції", "Section name")}
          value={s.name} onChange={(ev) => onChange("name", ev.target.value)} />
        <div className="tpl-sec-move">
          <button className="iconbtn" type="button" onClick={onUp} disabled={idx === 0} aria-label="Up"><Icon name="moreV" size={13} /></button>
          <button className="iconbtn" type="button" onClick={onDown} disabled={idx === count - 1} aria-label="Down"><Icon name="moreV" size={13} /></button>
        </div>
        <button className="iconbtn danger" type="button" onClick={onRemove} disabled={count <= 1} aria-label="Remove">
          <Icon name="x" size={13} />
        </button>
      </div>
      {e("name") && <span className="tpl-inline-err">{e("name")}</span>}

      <div className="tpl-build-row two">
        <label className="tpl-field">
          <span>{T(lang, "ID (slug)", "ID (slug)")}</span>
          <input className="ti mono" value={s.id} onChange={(ev) => onChange("id", ev.target.value)} />
          {e("id") && <span className="tpl-inline-err">{e("id")}</span>}
        </label>
        <label className="tpl-field">
          <span>{T(lang, "Тип поля", "Field type")}</span>
          <select className="ti" value={s.field_type} onChange={(ev) => onChange("field_type", ev.target.value)}>
            {FIELD_TYPES.map((ft) => (
              <option key={ft} value={ft}>
                {FIELD_TYPE_LABELS[ft] ? T(lang, FIELD_TYPE_LABELS[ft][0], FIELD_TYPE_LABELS[ft][1]) : ft}
              </option>
            ))}
          </select>
        </label>
      </div>

      {hasOptions && (
        <div className="tpl-opt-block">
          <div className="tpl-build-sections-head">
            <span className="tpl-build-label" style={{ margin: 0 }}>
              {T(lang, "Варіанти", "Options")}{" "}
              <span className="psub">{s.options.length}/{MAX_OPTIONS}</span>
            </span>
            <button className="btn ghost sm" type="button" onClick={onAddOption}
              disabled={s.options.length >= MAX_OPTIONS}>
              <Icon name="plus" size={12} /> {T(lang, "Додати варіант", "Add option")}
            </button>
          </div>
          {s.options.map((o, oi) => (
            <div key={oi} className="tpl-opt-row">
              <input className="ti mono" value={o.value} placeholder={T(lang, "значення (slug)", "value (slug)")}
                onChange={(ev) => onOptionChange(oi, "value", ev.target.value)} />
              <input className="ti" value={o.label} placeholder={T(lang, "Підпис", "Label")}
                onChange={(ev) => onOptionChange(oi, "label", ev.target.value)} />
              <input className="ti" value={o.voice_aliases}
                placeholder={T(lang, "голосові псевдоніми", "voice aliases")}
                onChange={(ev) => onOptionChange(oi, "voice_aliases", ev.target.value)} />
              <button className="iconbtn danger" type="button" onClick={() => onRemoveOption(oi)}
                disabled={s.options.length <= MIN_OPTIONS} aria-label={T(lang, "Видалити варіант", "Remove option")}>
                <Icon name="x" size={13} />
              </button>
            </div>
          ))}
          {e("options") && <span className="tpl-inline-err">{e("options")}</span>}
        </div>
      )}

      <div className="tpl-build-row two" style={{ alignItems: "center" }}>
        <label className="tpl-sec-req">
          <input type="checkbox" checked={s.required} onChange={(ev) => onChange("required", ev.target.checked)} />
          <span>{T(lang, "Обов'язкова", "Required")}</span>
        </label>
        <label className="tpl-field">
          <span>{T(lang, "Мін. символів", "Min chars")}</span>
          <input className="ti" type="number" min={0} value={s.min_chars}
            onChange={(ev) => onChange("min_chars", ev.target.value)} />
        </label>
      </div>

      <label className="tpl-field">
        <span>{T(lang, "Голосові псевдоніми (через кому)", "Voice aliases (comma-separated)")}</span>
        <input className="ti" value={s.voice_aliases} onChange={(ev) => onChange("voice_aliases", ev.target.value)}
          placeholder={T(lang, "скарги, розділ скарги", "complaints, section complaints")} />
        {e("voice_aliases") && <span className="tpl-inline-err">{e("voice_aliases")}</span>}
      </label>

      <label className="tpl-field">
        <span className="tpl-field-head">
          {T(lang, "ASR-підказка", "ASR prompt")}
          <span className={`tpl-meter${asrLen > ASR_PROMPT_MAX ? " over" : ""}`}>{asrLen}/{ASR_PROMPT_MAX}</span>
        </span>
        <textarea className="ti" rows={2} value={s.asr_prompt}
          onChange={(ev) => onChange("asr_prompt", ev.target.value)} />
        {e("asr_prompt") && <span className="tpl-inline-err">{e("asr_prompt")}</span>}
      </label>

      <label className="tpl-field">
        <span className="tpl-field-head">
          {T(lang, "Synthesis-підказка (необов'язково)", "Synthesis prompt (optional)")}
          <span className={`tpl-meter${synLen > SYNTHESIS_PROMPT_MAX ? " over" : ""}`}>{synLen}/{SYNTHESIS_PROMPT_MAX}</span>
        </span>
        <textarea className="ti" rows={2} value={s.synthesis_prompt}
          onChange={(ev) => onChange("synthesis_prompt", ev.target.value)} />
        {e("synthesis_prompt") && <span className="tpl-inline-err">{e("synthesis_prompt")}</span>}
      </label>

      <label className="tpl-field">
        <span>{T(lang, "Типовий вміст (необов'язково)", "Default content (optional)")}</span>
        <textarea className="ti" rows={2} value={s.default_content}
          onChange={(ev) => onChange("default_content", ev.target.value)} />
      </label>
    </div>
  );
}
