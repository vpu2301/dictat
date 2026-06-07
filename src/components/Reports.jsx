// Reports.jsx — Sprint 08: Reports list/detail/versioning/amendment
// URL search-params encode filter state (copy-paste link reproduces view).
// Version diff via ReportDiff. Amendment via AmendmentModal.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useI18n } from '../i18n.js';
import { Icon, Empty, SaveStatus } from './UI.jsx';
import { Loading, asList } from './DataStates.jsx';
import { ApiErrorView } from './ApiErrorView.jsx';
import { Pagination } from './Pagination.jsx';
import { useAsync } from '../api/useAsync.js';
import { listReports, getReport, listReportVersions, getReportVersion, amendReport } from '../api/reports.js';
import { listTemplates } from '../api/templates.js';
import { AmendmentModal, ReportDiffView } from './ReportDiff.jsx';
import { SigningFlow } from './SigningFlow.jsx';

// ── Helpers ───────────────────────────────────────────────────────────────

function loc(v, lang) {
  if (v == null) return "";
  if (typeof v === "object") return v[lang] ?? v.en ?? Object.values(v)[0] ?? "";
  return v;
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
    draft:   { uk: "Чернетка",   en: "Draft"   },
    final:   { uk: "Фінал",      en: "Final"   },
    signed:  { uk: "Підписано",  en: "Signed"  },
    amended: { uk: "З правками", en: "Amended" },
  };
  const label = labels[status]?.[lang] ?? status;
  return <span className={`chip rep-status-${status}`}>{label}</span>;
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

