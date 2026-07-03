// DictateHome.jsx — Dictate product landing ("overview"), the symmetric twin of
// ScribeToday. Switching to the Dictate product (sidebar tab) lands here instead
// of dropping straight into the recording Studio: the clinician sees their work
// (draft reports to finish, recent reports, quick starts) before recording.
import React from 'react';
import { Icon, Empty } from './UI.jsx';
import { LoadGate, asList } from './DataStates.jsx';
import { useAsync } from '../api/useAsync.js';
import { useClaims } from '../auth/AuthContext.jsx';
import { listReports, countReports } from '../api/reports.js';
import { openReportPath } from './Reports.jsx';
import { listTemplates } from '../api/templates.js';

// ── Helpers (mirrors Scribe.jsx / Reports.jsx conventions) ────────────────
function loc(v, lang) {
  if (v == null) return "";
  if (typeof v === "object") return v[lang] ?? v.en ?? Object.values(v)[0] ?? "";
  return v;
}
function fmtDate(iso, lang) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(lang === "uk" ? "uk-UA" : "en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtRel(iso, lang) {
  if (!iso) return "";
  const d = new Date(iso);
  const diffMin = Math.floor((Date.now() - d) / 60000);
  if (diffMin < 1) return lang === "uk" ? "щойно" : "just now";
  if (diffMin < 60) return lang === "uk" ? `${diffMin} хв тому` : `${diffMin} min ago`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return lang === "uk" ? `${h} год тому` : `${h} h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return lang === "uk" ? `${days} дн. тому` : `${days} d ago`;
  return fmtDate(iso, lang);
}
const reportModified = (r) => r.modified || r.modified_at || r.updated_at || r.created_at;

function StatusChip({ status, lang }) {
  const labels = {
    draft:     { uk: "Чернетка",   en: "Draft" },
    final:     { uk: "Фінал",      en: "Final" },
    finalized: { uk: "Завершено",  en: "Finalized" },
    signed:    { uk: "Підписано",  en: "Signed" },
    amended:   { uk: "З правками",  en: "Amended" },
  };
  const label = labels[status]?.[lang] ?? status;
  const cls = status === "finalized" ? "final" : status;
  return <span className={`chip rep-status-${cls}`}>{label}</span>;
}

// One report line, reusing the Scribe "note-row" feed styling.
function ReportRow({ r, tpl, lang, onClick }) {
  return (
    <div className="note-row" onClick={onClick}>
      <div className="tpl-icon sm"><Icon name={tpl?.icon || "fileText"} size={14} /></div>
      <div className="note-row-body">
        <div className="note-row-1">
          <span className="note-row-name">{loc(r.patient?.name, lang) || r.patient?.ref || (lang === "uk" ? "Без пацієнта" : "No patient")}</span>
          <span className="chip">{loc(tpl?.name, lang) || r.template}</span>
          <StatusChip status={r.status} lang={lang} />
        </div>
        <div className="note-row-2">{fmtRel(reportModified(r), lang)}</div>
      </div>
      <Icon name="chevRight" size={14} />
    </div>
  );
}

// ── Dictate landing ───────────────────────────────────────────────────────
export function DictateToday({ navigate, lang }) {
  // Reports are tenant-scoped server-side; re-key on the active tenant so the
  // overview refetches after a clinic switch (mirrors ScribePatients).
  const activeTid = useClaims()?.tid;
  const reportsReq  = useAsync(() => listReports({ limit: 50 }), [activeTid]);
  const templatesReq = useAsync(() => listTemplates({ limit: 200 }), [activeTid]);

  // Exact stat-tile counts (cheap total=exact calls) rather than counting the
  // truncated 50-row feed fetched above. Order: total(active) / drafts / signed.
  const statsReq = useAsync(
    () => Promise.all([
      countReports({ status: ["draft", "finalized", "signed", "amended"] }),
      countReports({ status: "draft" }),
      countReports({ status: ["signed", "amended"] }),
    ]),
    [activeTid],
  );
  const [totalCount, draftCount, signedCount] = statsReq.data || [];

  // The search endpoint returns PHI-minimised hits (report_id, template_id,
  // patient_name_redacted, updated_at). Alias them onto the flat shape this
  // page's row/derivation code expects (id / template / patient / modified).
  const reports   = asList(reportsReq.data).map((h) => ({
    ...h,
    id: h.report_id ?? h.id,
    template: h.template_id ?? h.template,
    modified: h.updated_at ?? h.modified,
    patient: h.patient_name_redacted ? { name: h.patient_name_redacted } : h.patient,
  }));
  const templates = asList(templatesReq.data);
  const tplMap = Object.fromEntries(templates.map((t) => [t.id, t]));

  const isDraft = (r) => r.status === "draft";
  const isFinal = (r) => r.status === "final" || r.status === "finalized";
  const isSigned = (r) => r.status === "signed" || r.status === "amended";

  const drafts = reports.filter(isDraft);
  const recent = [...reports]
    .sort((a, b) => new Date(reportModified(b) || 0) - new Date(reportModified(a) || 0))
    .slice(0, 5);

  const stats = [
    { label: lang === "uk" ? "Усього звітів" : "Total reports", value: totalCount ?? reports.length },
    { label: lang === "uk" ? "Чернеток" : "Drafts", value: draftCount ?? drafts.length },
    { label: lang === "uk" ? "Підписаних" : "Signed", value: signedCount ?? reports.filter(isSigned).length },
  ];

  const openStudio = (tid) => navigate(tid ? `/dictate/studio?template=${tid}` : "/dictate/studio");

  return (
    <div className="page">
      <div className="page-h">
        <div style={{ flex: 1 }}>
          <h1>{lang === "uk" ? "Диктування" : "Dictation"}</h1>
          <p className="sub">
            {lang === "uk"
              ? `${drafts.length} чернеток очікують · ${new Date().toLocaleDateString("uk-UA", { weekday: "long", day: "numeric", month: "long" })}`
              : `${drafts.length} drafts waiting · ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}`}
          </p>
        </div>
        <button className="btn accent" onClick={() => openStudio()}>
          <Icon name="mic" size={14} /> {lang === "uk" ? "Нове диктування" : "New dictation"}
        </button>
      </div>

      <div className="stats-row">
        {stats.map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-v">{s.value}</div>
            <div className="stat-l">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-h">
            <h3>{lang === "uk" ? "Чернетки до завершення" : "Drafts to finish"}</h3>
            <div style={{ flex: 1 }} />
            <a className="btn ghost sm" onClick={() => navigate("/dictate/reports?tab=draft")}>{lang === "uk" ? "Усі" : "All"}</a>
          </div>
          <LoadGate req={reportsReq} lang={lang}
            empty={() => (
              <Empty icon="fileText" title={lang === "uk" ? "Немає чернеток" : "No drafts"}
                body={lang === "uk" ? "Розпочніть диктування, щоб створити звіт." : "Start a dictation to create a report."}
                action={<button className="btn accent" onClick={() => openStudio()}><Icon name="mic" size={13} /> {lang === "uk" ? "Диктувати" : "Dictate"}</button>} />
            )}>
            {() => (
              drafts.length === 0 ? (
                <Empty icon="check" title={lang === "uk" ? "Усі звіти завершено" : "All caught up"}
                  body={lang === "uk" ? "Немає незавершених чернеток." : "No pending drafts."} />
              ) : (
                <div className="note-feed">
                  {drafts.slice(0, 5).map((r) => (
                    <ReportRow key={r.id} r={r} tpl={tplMap[r.template]} lang={lang}
                      onClick={() => navigate(openReportPath(r))} />
                  ))}
                </div>
              )
            )}
          </LoadGate>
        </section>

        <section className="panel">
          <div className="panel-h">
            <h3>{lang === "uk" ? "Останні звіти" : "Recent reports"}</h3>
            <div style={{ flex: 1 }} />
            <a className="btn ghost sm" onClick={() => navigate("/dictate/reports")}>{lang === "uk" ? "Усі" : "All"}</a>
          </div>
          <LoadGate req={reportsReq} lang={lang}
            empty={() => <Empty icon="fileText" title={lang === "uk" ? "Ще немає звітів" : "No reports yet"} />}>
            {() => (
              <div className="note-feed">
                {recent.map((r) => (
                  <ReportRow key={r.id} r={r} tpl={tplMap[r.template]} lang={lang}
                    onClick={() => navigate(openReportPath(r))} />
                ))}
              </div>
            )}
          </LoadGate>
        </section>
      </div>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-h">
          <h3>{lang === "uk" ? "Швидкий старт із шаблону" : "Quick start from a template"}</h3>
          <div style={{ flex: 1 }} />
          <a className="btn ghost sm" onClick={() => navigate("/dictate/templates")}>{lang === "uk" ? "Керувати" : "Manage"}</a>
        </div>
        <LoadGate req={templatesReq} lang={lang}
          empty={() => <Empty icon="layers" title={lang === "uk" ? "Немає шаблонів" : "No templates"} />}>
          {() => (
            <div className="grid-2" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {templates.slice(0, 6).map((t) => (
                <button key={t.id} className="card tpl-card" style={{ padding: 14, textAlign: "left", cursor: "pointer" }}
                        onClick={() => openStudio(t.id)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="tpl-icon sm"><Icon name={t.icon || "layers"} size={14} /></div>
                    <strong style={{ fontSize: 14 }}>{loc(t.name, lang)}</strong>
                  </div>
                  {(t.description || t.desc) && (
                    <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 6 }}>{loc(t.description ?? t.desc, lang)}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </LoadGate>
      </section>
    </div>
  );
}
