// Reports.jsx — Sprint 08: Reports list/detail/versioning/amendment
// URL search-params encode filter state (copy-paste link reproduces view).
// Version diff via ReportDiff. Amendment via AmendmentModal.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useI18n } from '../i18n.js';
import { Icon, Empty, SaveStatus, Modal } from './UI.jsx';
import { Loading, asList } from './DataStates.jsx';
import { ApiErrorView } from './ApiErrorView.jsx';
import { Pagination } from './Pagination.jsx';
import { useAsync } from '../api/useAsync.js';
import { listReports, countReports, reportHits, getReport, listReportVersions, getReportVersion, amendReport, cancelReport } from '../api/reports.js';
import { listTemplates, getTemplate, toStudioTemplate } from '../api/templates.js';
import { AmendmentModal, ReportDiffView } from './ReportDiff.jsx';
import { SigningFlow } from './SigningFlow.jsx';
import { useSpeechRecognition, LevelMeter } from './Studio.jsx';
import { segmentUtterance, appendUtterance } from '../dictation/voiceCommands.js';

// ── Helpers ───────────────────────────────────────────────────────────────

function loc(v, lang) {
  if (v == null) return "";
  if (typeof v === "object") return v[lang] ?? v.en ?? Object.values(v)[0] ?? "";
  return v;
}

// Map a /v1/reports/search hit onto the flat shape the list row renders.
// The search endpoint is PHI-minimised: it exposes the patient's redacted
// initials (not a name) and the template id (not the template object), which
// we resolve against the loaded templates map at render time.
function hitToReport(h) {
  return {
    id: h.report_id,
    code: h.code,
    title: h.title,
    status: h.status,
    template_id: h.template_id,
    patient_id: h.patient_id,
    patient_initials: h.patient_name_redacted || "",
    encounter_date: h.encounter_date,
    modified: h.updated_at,
    primary_author_id: h.primary_author_id,
  };
}

function encodeFilters(filters) {
  const p = new URLSearchParams();
  if (filters.tab && filters.tab !== 'all') p.set('tab', filters.tab);
  if (filters.search)                        p.set('q', filters.search);
  if (filters.spec)                          p.set('spec', filters.spec);
  return p.toString() ? '?' + p.toString() : '';
}

function decodeFilters(search) {
  const p = new URLSearchParams(search);
  return { tab: p.get('tab') || 'mine', search: p.get('q') || '', spec: p.get('spec') || null };
}

function templatesToMap(data) {
  return Object.fromEntries(asList(data).map((t) => [t.id, t]));
}

// ── Status chip ───────────────────────────────────────────────────────────

function StatusChip({ status, lang }) {
  const labels = {
    draft:     { uk: "Чернетка",   en: "Draft"   },
    final:     { uk: "Фінал",      en: "Final"   },
    finalized: { uk: "Очікує підпису", en: "Awaiting signature" }, // backend "finalized" = locked, awaiting KEP
    signed:    { uk: "Підписано",  en: "Signed"  },
    amended:   { uk: "З правками", en: "Amended" },
    cancelled: { uk: "Скасовано",  en: "Cancelled" },
  };
  const label = labels[status]?.[lang] ?? status;
  // Reuse the "final" chip styling for the backend's "finalized" status.
  const cls = status === "finalized" ? "final" : status;
  return <span className={`chip rep-status-${cls}`}>{label}</span>;
}

// ── Specialty filter dropdown ─────────────────────────────────────────────