export function ReportsList({ navigate, lang }) {
  const reportsReq = useAsync(() => listReports({}), []);
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

  const all = asList(reportsReq.data);

  const reports = useMemo(() => {
    let r = all.slice();
    if (filters.tab === 'mine')         r = r.filter(x => x.status === "draft");
    else if (filters.tab === 'signed')  r = r.filter(x => x.status === "signed");
    else if (filters.tab === 'amended') r = r.filter(x => x.status === "amended");
    if (filters.spec) r = r.filter(x => templatesMap[x.template]?.specialty === filters.spec);
    if (filters.search) {
      const s = filters.search.toLowerCase();
      r = r.filter(x => `${loc(x.patient?.name, lang)} ${x.patient?.ref || ""}`.toLowerCase().includes(s));
    }
    r.sort((a, b) => new Date(b.modified || b.modified_at || 0) - new Date(a.modified || a.modified_at || 0));
    return r;
  }, [all, filters, templatesMap, lang]);

  // Reset to the first page whenever the filtered result set changes.
  useEffect(() => { setPage(1); }, [filters]);

  const pageCount = Math.max(1, Math.ceil(reports.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageReports = reports.slice((safePage - 1) * pageSize, safePage * pageSize);

  const counts = {
    mine:    all.filter(x => x.status === "draft").length,
    signed:  all.filter(x => x.status === "signed").length,
    amended: all.filter(x => x.status === "amended").length,
    all:     all.length,
  };

  const tabs = [
    { key: "mine",    label: lang === "uk" ? "Мої чернетки" : "My drafts" },
    { key: "signed",  label: lang === "uk" ? "Підписані"    : "Signed"    },
    { key: "amended", label: lang === "uk" ? "З правками"   : "Amended"   },
    { key: "all",     label: lang === "uk" ? "Всі"          : "All"       },
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
          <button className="btn accent" onClick={() => navigate("/dictate")}>
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
          <span>{lang === "uk" ? "Автор" : "Author"}</span>
          <span />
        </div>
        {reportsReq.loading ? <Loading lang={lang} />
          : reportsReq.error ? <ApiErrorView error={reportsReq.error} lang={lang} />
          : reports.length === 0 ? (
            <div style={{ padding: "40px 24px", textAlign: "center" }}>
              <Empty icon="fileText" title={lang === "uk" ? "Звітів не знайдено" : "No reports found"} />
            </div>
          ) : pageReports.map(r => (
            <ReportRow key={r.id} r={r} tpl={templatesMap[r.template]} lang={lang}
              onClick={() => navigate(`/dictate/reports/${r.id}`)} />
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

function ReportRow({ r, tpl, onClick, lang }) {
  const { t } = useI18n();
  return (
    <div className="rep-row" onClick={onClick} role="row" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onClick()}>
      <div className="pcell-name">
        <div className="tpl-icon sm"><Icon name={tpl?.icon || "fileText"} size={14} /></div>
        <div>
          <div className="pname">{loc(r.patient?.name, lang) || r.patient?.ref}</div>
          <div className="psub">{r.patient?.ref}{r.patient?.age != null ? ` · ${r.patient.age}${r.patient.sex || ""}` : ""}</div>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{loc(tpl?.name, lang) || r.template}</div>
        {tpl?.specialty && <div className="psub">{t(`spec.${tpl.specialty}`)}</div>}
      </div>
      <div><StatusChip status={r.status} lang={lang} /></div>
      <div>
        <div style={{ fontSize: 13 }}>{relativeTime(r.modified || r.modified_at, lang)}</div>
        <div className="psub">{formatDate(r.modified || r.modified_at, lang)}</div>
      </div>
      <div className="pcell-name" style={{ gap: 8 }}>
        {r.author && <div className="avatar" style={{ width: 24, height: 24, fontSize: 10, flexShrink: 0 }}>{r.author.initials || ""}</div>}
        <span style={{ fontSize: 13 }}>{loc(r.author?.name, lang)}</span>
      </div>
      <div style={{ color: "var(--muted)", display: "flex", justifyContent: "flex-end" }}>
        <Icon name="chevRight" size={14} />
      </div>
    </div>
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

// ── Single report view (Sprint 08) ────────────────────────────────────────

export function ReportView({ id, navigate, lang }) {
  const { t } = useI18n();
  const reportReq = useAsync(() => getReport(id), [id]);
  const templatesReq = useAsync(() => listTemplates(), []);
  const versionsReq = useAsync(() => listReportVersions(id), [id]);

  const [activeVer, setActiveVer] = useState(0);
  const [showDiff, setShowDiff] = useState(false);
  const [diffPair, setDiffPair] = useState(null); // { v1, v2 }
  const [showAmend, setShowAmend] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  const pushToast = useCallback(msg => {
    const id2 = Math.random().toString(36).slice(2);
    setToasts(s => [...s, { msg, id: id2 }]);
    setTimeout(() => setToasts(s => s.filter(x => x.id !== id2)), 4000);
  }, []);

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

  const tpl = templatesToMap(templatesReq.data)[r.template];
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

  const handleAmend = async (reason) => {
    setShowAmend(false);
    try {
      await amendReport(id, { reason, body: r.body });
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
          <SaveStatus state={isSigned ? "saved" : "unsaved"} lastSavedAt={r.modified ? new Date(r.modified).getTime() : null} />
          <div className="vdiv" />
          {isSigned ? (
            <>
              <button className="btn sm" onClick={() => setShowAmend(true)}>
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
        </div>

        <div className="editor-scroll">
          <div className="editor">
            {isSigned && (
              <div className="signed-banner">
                <Icon name="shield" size={15} />
                <div>
                  <strong>{lang === "uk" ? "Підписано цифровим підписом" : "Digitally signed"}</strong>
                  {r.signed && <>{" · "}{formatDate(r.signed, lang)}</>}
                  {r.author && <>{" · "}{loc(r.author.name, lang)}</>}
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

            <h1 className="report-title">{loc(tpl?.name, lang) || r.template}</h1>
            <div className="report-meta">
              {tpl?.code && <span className="chip">{tpl.code}</span>}
              {tpl?.specialty && <span>{t(`spec.${tpl.specialty}`)}</span>}
              {r.patient?.ref && <><span>·</span><span className="mono" style={{ fontSize: 12 }}>{r.patient.ref}</span></>}
              {r.patient?.name && <><span>·</span><span>{loc(r.patient.name, lang)}{r.patient.age != null ? `, ${r.patient.age}${r.patient.sex || ""}` : ""}</span></>}
            </div>

            {(tpl?.sections || []).map(s => {
              const value = r.body?.[s.id];
              if (!value && !s.required) return null;
              return (
                <div key={s.id} className="section-block">
                  <div className="sec-h">
                    <span>{loc(s.name, lang)}</span>
                    {s.required && <span className="req-tag">{lang === "uk" ? "Обов'язково" : "Required"}</span>}
                  </div>
                  <div className="body" style={{ whiteSpace: "pre-wrap" }}>
                    {value || <span style={{ color: "var(--muted)", fontStyle: "italic" }}>— {lang === "uk" ? "відсутнє" : "missing"} —</span>}
                  </div>
                </div>
              );
            })}
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

        <div>
          <div className="rail-h" style={{ padding: "0 0 8px", display: 'flex', alignItems: 'center', gap: 8 }}>
            {lang === "uk" ? "Версії" : "Versions"}
            {versions.length >= 2 && (
              <button className="btn ghost sm" style={{ marginLeft: 'auto', fontSize: 11 }}
                onClick={() => { setDiffPair({ v1: versions[1].version, v2: versions[0].version }); setShowDiff(true); }}>
                <Icon name="diff" size={11} /> {lang === 'uk' ? 'Різниця' : 'Diff'}
              </button>
            )}
          </div>
          {versionsReq.loading ? <Loading lang={lang} /> : versions.length === 0 ? (
            <div className="psub">{lang === "uk" ? "Немає версій" : "No versions"}</div>
          ) : (
            <div className="version-list">
              {versions.map((v, i) => (
                <div key={v.version} className={`version-row${activeVer === i ? " current" : ""}`} onClick={() => setActiveVer(i)}>
                  <div className="v-top">
                    <span className="v-label">v{v.version} · {loc(v.label, lang) || v.status}</span>
                    {activeVer === i && <Icon name="check" size={12} style={{ color: "var(--accent)" }} />}
                  </div>
                  <div className="v-meta">{formatDate(v.created_at || v.time, lang)}{v.author ? ` · ${loc(v.author.name, lang)}` : ""}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="rail-h" style={{ padding: "0 0 8px" }}>{lang === "uk" ? "Метадані" : "Details"}</div>
          <div className="meta-list">
            <MetaRow label={lang === "uk" ? "Створено" : "Created"} value={formatDate(r.created || r.created_at, lang)} />
            {r.duration != null && <MetaRow label={lang === "uk" ? "Тривалість" : "Duration"} value={formatDur(r.duration)} />}
            <MetaRow label={lang === "uk" ? "Слів" : "Words"} value={String(countWords(r.body))} />
            {r.lang && <MetaRow label={lang === "uk" ? "Мова" : "Language"} value={String(r.lang).toUpperCase()} />}
            {isSigned && r.signed && <MetaRow label={lang === "uk" ? "Підписано" : "Signed"} value={formatDate(r.signed, lang)} />}
          </div>
        </div>
      </aside>

      {showAmend && (
        <AmendmentModal report={r} template={tpl} lang={lang}
          onCancel={() => setShowAmend(false)} onConfirm={handleAmend} />
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
