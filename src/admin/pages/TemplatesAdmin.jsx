// TemplatesAdmin.jsx — /admin/templates (sprint 17).
//
// The tenant's template operations surface. The clinician-facing library at
// /library/reports stays what it was (browse/star/clone); THIS page is where
// a tenant_admin runs the lifecycle: filterable list across every status,
// a full-page detail with lineage, the live cosmetic/structural banner in the
// editor (via TemplateFormModal), deprecation with its consequence named, and
// the sprint-06→17 promise: RE-BIND — moving the draft reports that block a
// deprecation onto a successor template, one confirmed draft at a time.
//
// Machinery is REUSED from components/TemplatesPage.jsx (TemplateFormModal,
// CloneModal, badges, SectionRow) — one editor, two homes, no fork.
import React, { useEffect, useMemo, useState } from "react";
import { Icon, Empty } from "../../components/UI.jsx";
import { Loading, asList } from "../../components/DataStates.jsx";
import { ApiErrorView } from "../../components/ApiErrorView.jsx";
import { MenuSelect } from "../../components/MenuSelect.jsx";
import { Pagination } from "../../components/Pagination.jsx";
import { ConfirmDialog } from "../ConfirmDialog.jsx";
import { useAsync } from "../../api/useAsync.js";
import { isMfaEnrolmentRequired } from "../../auth/mfaGrace.js";
import {
  listTemplates, getTemplate, deleteTemplate, listBoundReports, rebindReport,
  rebindErrorMessage, specialtyIcon,
} from "../../api/templates.js";
import {
  TemplateFormModal, CloneModal, OriginBadge, SectionRow, SPECIALTIES,
} from "../../components/TemplatesPage.jsx";
import { tr } from "../../i18n.js";

const T = (lang, uk, en) => tr(lang, uk, en);
const PAGE_SIZES = [25, 50, 100];
const LIST_LIMIT = 200; // the endpoint's max — a fuller page means "narrow the filters"

const shortId = (id) => String(id || "").slice(0, 8);
const fmtDate = (iso, lang) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(lang === "uk" ? "uk-UA" : "en-GB", {
      year: "numeric", month: "2-digit", day: "2-digit",
    });
  } catch {
    return String(iso).slice(0, 10);
  }
};

// The admin table states every status explicitly (the library's badge hides
// "active" because it is the default there; an ops list has no default).
function AdmStatusChip({ status, lang }) {
  const map = {
    active:     ["chip-ok",   "активний",       "active"],
    draft:      ["",          "чернетка",       "draft"],
    deprecated: ["chip-warn", "депрекований",   "deprecated"],
  };
  const row = map[status] || ["", status, status];
  return <span className={"chip " + row[0]} data-status={status}>{T(lang, row[1], row[2])}</span>;
}

// The MFA-grace silencer (same contract as UsersAdmin): the fetch client has
// already routed to enrolment; that error must not paint a red box.
const surface = (err, set) => { if (!isMfaEnrolmentRequired(err)) set(err); };