function SpecFilter({ value, onChange, lang, specs }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);
  useEffect(() => {
    const close = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const label = value ? t(`spec.${value}`) : (lang === "uk" ? "Спеціальність" : "Specialty");
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className={`btn ghost sm${value ? " accent" : ""}`} onClick={() => setOpen(!open)} style={{ gap: 6 }}>
        <Icon name="filter" size={12} />
        {label}
        <Icon name="chevDown" size={11} />
        {value && (
          <span style={{ marginLeft: 2, opacity: .7 }} onClick={e => { e.stopPropagation(); onChange(null); }}>×</span>
        )}
      </button>
      {open && (
        <div className="tpl-dropdown" style={{ minWidth: 200 }}>
          {specs.map(s => (
            <button key={s} className={`tpl-option${value === s ? " active" : ""}`}
                    onClick={() => { onChange(s); setOpen(false); }}>
              {t(`spec.${s}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Reports list ──────────────────────────────────────────────────────────

const REPORTS_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const REPORTS_DEFAULT_PAGE_SIZE = 20;

// Each tab maps to a backend report status (the sprint-08 one-directional
// lifecycle: draft → finalized(awaiting signature) → signed → amended;
// draft/finalized → cancelled). `all` fetches every status. Filtering is done
// server-side so tabs are correct across the whole result set, not just the
// first page we happened to fetch.
// The four "live" statuses. "All" means all of these — NOT literally every
// status, which would drown the list in cancelled reports (cancelled has its
// own tab). listReports emits one repeated ?status= param per array entry.
const ACTIVE_STATUSES = ["draft", "finalized", "signed", "amended"];

// Where a report row opens. A draft is still editable, so it reopens in the
// Studio (rehydrated, same id/version, status untouched) to keep dictating.
// Everything past draft is read-only/amend-only → the report view.
export function openReportPath(r) {
  return r?.status === "draft"
    ? `/dictate/studio?report=${r.id}`
    : `/dictate/reports/${r.id}`;
}

const TAB_STATUS = {
  mine:      "draft",
  finalized: "finalized",
  signed:    "signed",
  amended:   "amended",
  cancelled: "cancelled",
  all:       ACTIVE_STATUSES,
};

export function ReportsList({ navigate, lang }) {
  const templatesReq = useAsync(() => listTemplates(), []);
  const templatesMap = useMemo(() => templatesToMap(templatesReq.data), [templatesReq.data]);

  const [filters, setFilters] = useState(() => decodeFilters(location.search));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(REPORTS_DEFAULT_PAGE_SIZE);

  const setFilter = useCallback((key, val) => {
    setFilters(f => {
      const next = { ...f, [key]: val };
      history.replaceState(null, '', location.pathname + encodeFilters(next));
      return next;
    });
  }, []);

  // Debounce the search box so each keystroke doesn't fire a request; the
  // debounced value drives the backend full-text search (`q`), not a
  // client-side filter over the fetched page.
  const [debouncedSearch, setDebouncedSearch] = useState(() => filters.search || "");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(filters.search.trim()), 250);
    return () => clearTimeout(id);
  }, [filters.search]);

  // Fetch the active tab's reports server-side by status + full-text query
  // (re-runs on tab / search change) so results reflect the whole result set,
  // not just the first page. The backend orders most-recent-first.
  const activeStatus = TAB_STATUS[filters.tab];
  const reportsReq = useAsync(
    () => listReports({
      ...(activeStatus ? { status: activeStatus } : {}),
      ...(debouncedSearch ? { query: debouncedSearch } : {}),
      limit: 100,
    }),
    [filters.tab, debouncedSearch],
  );

  // Exact per-tab counts for the badges (cheap total=exact calls). They respect
  // the active search so the badge numbers match the filtered list.
  const countsReq = useAsync(
    () => {
      const q = debouncedSearch ? { query: debouncedSearch } : {};
      return Promise.all([
        countReports({ ...q, status: "draft" }),
        countReports({ ...q, status: "finalized" }),
        countReports({ ...q, status: "signed" }),
        countReports({ ...q, status: "amended" }),
        countReports({ ...q, status: "cancelled" }),
        countReports({ ...q, status: ACTIVE_STATUSES }),
      ]);
    },
    [debouncedSearch],
  );

  const all = useMemo(() => reportHits(reportsReq.data).map(hitToReport), [reportsReq.data]);

  // Text search is server-side (see `debouncedSearch`); only the specialty
  // filter (which the search DTO can't express — it exposes template_id, not
  // specialty) is applied client-side over the fetched page.
  const reports = useMemo(() => {
    let r = all.slice();
    if (filters.spec) r = r.filter(x => templatesMap[x.template_id]?.specialty === filters.spec);
    r.sort((a, b) => new Date(b.modified || 0) - new Date(a.modified || 0));
    return r;
  }, [all, filters.spec, templatesMap]);

  // Reset to the first page whenever the filtered result set changes.
  useEffect(() => { setPage(1); }, [filters]);

  const pageCount = Math.max(1, Math.ceil(reports.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageReports = reports.slice((safePage - 1) * pageSize, safePage * pageSize);

  const [dCount, fCount, sCount, aCount, cCount, allCount] = countsReq.data || [];
  const counts = {
    mine:      dCount ?? "",
    finalized: fCount ?? "",
    signed:    sCount ?? "",
    amended:   aCount ?? "",
    cancelled: cCount ?? "",
    all:       allCount ?? "",
  };

  const tabs = [
    { key: "mine",      label: lang === "uk" ? "Мої чернетки"    : "My drafts" },
    { key: "finalized", label: lang === "uk" ? "Очікують підпису" : "Awaiting signature" },
    { key: "signed",    label: lang === "uk" ? "Підписані"       : "Signed"    },
    { key: "amended",   label: lang === "uk" ? "З правками"      : "Amended"   },
    { key: "cancelled", label: lang === "uk" ? "Скасовані"       : "Cancelled" },
    { key: "all",       label: lang === "uk" ? "Всі"             : "All"       },
  ];

  const specs = useMemo(() => {
    const set = new Set(asList(templatesReq.data).map(t => t.specialty).filter(Boolean));
    return [...set];
  }, [templatesReq.data]);

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1>{lang === "uk" ? "Звіти" : "Reports"}</h1>
          <p className="sub">{lang === "uk" ? "Всі диктовані звіти" : "All dictated reports"}</p>
        </div>
        <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
          <button className="btn" title={lang === 'uk' ? 'Скопіюйте URL для поточного фільтру' : 'Copy URL for current filter'}
                  onClick={() => { navigator.clipboard?.writeText(location.href); }}>
            <Icon name="download" size={14} /> {lang === "uk" ? "Копіювати посилання" : "Copy link"}
          </button>
          <button className="btn accent" onClick={() => navigate("/dictate/studio")}>
            <Icon name="plus" size={14} /> {lang === "uk" ? "Новий звіт" : "New report"}
          </button>
        </div>
      </div>

      <div className="ptable-toolbar" style={{ marginBottom: 0, paddingBottom: 14 }}>
        <label className="search-input">
          <Icon name="search" size={14} />
          <input
            placeholder={lang === "uk" ? "Пошук пацієнта, звіту…" : "Search patient, report…"}
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
          />
          {filters.search && (
            <button style={{ marginLeft: 4, opacity: .6 }} onClick={() => setFilter('search', '')}>✕</button>
          )}
        </label>
        {specs.length > 0 && <SpecFilter value={filters.spec} onChange={v => setFilter('spec', v)} lang={lang} specs={specs} />}
      </div>

      <div className="tabs" style={{ marginBottom: 14 }}>
        {tabs.map(({ key, label }) => (
          <button key={key} className={`tab${filters.tab === key ? " on" : ""}`} onClick={() => setFilter('tab', key)}>
            {label}
            <span className="tab-count">{counts[key]}</span>
          </button>
        ))}
      </div>

      <div className="ptable">
        <div className="rep-head">
          <span>{lang === "uk" ? "Пацієнт" : "Patient"}</span>
          <span>{lang === "uk" ? "Шаблон" : "Template"}</span>
          <span>{lang === "uk" ? "Статус" : "Status"}</span>
          <span>{lang === "uk" ? "Оновлено" : "Modified"}</span>
          <span>{lang === "uk" ? "Дата візиту" : "Encounter"}</span>
          <span />
        </div>
        {reportsReq.loading ? <Loading lang={lang} />
          : reportsReq.error ? <ApiErrorView error={reportsReq.error} lang={lang} />
          : reports.length === 0 ? (
            <div style={{ padding: "40px 24px", textAlign: "center" }}>
              <Empty icon="fileText" title={lang === "uk" ? "Звітів не знайдено" : "No reports found"} />
            </div>
          ) : pageReports.map(r => (
            <ReportRow key={r.id} r={r} tpl={templatesMap[r.template_id]} lang={lang}
              onClick={() => navigate(openReportPath(r))}
              onChanged={() => { reportsReq.reload(); countsReq.reload(); }} />
          ))}
      </div>

      {!reportsReq.loading && !reportsReq.error && reports.length > 0 && (
        <Pagination
          page={safePage}
          pageCount={pageCount}
          onPage={setPage}
          onPrev={() => setPage(p => Math.max(1, p - 1))}
          onNext={() => setPage(p => Math.min(pageCount, p + 1))}
          total={reports.length}
          pageSize={pageSize}
          pageSizeOptions={REPORTS_PAGE_SIZE_OPTIONS}
          onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
          lang={lang}
        />
      )}
    </div>
  );
}

function ReportRow({ r, tpl, onClick, onChanged, lang }) {
  const { t } = useI18n();
  return (
    <div className="rep-row" onClick={onClick} role="row" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onClick()}>
      <div className="pcell-name">
        <div className="tpl-icon sm"><Icon name={tpl?.icon || "fileText"} size={14} /></div>
        <div>
          <div className="pname">{r.patient_initials || (lang === "uk" ? "Пацієнт" : "Patient")}</div>
          <div className="psub">{r.code}</div>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{loc(tpl?.name, lang) || loc(r.title, lang) || (lang === "uk" ? "Без шаблону" : "No template")}</div>
        {tpl?.specialty && <div className="psub">{t(`spec.${tpl.specialty}`)}</div>}
      </div>
      <div><StatusChip status={r.status} lang={lang} /></div>
      <div>
        <div style={{ fontSize: 13 }}>{relativeTime(r.modified, lang)}</div>
        <div className="psub">{formatDate(r.modified, lang)}</div>
      </div>
      <div className="pcell-name" style={{ gap: 8 }}>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>{r.encounter_date ? formatDate(r.encounter_date, lang) : "—"}</span>
      </div>
      <div style={{ color: "var(--muted)", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4 }}>
        <RowActionsMenu r={r} tpl={tpl} lang={lang} onChanged={onChanged} />
        <Icon name="chevRight" size={14} />
      </div>
    </div>
  );
}

// ── Row "…" menu — versions, version comparison, cancel ────────────────────
// Lives on the list so a report can be inspected/cancelled without opening it.
// The version/diff data is fetched lazily (only when the menu's modal opens) to
// keep the list render cheap.
function RowActionsMenu({ r, tpl, lang, onChanged }) {
  const uk = lang === "uk";
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(null); // null | "versions" | "cancel"
  const wrapRef = React.useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Only draft/finalized reports can be cancelled (signed/amended are legally
  // frozen; a cancelled one is already terminal). Mirrors the backend lifecycle.
  const canCancel = r.status === "draft" || r.status === "finalized";
  const stop = e => e.stopPropagation();

  return (
    <div className="insights-wrap" ref={wrapRef} onClick={stop}>
      <button
        type="button"
        className={"btn ghost sm insights-btn" + (open ? " accent" : "")}
        onClick={e => { stop(e); setOpen(o => !o); }}
        aria-haspopup="menu"
        aria-expanded={open}
        title={uk ? "Дії" : "Actions"}
      >
        <Icon name="moreV" size={16} />
      </button>
      {open && (
        <div className="row-actions-menu" role="menu">
          <button type="button" role="menuitem" className="row-action"
            onClick={() => { setOpen(false); setModal("versions"); }}>
            <Icon name="layers" size={14} />
            <span>{uk ? "Версії та порівняння" : "Versions & compare"}</span>
          </button>
          {canCancel && (
            <button type="button" role="menuitem" className="row-action danger"
              onClick={() => { setOpen(false); setModal("cancel"); }}>
              <Icon name="x" size={14} />
              <span>{uk ? "Скасувати звіт" : "Cancel report"}</span>
            </button>
          )}
        </div>
      )}
      {modal === "versions" && (
        <VersionsModal report={r} tpl={tpl} lang={lang} onClose={() => setModal(null)} />
      )}
      {modal === "cancel" && (
        <CancelReportModal report={r} lang={lang}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); onChanged?.(); }} />
      )}
    </div>
  );
}

// Versions list + version comparison for a single report, in a modal off the
// list. Versions and the full template (needed to render section-by-section
// diffs) are fetched lazily on open.
function VersionsModal({ report, tpl, lang, onClose }) {
  const uk = lang === "uk";
  const versionsReq = useAsync(() => listReportVersions(report.id), [report.id]);
  const templateReq = useAsync(
    () => (report.template_id ? getTemplate(report.template_id) : Promise.resolve(null)),
    [report.template_id],
    { enabled: !!report.template_id },
  );
  const template = useMemo(
    () => (templateReq.data ? toStudioTemplate(templateReq.data) : null),
    [templateReq.data],
  );
  const versions = asList(versionsReq.data);
  const [diffPair, setDiffPair] = useState(null); // { v1, v2 }

  return (
    <Modal onClose={onClose}>
      <div className="versions-modal" onClick={e => e.stopPropagation()}>
        <div className="vm-head">
          <div>
            <h2>{uk ? "Версії звіту" : "Report versions"}</h2>
            <p className="muted">{loc(tpl?.name, lang) || loc(report.title, lang) || report.code} · {report.code}</p>
          </div>
          <button type="button" className="btn ghost sm" onClick={onClose} aria-label={uk ? "Закрити" : "Close"}>
            <Icon name="x" size={15} />
          </button>
        </div>

        <div className="vm-body">
          {diffPair ? (
            template ? (
              <ReportDiffLoader id={report.id} template={template} v1={diffPair.v1} v2={diffPair.v2} lang={lang}
                onBack={() => setDiffPair(null)} />
            ) : (
              <Loading lang={lang} />
            )
          ) : (
            <>
              {versionsReq.error ? (
                <ApiErrorView error={versionsReq.error} lang={lang} />
              ) : versionsReq.loading ? (
                <Loading lang={lang} />
              ) : versions.length === 0 ? (
                <div className="psub">{uk ? "Немає збережених версій" : "No saved versions yet"}</div>
              ) : (
                <div className="version-list">
                  {versions.map(v => (
                    <div key={v.version_number} className="version-row">
                      <div className="v-top">
                        <span className="v-label">
                          v{v.version_number}{v.is_amendment ? ` · ${uk ? "правка" : "amendment"}` : ""}
                        </span>
                      </div>
                      <div className="v-meta">
                        {formatDate(v.created_at, lang)}{v.amendment_reason ? ` · ${v.amendment_reason}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="vm-divider" />
              <h3 className="vm-sub">{uk ? "Порівняти версії" : "Compare versions"}</h3>
              <DiffTab
                versions={versions}
                loading={versionsReq.loading}
                lang={lang}
                onCompare={(v1, v2) => setDiffPair({ v1, v2 })}
              />
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

// Cancel confirmation. Cancelling keeps the report on file but marks it
// terminal (status "cancelled") — it disappears from the active tabs and moves
// to the Cancelled tab. Not editable or signable afterwards.
function CancelReportModal({ report, lang, onClose, onDone }) {
  const uk = lang === "uk";
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const confirm = async () => {
    setBusy(true); setErr(null);
    try {
      await cancelReport(report.id);
      onDone?.();
    } catch (e) {
      setErr((e && e.message) || (uk ? "Не вдалося скасувати звіт" : "Could not cancel the report"));
      setBusy(false);
    }
  };

  return (
    <Modal onClose={busy ? () => {} : onClose}>
      <div className="cancel-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-h">
          <h2>{uk ? "Скасувати звіт?" : "Cancel this report?"}</h2>
          <p>
            {uk
              ? "Звіт залишиться в системі, але буде позначений як «Скасовано». Його більше не можна редагувати чи підписати."
              : "The report stays on file but is marked “Cancelled”. It can no longer be edited or signed."}
          </p>
        </div>
        <div className="modal-b">
          <div className="cancel-summary">
            <Icon name="fileText" size={14} className="muted" />
            <span>{report.code}</span>
            {report.patient_initials && <><span className="muted">·</span><span>{report.patient_initials}</span></>}
          </div>
          {err && <div className="form-error" style={{ marginTop: 10 }}>{err}</div>}
        </div>
        <div className="modal-f">
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            {uk ? "Ні, залишити" : "Keep report"}
          </button>
          <button type="button" className="btn danger" onClick={confirm} disabled={busy}>
            {busy ? (uk ? "Скасування…" : "Cancelling…") : (uk ? "Так, скасувати звіт" : "Cancel report")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Diff loader — fetches two version bodies, then renders the diff view ────

function ReportDiffLoader({ id, template, v1, v2, lang, onBack }) {
  const req = useAsync(() => Promise.all([getReportVersion(id, v1), getReportVersion(id, v2)]), [id, v1, v2]);
  if (req.loading) return <div className="page"><Loading lang={lang} /></div>;
  if (req.error) return <div className="page"><ApiErrorView error={req.error} lang={lang} /></div>;
  const [a, b] = req.data || [];
  const report = { versions: [{ body: a?.body || {} }, { body: b?.body || {} }] };
  return <ReportDiffView report={report} template={template} v1={1} v2={2} lang={lang} onBack={onBack} />;
}

// ── Diff tab — pick two versions to compare, then open the full diff view ──

function DiffTab({ versions, loading, lang, onCompare }) {
  const uk = lang === "uk";
  // Default: previous → latest (the most common "what changed last" comparison).
  const [from, setFrom] = useState(() => (versions[1]?.version_number ?? versions[0]?.version_number ?? null));
  const [to, setTo]     = useState(() => (versions[0]?.version_number ?? null));

  if (loading) return <Loading lang={lang} />;
  if (versions.length < 2) {
    return (
      <div className="psub" style={{ padding: "8px 0" }}>
        {uk ? "Потрібно щонайменше дві версії для порівняння." : "Need at least two versions to compare."}
      </div>
    );
  }

  const opts = versions.map(v => v.version_number);
  const same = from === to;
  return (
    <div className="diff-tab">
      <div className="diff-tab-row">
        <label>
          <span>{uk ? "Від" : "From"}</span>
          <select className="ti" value={from ?? ""} onChange={e => setFrom(Number(e.target.value))}>
            {opts.map(n => <option key={n} value={n}>v{n}</option>)}
          </select>
        </label>
        <Icon name="arrowRight" size={13} className="muted" />
        <label>
          <span>{uk ? "До" : "To"}</span>
          <select className="ti" value={to ?? ""} onChange={e => setTo(Number(e.target.value))}>
            {opts.map(n => <option key={n} value={n}>v{n}</option>)}
          </select>
        </label>
      </div>
      <button
        className="btn accent sm"
        style={{ width: "100%", justifyContent: "center" }}
        disabled={same}
        onClick={() => onCompare(from, to)}
      >
        <Icon name="diff" size={12} /> {uk ? "Порівняти версії" : "Compare versions"}
      </button>
      {same && (
        <div className="psub" style={{ marginTop: 6 }}>
          {uk ? "Оберіть дві різні версії." : "Pick two different versions."}
        </div>
      )}
    </div>
  );
}

// ── History tab — a chronological timeline of the report's lifecycle ───────
// Built from the version list plus the report's lifecycle timestamps so it
// works from the same data the sidebar already loads (no extra request).

function buildHistory(report, versions, lang) {
  const uk = lang === "uk";
  const events = [];
  // Oldest version first; each version (draft/amendment) is a timeline entry.
  [...versions].reverse().forEach(v => {
    events.push({
      at: v.created_at,
      icon: v.is_amendment ? "edit" : "layers",
      label: v.is_amendment
        ? (uk ? `Правка · v${v.version_number}` : `Amendment · v${v.version_number}`)
        : (uk ? `Версія v${v.version_number}` : `Version v${v.version_number}`),
      sub: v.amendment_reason || "",
    });
  });
  // Fall back to the report's created_at when versions aren't available.
  if (!events.length && report.created_at) {
    events.push({ at: report.created_at, icon: "plus", label: uk ? "Створено чернетку" : "Draft created" });
  }
  if (report.finalized_at) {
    events.push({ at: report.finalized_at, icon: "check", label: uk ? "Завершено (очікує підпису)" : "Finalized (awaiting signature)" });
  }
  if (report.signed_at) {
    events.push({ at: report.signed_at, icon: "shield", label: uk ? "Підписано цифровим підписом" : "Digitally signed" });
  }
  return events.filter(e => e.at).sort((a, b) => new Date(a.at) - new Date(b.at));
}

function HistoryTab({ report, versions, loading, lang }) {
  const uk = lang === "uk";
  if (loading) return <Loading lang={lang} />;
  const events = buildHistory(report, versions, lang);
  if (!events.length) {
    return <div className="psub" style={{ padding: "8px 0" }}>{uk ? "Немає подій" : "No history yet"}</div>;
  }
  return (
    <ol className="history-timeline">
      {events.map((e, i) => (
        <li key={i} className="history-event">
          <span className="he-dot"><Icon name={e.icon} size={12} /></span>
          <div className="he-body">
            <div className="he-label">{e.label}</div>
            <div className="he-time">{formatDate(e.at, lang)}</div>
            {e.sub && <div className="he-sub">{e.sub}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}

// ── Voice dictation panel (right rail) ─────────────────────────────────────
// The report view's right side is a dictation surface — mirror of the Studio
// mic. Speaking appends to a working copy of the chosen section; "Save as
// amendment" hands that dictated draft to the AmendmentModal (which collects
// the mandatory reason and creates a new version). Versions/diff/history live
// behind the toolbar "…" menu instead of taking this space.
function ReportDictatePanel({ contentSections, sectionLabel, lang, onAmend, disabled }) {
  const uk = lang === "uk";
  const [dictLang, setDictLang] = useState(lang);
  const [activeKey, setActiveKey] = useState(contentSections[0]?.section_key || null);
  const [partial, setPartial] = useState("");
  // Working copy keyed by section_key, seeded from the current report text.
  const [draft, setDraft] = useState(() =>
    Object.fromEntries(contentSections.map(s => [s.section_key, s.text || ""])));

  // Keep the active section valid if the report content changes underneath us.
  useEffect(() => {
    if (!contentSections.some(s => s.section_key === activeKey)) {
      setActiveKey(contentSections[0]?.section_key || null);
    }
  }, [contentSections, activeKey]);

  const onFinal = useCallback((s) => {
    const trimmed = s.trim();
    if (!trimmed || !activeKey) return;
    // Segment out embedded voice commands (punctuation, breaks) so "кома"
    // inserts "," instead of the literal word. Action commands (save/stop/…)
    // are dropped here — the amendment editor has its own explicit buttons.
    const parts = segmentUtterance(trimmed, dictLang);
    setDraft(prev => ({
      ...prev,
      [activeKey]: appendUtterance(prev[activeKey] || "", parts),
    }));
    setPartial("");
  }, [activeKey, dictLang]);

  const speech = useSpeechRecognition({ lang: dictLang, enabled: true, onPartial: setPartial, onFinal });

  const setActiveText = (text) =>
    setDraft(prev => ({ ...prev, [activeKey]: text }));

  const changed = contentSections.some(s => (draft[s.section_key] ?? "") !== (s.text || ""));

  const toggleMic = () => {
    if (speech.state === "listening") speech.pause();
    else speech.start();
  };

  const stateLabel = {
    idle: uk ? "Готово" : "Ready",
    connecting: uk ? "З'єднання…" : "Connecting…",
    listening: uk ? "Слухаю…" : "Listening…",
    paused: uk ? "Пауза" : "Paused",
    processing: uk ? "Обробка…" : "Processing…",
    error_permission: uk ? "Немає доступу до мікрофона" : "Microphone blocked",
    error_network: uk ? "Помилка мережі" : "Network error",
    error_unsupported: uk ? "Диктування не підтримується" : "Dictation unsupported",
  }[speech.state] || speech.state;

  if (!contentSections.length) {
    return (
      <div className="dictate-panel">
        <div className="rail-h" style={{ padding: 0 }}>{uk ? "Диктування" : "Dictation"}</div>
        <div className="psub" style={{ padding: "8px 0" }}>
          {uk ? "У звіті немає розділів для диктування." : "This report has no sections to dictate into."}
        </div>
      </div>
    );
  }

  return (
    <div className="dictate-panel">
      <div className="dictate-h">
        <span className="rail-h" style={{ padding: 0 }}>{uk ? "Диктувати правку" : "Dictate a correction"}</span>
        <div className="lang-switch" role="tablist" aria-label="Dictation language">
          <button type="button" className={dictLang === "uk" ? "on" : ""} onClick={() => setDictLang("uk")}>UK</button>
          <button type="button" className={dictLang === "en" ? "on" : ""} onClick={() => setDictLang("en")}>EN</button>
        </div>
      </div>

      <div className="dictate-secs" role="tablist" aria-label={uk ? "Розділ" : "Section"}>
        {contentSections.map(s => (
          <button
            key={s.section_key}
            type="button"
            role="tab"
            aria-selected={s.section_key === activeKey}
            className={"dictate-sec-chip" + (s.section_key === activeKey ? " on" : "")}
            onClick={() => setActiveKey(s.section_key)}
          >
            {sectionLabel(s.section_key)}
            {(draft[s.section_key] ?? "") !== (s.text || "") && <span className="dictate-dot" aria-hidden="true" />}
          </button>
        ))}
      </div>

      <textarea
        className="ti dictate-area"
        rows={7}
        value={draft[activeKey] || ""}
        onChange={e => setActiveText(e.target.value)}
        placeholder={uk ? "Натисніть мікрофон і говоріть…" : "Press the mic and speak…"}
        aria-label={uk ? "Текст розділу" : "Section text"}
      />
      {partial && <div className="dictate-partial">{partial}</div>}

      <div className="dictate-mic">
        <button
          className="mic-btn"
          data-state={speech.state}
          onClick={toggleMic}
          aria-label={stateLabel}
          aria-pressed={speech.state === "listening"}
        >
          <Icon name={speech.state === "listening" ? "mic" : speech.state === "paused" ? "pause" : speech.state.startsWith("error_") ? "micOff" : "mic"} size={26} />
        </button>
        <div className="mic-state-label" style={{ fontSize: 12.5 }}>{stateLabel}</div>
        <LevelMeter active={speech.state === "listening"} level={speech.level} />
      </div>

      <button
        className="btn accent"
        style={{ width: "100%", justifyContent: "center" }}
        disabled={disabled || !changed}
        onClick={() => onAmend(draft)}
        title={disabled ? (uk ? "Диктування правок недоступне" : "Amendment unavailable") : undefined}
      >
        <Icon name="edit" size={13} /> {uk ? "Зберегти як правку" : "Save as amendment"}
      </button>
      {!changed && (
        <div className="psub" style={{ fontSize: 11 }}>
          {uk ? "Продиктуйте зміну, щоб зберегти правку." : "Dictate a change to save an amendment."}
        </div>
      )}
    </div>
  );
}

// ── Single report view (Sprint 08) ────────────────────────────────────────

export function ReportView({ id, navigate, lang }) {
  const { t } = useI18n();
  const reportReq = useAsync(() => getReport(id), [id]);
  const templatesReq = useAsync(() => listTemplates(), []);
  const versionsReq = useAsync(() => listReportVersions(id), [id]);

  const [activeVer, setActiveVer] = useState(0);
  const [sideTab, setSideTab] = useState("versions"); // versions | diff | history
  const [showInsights, setShowInsights] = useState(false); // "…" menu (versions/diff/history)
  const [showDiff, setShowDiff] = useState(false);
  const [diffPair, setDiffPair] = useState(null); // { v1, v2 }
  const [showAmend, setShowAmend] = useState(false);
  const [amendSeed, setAmendSeed] = useState(null); // dictated body → AmendmentModal.initialBody
  const [signOpen, setSignOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const insightsRef = React.useRef(null);

  const pushToast = useCallback(msg => {
    const id2 = Math.random().toString(36).slice(2);
    setToasts(s => [...s, { msg, id: id2 }]);
    setTimeout(() => setToasts(s => s.filter(x => x.id !== id2)), 4000);
  }, []);

  // Close the "…" insights menu on an outside click.
  useEffect(() => {
    if (!showInsights) return;
    const onDoc = e => { if (insightsRef.current && !insightsRef.current.contains(e.target)) setShowInsights(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [showInsights]);

  if (reportReq.loading) return <div className="page"><Loading lang={lang} /></div>;
  if (reportReq.error) return <div className="page"><ApiErrorView error={reportReq.error} lang={lang} /></div>;

  const r = reportReq.data;
  if (!r) {
    return (
      <div className="page">
        <Empty icon="fileText" title={lang === "uk" ? "Звіт не знайдено" : "Report not found"}
               action={<button className="btn" onClick={() => navigate("/dictate/reports")}>← Back</button>} />
      </div>
    );
  }

  // The report envelope carries its data under `content` (template_id +
  // [{section_key, text}]) plus resolved, localized `section_labels`. The
  // list-template lookup only supplies the header name/specialty/icon; the
  // body is rendered straight from the envelope so it works even before the
  // template detail loads (and for templates that were later edited).
  const content = r.content || {};
  const contentSections = content.sections || [];
  const tpl = templatesToMap(templatesReq.data)[content.template_id];
  // Localized section titles resolved server-side (guide §3): key by section_key.
  const labelMap = Object.fromEntries(
    (r.section_labels || []).filter(l => l?.section_key).map(l => [l.section_key, l.name || {}]),
  );
  const sectionLabel = (key) => loc(labelMap[key], lang) || key;
  const isSigned = r.status === "signed" || r.status === "amended";
  const versions = asList(versionsReq.data);
  const signature = r.signature || {};
  const envelopeId = signature.envelope_id || r.envelope_id;

  if (showDiff && diffPair && tpl) {
    return (
      <ReportDiffLoader id={id} template={tpl} v1={diffPair.v1} v2={diffPair.v2} lang={lang}
        onBack={() => setShowDiff(false)} />
    );
  }

  const handleAmend = async (payload) => {
    setShowAmend(false);
    setAmendSeed(null);
    try {
      await amendReport(id, payload);
      pushToast(lang === 'uk' ? 'Правки збережено' : 'Amendment saved');
      reportReq.reload(); versionsReq.reload();
    } catch (e) {
      pushToast((e && e.message) || (lang === 'uk' ? 'Помилка' : 'Error'));
    }
  };

  return (
    <div className="report-page">
      <div className="toast-stack" style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 99 }}>
        {toasts.map(t2 => <div key={t2.id} className="toast">{t2.msg}</div>)}
      </div>

      <div className="report-main">
        <div className="editor-toolbar">
          <button className="btn ghost sm" onClick={() => navigate("/dictate/reports")}>
            <Icon name="arrowLeft" size={13} />
            {lang === "uk" ? "Звіти" : "Reports"}
          </button>
          <StatusChip status={r.status} lang={lang} />
          <div className="spacer" />
          <SaveStatus state={isSigned ? "saved" : "unsaved"} lastSavedAt={r.updated_at ? new Date(r.updated_at).getTime() : null} />
          <div className="vdiv" />
          {isSigned ? (
            <>
              <button className="btn sm" onClick={() => { setAmendSeed(null); setShowAmend(true); }}>
                <Icon name="edit" size={12} /> {lang === "uk" ? "Правки" : "Amend"}
              </button>
              <button className="btn sm" onClick={() => window.print()}>
                <Icon name="print" size={12} /> {lang === "uk" ? "Друк" : "Print"}
              </button>
            </>
          ) : (
            <>
              <button className="btn sm" onClick={() => window.print()}><Icon name="download" size={12} /> {lang === "uk" ? "Експорт" : "Export"}</button>
              <button className="btn accent sm" onClick={() => setSignOpen(true)}>
                <Icon name="sign" size={12} /> {lang === "uk" ? "Підписати" : "Sign"}
              </button>
            </>
          )}

          {/* "…" menu — versions / diff / history live here now, off the right rail */}
          <div className="insights-wrap" ref={insightsRef}>
            <button
              type="button"
              className={"btn ghost sm insights-btn" + (showInsights ? " accent" : "")}
              onClick={() => setShowInsights(o => !o)}
              aria-haspopup="menu"
              aria-expanded={showInsights}
              title={lang === "uk" ? "Версії · Різниця · Історія" : "Versions · Diff · History"}
            >
              <Icon name="moreH" size={16} />
            </button>
            {showInsights && (
              <div className="insights-menu" role="menu">
                <div className="side-tabs" role="tablist" aria-label={lang === "uk" ? "Розділи звіту" : "Report panels"}>
                  {[
                    { key: "versions", icon: "layers",  label: lang === "uk" ? "Версії"  : "Versions" },
                    { key: "diff",     icon: "diff",    label: lang === "uk" ? "Різниця" : "Diff" },
                    { key: "history",  icon: "history", label: lang === "uk" ? "Історія" : "History" },
                  ].map(tb => (
                    <button
                      key={tb.key}
                      type="button"
                      role="tab"
                      aria-selected={sideTab === tb.key}
                      className={`side-tab${sideTab === tb.key ? " on" : ""}`}
                      onClick={() => setSideTab(tb.key)}
                    >
                      <Icon name={tb.icon} size={13} />
                      <span>{tb.label}</span>
                    </button>
                  ))}
                </div>

                {sideTab === "versions" && (
                  versionsReq.loading ? <Loading lang={lang} /> : versions.length === 0 ? (
                    <div className="psub">{lang === "uk" ? "Немає версій" : "No versions"}</div>
                  ) : (
                    <div className="version-list">
                      {versions.map((v, i) => (
                        <div key={v.version_number} className={`version-row${activeVer === i ? " current" : ""}`} onClick={() => setActiveVer(i)}>
                          <div className="v-top">
                            <span className="v-label">v{v.version_number}{v.is_amendment ? ` · ${lang === "uk" ? "правка" : "amendment"}` : ""}</span>
                            {activeVer === i && <Icon name="check" size={12} style={{ color: "var(--accent)" }} />}
                          </div>
                          <div className="v-meta">{formatDate(v.created_at, lang)}</div>
                        </div>
                      ))}
                    </div>
                  )
                )}

                {sideTab === "diff" && (
                  <DiffTab
                    versions={versions}
                    loading={versionsReq.loading}
                    lang={lang}
                    onCompare={(v1, v2) => { setDiffPair({ v1, v2 }); setShowDiff(true); setShowInsights(false); }}
                  />
                )}

                {sideTab === "history" && (
                  <HistoryTab report={r} versions={versions} loading={versionsReq.loading} lang={lang} />
                )}
              </div>
            )}
          </div>
        </div>

        <div className="editor-scroll">
          <div className="editor">
            {isSigned && (
              <div className="signed-banner">
                <Icon name="shield" size={15} />
                <div>
                  <strong>{lang === "uk" ? "Підписано цифровим підписом" : "Digitally signed"}</strong>
                  {r.signed_at && <>{" · "}{formatDate(r.signed_at, lang)}</>}
                  {(signature.sha || envelopeId) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      {signature.sha && (
                        <span style={{ fontFamily: "var(--mono)", fontSize: 11, opacity: .75 }}>SHA: {signature.sha}</span>
                      )}
                      {envelopeId && (
                        <a href={`#/verify/${envelopeId}`} style={{ fontSize: 11, color: 'var(--accent)', marginLeft: 8 }}>
                          {lang === 'uk' ? 'Верифікувати →' : 'Verify →'}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <h1 className="report-title">{loc(r.title, lang) || loc(tpl?.name, lang) || r.code}</h1>
            <div className="report-meta">
              <span className="chip">{r.code}</span>
              {tpl?.specialty && <span>{t(`spec.${tpl.specialty}`)}</span>}
              {r.patient_name_redacted && <><span>·</span><span>{r.patient_name_redacted}</span></>}
              {r.encounter_date && <><span>·</span><span className="mono" style={{ fontSize: 12 }}>{formatDate(r.encounter_date, lang)}</span></>}
            </div>

            {contentSections.length === 0 ? (
              <div className="body" style={{ color: "var(--muted)", fontStyle: "italic" }}>
                {lang === "uk" ? "— порожній звіт —" : "— empty report —"}
              </div>
            ) : contentSections.map(s => (
              <div key={s.section_key} className="section-block">
                <div className="sec-h">
                  <span>{sectionLabel(s.section_key)}</span>
                </div>
                <div className="body" style={{ whiteSpace: "pre-wrap" }}>
                  {s.text || <span style={{ color: "var(--muted)", fontStyle: "italic" }}>— {lang === "uk" ? "відсутнє" : "missing"} —</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <aside className="report-side">
        {r.audio?.url && (
          <div className="audio-player">
            <div className="ap-h">
              <span><Icon name="audio" size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                {lang === "uk" ? "Аудіозапис" : "Audio"}
              </span>
              {r.audio.duration != null && <span className="mono">{formatDur(r.audio.duration)}</span>}
            </div>
            <audio controls src={r.audio.url} style={{ width: "100%", marginTop: 8 }} />
          </div>
        )}

        <ReportDictatePanel
          contentSections={contentSections}
          sectionLabel={sectionLabel}
          lang={lang}
          onAmend={(draftBody) => { setAmendSeed(draftBody); setShowAmend(true); }}
        />

        <div>
          <div className="rail-h" style={{ padding: "0 0 8px" }}>{lang === "uk" ? "Метадані" : "Details"}</div>
          <div className="meta-list">
            <MetaRow label={lang === "uk" ? "Створено" : "Created"} value={formatDate(r.created_at, lang)} />
            <MetaRow label={lang === "uk" ? "Оновлено" : "Modified"} value={formatDate(r.updated_at, lang)} />
            <MetaRow label={lang === "uk" ? "Слів" : "Words"} value={String(countWords(contentSections.map(s => s.text || "")))} />
            {r.finalized_at && <MetaRow label={lang === "uk" ? "Завершено" : "Finalized"} value={formatDate(r.finalized_at, lang)} />}
            {isSigned && r.signed_at && <MetaRow label={lang === "uk" ? "Підписано" : "Signed"} value={formatDate(r.signed_at, lang)} />}
          </div>
        </div>
      </aside>

      {showAmend && (
        <AmendmentModal report={r} template={tpl} lang={lang} initialBody={amendSeed}
          onCancel={() => { setShowAmend(false); setAmendSeed(null); }} onConfirm={handleAmend} />
      )}

      {signOpen && (
        <SigningFlow lang={lang} reportId={id}
          onClose={() => setSignOpen(false)}
          onSigned={() => {
            setSignOpen(false);
            pushToast(lang === 'uk' ? 'Звіт підписано' : 'Report signed');
            reportReq.reload(); versionsReq.reload();
          }} />
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function MetaRow({ label, value }) {
  return (
    <div className="meta-row">
      <span className="meta-label">{label}</span>
      <span className="meta-value">{value}</span>
    </div>
  );
}

function relativeTime(iso, lang) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  const hr = Math.floor(min / 60);
  const d = Math.floor(hr / 24);
  if (lang === "uk") {
    if (min < 1)  return "щойно";
    if (min < 60) return `${min} хв тому`;
    if (hr  < 24) return `${hr} год тому`;
    return `${d} ${d === 1 ? "день" : d < 5 ? "дні" : "днів"} тому`;
  }
  if (min < 1)  return "just now";
  if (min < 60) return `${min}m ago`;
  if (hr  < 24) return `${hr}h ago`;
  return `${d}d ago`;
}
function formatDate(iso, lang) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(lang === "uk" ? "uk-UA" : "en-US", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
function formatDur(s) {
  s = Math.floor(s || 0);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function countWords(body) {
  return Object.values(body || {}).reduce((n, v) => n + String(v || "").split(/\s+/).filter(Boolean).length, 0);
}