export function TemplatesAdmin({ subPath = "", lang = "uk", navigate, onToast }) {
  const [toast, setToast] = useState(null);
  const fireToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };
  const id = subPath && subPath !== "/" ? decodeURIComponent(subPath.replace(/^\//, "")) : null;
  return (
    <div data-testid="templates-admin">
      {id
        ? <TemplateAdminDetail id={id} lang={lang} navigate={navigate} fireToast={fireToast} />
        : <TemplateAdminList lang={lang} navigate={navigate} fireToast={fireToast} />}
      {toast && <div className="tpl-toast" role="status">{toast}</div>}
    </div>
  );
}

// ── List ────────────────────────────────────────────────────────────────────
function TemplateAdminList({ lang, navigate, fireToast }) {
  const [specialty, setSpecialty] = useState("");
  const [language, setLanguage]   = useState("");
  const [status, setStatus]       = useState("");
  const [origin, setOrigin]       = useState("");
  const [search, setSearch]       = useState("");
  const [page, setPage]           = useState(1);
  const [pageSize, setPageSize]   = useState(PAGE_SIZES[0]);
  const [creating, setCreating]   = useState(false);

  // Admin always sees the whole lifecycle: deprecated rows are data here, not
  // clutter, so include_deprecated is unconditional and status filters locally.
  const req = useAsync(
    () => listTemplates({
      specialty: specialty || undefined,
      language: language || undefined,
      include_deprecated: true,
      limit: LIST_LIMIT,
    }),
    [specialty, language],
  );

  const all = asList(req.data);
  const rows = useMemo(() => {
    let out = all;
    if (status) out = out.filter((t) => t.status === status);
    if (origin === "system") out = out.filter((t) => t.is_system || t.tenant_id == null);
    if (origin === "tenant") out = out.filter((t) => !(t.is_system || t.tenant_id == null));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter((t) =>
        `${t.name || ""} ${t.code || ""} ${t.specialty || ""}`.toLowerCase().includes(q));
    }
    return out;
  }, [all, status, origin, search]);

  useEffect(() => { setPage(1); }, [specialty, language, status, origin, search]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageItems = rows.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <>
      <div className="admt-head">
        <div>
          <h1>{T(lang, "Шаблони", "Templates")}</h1>
          <p className="sub">
            {T(lang,
              "Життєвий цикл шаблонів клініки: клонування, редагування, версії, депрекація, переприв'язування.",
              "The clinic's template lifecycle: clone, edit, versions, deprecation, re-bind.")}
          </p>
        </div>
        <button type="button" className="btn accent" onClick={() => setCreating(true)}
                data-testid="admt-new">
          <Icon name="plus" size={13} /> {T(lang, "Новий шаблон", "New template")}
        </button>
      </div>

      <div className="ptable-toolbar admt-toolbar">
        <label className="search-input">
          <Icon name="search" size={14} />
          <input placeholder={T(lang, "Пошук: назва, код, спеціальність…", "Search: name, code, specialty…")}
                 value={search} onChange={(e) => setSearch(e.target.value)}
                 data-testid="admt-search" />
        </label>
        <MenuSelect
          icon="filter" value={specialty} onChange={setSpecialty}
          ariaLabel={T(lang, "Спеціальність", "Specialty")}
          options={[
            { value: "", label: T(lang, "Всі спеціальності", "All specialties") },
            ...[...SPECIALTIES]
              .map(([v, uk, en]) => ({ value: v, label: T(lang, uk, en) }))
              .sort((a, b) => a.label.localeCompare(b.label)),
          ]}
        />
        <MenuSelect
          icon="flag" value={language} onChange={setLanguage}
          ariaLabel={T(lang, "Мова", "Language")}
          options={[
            { value: "", label: T(lang, "Всі мови", "All languages") },
            { value: "uk", label: T(lang, "Українська", "Ukrainian") },
            { value: "en", label: T(lang, "Англійська", "English") },
          ]}
        />
        <MenuSelect
          icon="layers" value={status} onChange={setStatus}
          ariaLabel={T(lang, "Статус", "Status")}
          options={[
            { value: "", label: T(lang, "Всі статуси", "All statuses") },
            { value: "active", label: T(lang, "Активні", "Active") },
            { value: "draft", label: T(lang, "Чернетки", "Drafts") },
            { value: "deprecated", label: T(lang, "Депрековані", "Deprecated") },
          ]}
        />
        <MenuSelect
          icon="building" value={origin} onChange={setOrigin}
          ariaLabel={T(lang, "Походження", "Origin")}
          options={[
            { value: "", label: T(lang, "Всі", "All") },
            { value: "system", label: T(lang, "Системні", "System") },
            { value: "tenant", label: T(lang, "Власні", "Tenant") },
          ]}
        />
      </div>

      {all.length === LIST_LIMIT && (
        <div className="admt-limit-note" role="note">
          {T(lang,
            `Показано перші ${LIST_LIMIT} — звузьте фільтри, щоб побачити решту.`,
            `Showing the first ${LIST_LIMIT} — narrow the filters to see the rest.`)}
        </div>
      )}

      {req.loading ? (
        <Loading lang={lang} />
      ) : req.error ? (
        <ApiErrorView error={req.error} lang={lang} onRetry={req.reload} />
      ) : rows.length === 0 ? (
        <Empty icon="layers"
               title={T(lang, "Шаблонів не знайдено", "No templates found")}
               body={T(lang, "Спробуйте змінити фільтри.", "Try adjusting the filters.")} />
      ) : (
        <>
          <div className="admt-table" data-testid="admt-table">
            <div className="admt-thead">
              <span>{T(lang, "Назва", "Name")}</span>
              <span>{T(lang, "Код", "Code")}</span>
              <span>{T(lang, "Мова", "Lang")}</span>
              <span>{T(lang, "Версія", "Ver.")}</span>
              <span>{T(lang, "Походження", "Origin")}</span>
              <span>{T(lang, "Статус", "Status")}</span>
              <span>{T(lang, "Оновлено", "Updated")}</span>
              <span>{T(lang, "Лінія", "Lineage")}</span>
            </div>
            {pageItems.map((tpl) => (
              <div key={tpl.id} className="admt-trow" role="button" tabIndex={0}
                   data-testid={`admt-row-${tpl.code}`}
                   onClick={() => navigate(`/admin/templates/${tpl.id}`)}
                   onKeyDown={(e) => {
                     if (e.key === "Enter" || e.key === " ") {
                       e.preventDefault();
                       navigate(`/admin/templates/${tpl.id}`);
                     }
                   }}>
                <span className="admt-name">
                  <Icon name={specialtyIcon(tpl.specialty)} size={14} />
                  <span>{tpl.name}</span>
                </span>
                <span className="admt-mut"><code>{tpl.code}</code></span>
                <span className="admt-mut">{(tpl.language || "").toUpperCase()}</span>
                <span className="admt-mut">v{tpl.schema_version}</span>
                <span><OriginBadge tpl={tpl} lang={lang} /></span>
                <span><AdmStatusChip status={tpl.status} lang={lang} /></span>
                <span className="admt-mut">{fmtDate(tpl.updated_at, lang)}</span>
                <span>
                  {tpl.parent_template_id ? (
                    <button type="button" className="admt-lineage"
                            title={T(lang, "Відкрити шаблон-предок", "Open the ancestor template")}
                            data-testid={`admt-lineage-${tpl.code}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/admin/templates/${tpl.parent_template_id}`);
                            }}>
                      <Icon name="diff" size={12} /> {shortId(tpl.parent_template_id)}
                    </button>
                  ) : <span className="admt-mut">—</span>}
                </span>
              </div>
            ))}
          </div>
          <Pagination
            page={safePage} pageCount={pageCount} onPage={setPage}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(pageCount, p + 1))}
            total={rows.length} pageSize={pageSize} pageSizeOptions={PAGE_SIZES}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
            lang={lang}
          />
        </>
      )}

      {creating && (
        <TemplateFormModal
          lang={lang}
          onClose={() => setCreating(false)}
          onSaved={(res) => {
            setCreating(false);
            fireToast(T(lang, "Шаблон створено", "Template created"));
            if (res?.id) navigate(`/admin/templates/${res.id}`);
          }}
        />
      )}
    </>
  );
}

// ── Detail ──────────────────────────────────────────────────────────────────
function TemplateAdminDetail({ id, lang, navigate, fireToast }) {
  const req = useAsync(() => getTemplate(id), [id]);
  const [editing, setEditing]       = useState(false);
  const [cloning, setCloning]       = useState(false);
  const [confirmDep, setConfirmDep] = useState(false);
  const [depBusy, setDepBusy]       = useState(false);
  const [depError, setDepError]     = useState(null);
  // Set when a deprecate attempt 409'd: the panel below is now the way out.
  const [rebindNotice, setRebindNotice] = useState(false);
  const [boundEpoch, setBoundEpoch] = useState(0);

  const tpl = req.data;
  const system = tpl ? (tpl.is_system || tpl.tenant_id == null) : false;
  const sections = useMemo(
    () => (tpl?.schema_jsonb?.sections || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [tpl],
  );

  const deprecate = async () => {
    setDepBusy(true); setDepError(null);
    try {
      await deleteTemplate(id);
      setConfirmDep(false);
      setRebindNotice(false);
      req.reload();
      fireToast(T(lang, "Шаблон знято з використання", "Template deprecated"));
    } catch (e) {
      if (e?.status === 409) {
        // Draft reports block the deprecation — the re-bind panel is the fix.
        setConfirmDep(false);
        setRebindNotice(true);
        setBoundEpoch((n) => n + 1); // refresh the panel's listing
      } else {
        surface(e, setDepError);
      }
    } finally {
      setDepBusy(false);
    }
  };

  return (
    <div data-testid="template-admin-detail">
      <button type="button" className="btn ghost sm admt-back"
              onClick={() => navigate("/admin/templates")} data-testid="admt-back">
        <Icon name="arrowLeft" size={13} /> {T(lang, "Шаблони", "Templates")}
      </button>

      {req.loading ? (
        <Loading lang={lang} />
      ) : req.error ? (
        <ApiErrorView error={req.error} lang={lang} onRetry={req.reload} />
      ) : !tpl ? (
        <Empty icon="layers" title={T(lang, "Шаблон не знайдено", "Template not found")} />
      ) : (
        <>
          <div className="admt-detail-head">
            <div className="tpl-card-icon"><Icon name={specialtyIcon(tpl.specialty)} size={18} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1>{tpl.name}</h1>
              <div className="admt-detail-meta">
                <span className="chip"><code>{tpl.code}</code></span>
                <OriginBadge tpl={tpl} lang={lang} />
                <span className="chip">{(tpl.language || "").toUpperCase()}</span>
                <span className="chip">v{tpl.schema_version}</span>
                <AdmStatusChip status={tpl.status} lang={lang} />
                {tpl.parent_template_id && (
                  <button type="button" className="admt-lineage"
                          data-testid="admt-parent-link"
                          onClick={() => navigate(`/admin/templates/${tpl.parent_template_id}`)}>
                    <Icon name="diff" size={12} />
                    {T(lang, "створено з", "derived from")} {shortId(tpl.parent_template_id)}
                  </button>
                )}
                <span className="admt-mut">
                  {T(lang, "оновлено", "updated")} {fmtDate(tpl.updated_at, lang)}
                </span>
              </div>
            </div>
            <div className="admt-actions">
              {system ? (
                <button type="button" className="btn accent" onClick={() => setCloning(true)}
                        data-testid="admt-clone">
                  <Icon name="layers" size={13} /> {T(lang, "Клонувати", "Clone")}
                </button>
              ) : tpl.status !== "deprecated" ? (
                <>
                  <button type="button" className="btn btn-danger" onClick={() => setConfirmDep(true)}
                          data-testid="admt-deprecate">
                    <Icon name="archive" size={13} /> {T(lang, "Депрекувати", "Deprecate")}
                  </button>
                  <button type="button" className="btn accent" onClick={() => setEditing(true)}
                          data-testid="admt-edit">
                    <Icon name="edit" size={13} /> {T(lang, "Редагувати", "Edit")}
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {rebindNotice && tpl.status !== "deprecated" && (
            <div className="admt-rebind-notice" role="alert" data-testid="admt-rebind-notice">
              <Icon name="alert" size={14} />
              {T(lang,
                "Депрекацію заблоковано: до шаблону прив'язані чернетки звітів. Переприв'яжіть їх до шаблону-наступника нижче й повторіть.",
                "Deprecation blocked: draft reports are bound to this template. Re-bind them to a successor below and retry.")}
            </div>
          )}

          <div className="rail-h admt-sec-h">{T(lang, "СЕКЦІЇ", "SECTIONS")} · {sections.length}</div>
          <div className="tpl-detail-sections">
            {sections.map((s, i) => (
              <SectionRow key={s.id || i} s={s} idx={i} lang={lang} templateId={tpl.id} />
            ))}
          </div>

          <BoundReportsPanel
            tpl={tpl} lang={lang} epoch={boundEpoch}
            highlighted={rebindNotice}
            fireToast={fireToast}
            onRetryDeprecate={tpl.status !== "deprecated" ? deprecate : null}
          />

          {editing && (
            <TemplateFormModal
              detail={tpl} lang={lang}
              onClose={() => setEditing(false)}
              onSaved={(res) => {
                setEditing(false);
                if (res?.kind === "structural" && res.id) {
                  fireToast(T(lang, "Створено нову версію шаблону", "New template version created"));
                  navigate(`/admin/templates/${res.id}`);
                } else if (res?.kind === "cosmetic") {
                  fireToast(T(lang, "Зміни збережено", "Changes saved"));
                  req.reload();
                } else {
                  fireToast(T(lang, "Без змін", "No changes"));
                }
              }}
            />
          )}

          {cloning && (
            <CloneModal
              source={tpl} lang={lang}
              onClose={() => setCloning(false)}
              onCloned={(newId) => {
                setCloning(false);
                fireToast(T(lang, "Шаблон клоновано", "Template cloned"));
                if (newId) navigate(`/admin/templates/${newId}`);
              }}
            />
          )}

          {confirmDep && (
            <ConfirmDialog
              lang={lang} danger testId="deprecate-dialog"
              title={T(lang, "Зняти шаблон з використання?", "Deprecate this template?")}
              consequence={T(lang,
                "Знятий з використання шаблон зникає з вибору для нових звітів; наявні звіти зберігають його.",
                "A deprecated template disappears from the picker for new reports; existing reports keep it.")}
              confirmLabel={T(lang, "Депрекувати", "Deprecate")}
              busy={depBusy}
              error={depError ? <ApiErrorView error={depError} lang={lang} /> : null}
              onCancel={() => { setConfirmDep(false); setDepError(null); }}
              onConfirm={deprecate}
            >
              <div className="admt-dep-target">
                <Icon name={specialtyIcon(tpl.specialty)} size={14} />
                <b>{tpl.name}</b> <code>{tpl.code}</code> v{tpl.schema_version}
              </div>
            </ConfirmDialog>
          )}
        </>
      )}
    </div>
  );
}

// ── Bound reports / re-bind ────────────────────────────────────────────────
// The sprint-06 promise, kept: for a template (deprecated or blocked from
// deprecation), list the reports still bound to it — PHI-free: ids, statuses,
// dates — and move each DRAFT to a successor. Finalized/signed/amended rows
// are context, not work: they keep their template forever, by design.
function BoundReportsPanel({ tpl, lang, epoch, highlighted, fireToast, onRetryDeprecate }) {
  const req = useAsync(() => listBoundReports(tpl.id), [tpl.id, epoch]);
  const candReq = useAsync(
    () => listTemplates({ language: tpl.language, include_deprecated: false, limit: LIST_LIMIT }),
    [tpl.id],
  );
  const [successor, setSuccessor] = useState("");
  const [confirmFor, setConfirmFor] = useState(null); // the draft row being re-bound
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [retryBusy, setRetryBusy] = useState(false);

  const rows = asList(req.data);
  const drafts = rows.filter((r) => r.status === "draft");
  const kept = rows.filter((r) => r.status !== "draft");

  const candidates = asList(candReq.data)
    .filter((t) => t.id !== tpl.id && t.status !== "deprecated");
  const successorTpl = candidates.find((t) => t.id === successor) || null;

  const doRebind = async () => {
    if (!confirmFor || !successor) return;
    setBusy(true); setError(null);
    try {
      await rebindReport(tpl.id, { report_id: confirmFor.report_id, to_template_id: successor });
      setConfirmFor(null);
      req.reload();
      fireToast(T(lang, "Звіт переприв'язано", "Report re-bound"));
    } catch (e) {
      if (!isMfaEnrolmentRequired(e)) setError(rebindErrorMessage(e, lang));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={"admt-bound" + (highlighted ? " highlighted" : "")} data-testid="rebind-panel">
      <div className="rail-h admt-sec-h">
        {T(lang, "ПРИВ'ЯЗАНІ ЗВІТИ", "BOUND REPORTS")}
        {!req.loading && !req.error && ` · ${rows.length}`}
      </div>

      {req.loading ? (
        <Loading lang={lang} />
      ) : req.error ? (
        <ApiErrorView error={req.error} lang={lang} onRetry={req.reload} />
      ) : rows.length === 0 ? (
        <div className="admt-bound-empty" data-testid="rebind-empty">
          {T(lang, "Жоден звіт не використовує цей шаблон.", "No report uses this template.")}
          {onRetryDeprecate && highlighted && (
            <button type="button" className="btn accent sm" onClick={onRetryDeprecate}
                    data-testid="rebind-retry-deprecate">
              <Icon name="archive" size={12} /> {T(lang, "Повторити зняття з використання", "Retry deprecation")}
            </button>
          )}
        </div>
      ) : (
        <>
          {drafts.length > 0 && (
            <>
              <div className="admt-bound-toolbar">
                <span className="admt-bound-count">
                  {T(lang,
                    `Чернеток: ${drafts.length} — блокують депрекацію`,
                    `${drafts.length} draft(s) — they block deprecation`)}
                </span>
                <MenuSelect
                  icon="fileText" block value={successor} onChange={setSuccessor}
                  ariaLabel={T(lang, "Шаблон-наступник", "Successor template")}
                  options={[
                    { value: "", label: T(lang, "Оберіть шаблон-наступник…", "Choose a successor template…") },
                    ...candidates.map((t) => ({
                      value: t.id,
                      label: `${t.name} · ${t.code} · v${t.schema_version}`,
                      sub: t.status === "draft" ? T(lang, "чернетка", "draft") : undefined,
                    })),
                  ]}
                />
              </div>
              <div className="admt-bound-rows">
                {drafts.map((r) => (
                  <div key={r.report_id} className="admt-bound-row" data-testid="rebind-row">
                    <span className="chip">{T(lang, "чернетка", "draft")}</span>
                    <code title={r.report_id}>{shortId(r.report_id)}</code>
                    <span className="admt-mut">
                      {T(lang, "створено", "created")} {fmtDate(r.created_at, lang)}
                      {" · "}
                      {T(lang, "змінено", "updated")} {fmtDate(r.updated_at, lang)}
                    </span>
                    <span style={{ flex: 1 }} />
                    <button type="button" className="btn sm accent"
                            disabled={!successor}
                            title={!successor ? T(lang, "Спершу оберіть наступника", "Choose a successor first") : undefined}
                            onClick={() => { setError(null); setConfirmFor(r); }}
                            data-testid={`rebind-action-${shortId(r.report_id)}`}>
                      <Icon name="arrowRight" size={12} /> {T(lang, "Переприв'язати", "Re-bind")}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {kept.length > 0 && (
            <div className="admt-bound-kept" data-testid="rebind-kept">
              <Icon name="info" size={13} />
              {T(lang,
                `Ще ${kept.length} звіт(ів) у статусах «фіналізований», «підписаний» чи «скасований» зберігають цей шаблон назавжди — їх переприв'язати не можна.`,
                `${kept.length} more report(s) in finalized/signed/cancelled states keep this template forever — they cannot be re-bound.`)}
            </div>
          )}

          {drafts.length === 0 && onRetryDeprecate && highlighted && (
            <div className="admt-bound-empty">
              {T(lang, "Чернеток не залишилося.", "No drafts remain.")}
              <button type="button" className="btn accent sm" onClick={async () => {
                setRetryBusy(true);
                try { await onRetryDeprecate(); } finally { setRetryBusy(false); }
              }} disabled={retryBusy} data-testid="rebind-retry-deprecate">
                <Icon name="archive" size={12} /> {T(lang, "Повторити зняття з використання", "Retry deprecation")}
              </button>
            </div>
          )}
        </>
      )}

      {confirmFor && (
        <ConfirmDialog
          lang={lang} testId="rebind-dialog"
          title={T(lang, "Переприв'язати чернетку?", "Re-bind this draft?")}
          consequence={T(lang,
            `Чернетка ${shortId(confirmFor.report_id)} використовуватиме структуру шаблону «${successorTpl?.name || ""}» (v${successorTpl?.schema_version ?? "?"}). Вміст секцій не змінюється; фіналізованих звітів це не стосується.`,
            `Draft ${shortId(confirmFor.report_id)} will use the structure of "${successorTpl?.name || ""}" (v${successorTpl?.schema_version ?? "?"}). Section content is not changed; finalized reports are unaffected.`)}
          confirmLabel={T(lang, "Переприв'язати", "Re-bind")}
          busy={busy}
          error={error}
          onCancel={() => { setConfirmFor(null); setError(null); }}
          onConfirm={doRebind}
        />
      )}
    </div>
  );
}
