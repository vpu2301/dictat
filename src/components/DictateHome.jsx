// DictateHome.jsx — Dictate product landing ("overview"), the symmetric twin of
// ScribeToday. Switching to the Dictate product (sidebar tab) lands here instead
// of dropping straight into the recording Studio: the clinician sees their work
// (draft reports to finish, recent reports, quick starts) before recording.
import React, { useState, useEffect, useMemo } from 'react';
import { Icon, Empty, Modal } from './UI.jsx';
import { getUsage } from '../api/templatePrefs.js';
import { LoadGate, asList } from './DataStates.jsx';
import { useAsync } from '../api/useAsync.js';
import { useClaims } from '../auth/AuthContext.jsx';
import { listReports, countReports } from '../api/reports.js';
import { openReportPath } from './Reports.jsx';
import { listTemplates, specialtyIcon } from '../api/templates.js';
import { SPECIALTIES } from './TemplatesPage.jsx';

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

function specialtyLabel(spec, lang) {
  const row = SPECIALTIES.find((s) => s[0] === spec);
  return row ? (lang === "uk" ? row[1] : row[2]) : (spec || "");
}

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
  const [qsOpen, setQsOpen] = useState(false);

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
        <button className="btn" onClick={() => setQsOpen(true)}>
          <Icon name="layers" size={14} /> {lang === "uk" ? "Швидкий старт" : "Quick start"}
        </button>
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

      {qsOpen && (
        <QuickStartModal
          templates={templates}
          req={templatesReq}
          lang={lang}
          onPick={(tid) => { setQsOpen(false); openStudio(tid); }}
          onManage={() => { setQsOpen(false); navigate("/dictate/templates"); }}
          onClose={() => setQsOpen(false)}
        />
      )}
    </div>
  );
}

// ── Quick-start palette ─────────────────────────────────────────────────────
// Command-palette style: search on top, most-used templates underneath
// (usage counts from templatePrefs — the same source the Studio records to).
// ArrowUp/Down + Enter drive the selection; Esc closes (Modal handles it).
function QuickStartModal({ templates, req, lang, onPick, onManage, onClose }) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const usage = useMemo(() => getUsage(), []);

  const norm = (s) => String(s || "").toLowerCase();
  const query = norm(q.trim());
  const filtered = templates.filter((t) =>
    !query ||
    norm(loc(t.name, "uk")).includes(query) ||
    norm(loc(t.name, "en")).includes(query) ||
    norm(t.code).includes(query) ||
    norm(specialtyLabel(t.specialty, lang)).includes(query),
  );

  let groups;
  if (!query) {
    const top = [...templates]
      .filter((t) => (usage[t.id] || 0) > 0)
      .sort((a, b) => (usage[b.id] || 0) - (usage[a.id] || 0))
      .slice(0, 4);
    const topIds = new Set(top.map((t) => t.id));
    const rest = templates.filter((t) => !topIds.has(t.id));
    groups = [
      ...(top.length ? [{ label: lang === "uk" ? "Найчастіше використовувані" : "Most used", items: top }] : []),
      ...(rest.length ? [{ label: lang === "uk" ? "Усі шаблони" : "All templates", items: rest }] : []),
    ];
  } else {
    groups = [{ label: lang === "uk" ? "Результати" : "Results", items: filtered }];
  }
  const flat = groups.flatMap((g) => g.items);

  useEffect(() => { setIdx(0); }, [q]);
  useEffect(() => {
    document.getElementById(`qs-opt-${idx}`)?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, flat.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && flat[idx]) { e.preventDefault(); onPick(flat[idx].id); }
  };

  return (
    <Modal onClose={onClose}>
      <div className="qs-search">
        <Icon name="search" size={16} className="qs-search-icon" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={lang === "uk" ? "Пошук шаблону…" : "Search templates…"}
          aria-label={lang === "uk" ? "Пошук шаблону" : "Search templates"}
        />
        <button className="icon-btn" onClick={onClose} aria-label={lang === "uk" ? "Закрити" : "Close"}>
          <Icon name="x" size={14} />
        </button>
      </div>
      <div className="qs-modal-body">
        <LoadGate req={req} lang={lang}
          empty={() => <Empty icon="layers" title={lang === "uk" ? "Немає шаблонів" : "No templates"} />}>
          {() => (
            flat.length === 0 ? (
              <Empty icon="search" title={lang === "uk" ? "Нічого не знайдено" : "No matches"}
                body={lang === "uk" ? "Спробуйте іншу назву або код шаблону." : "Try a different name or template code."} />
            ) : (
              groups.map((g) => (
                <div key={g.label} className="qs-group">
                  <div className="qs-group-label">{g.label}</div>
                  {g.items.map((t) => {
                    const i = flat.indexOf(t);
                    return (
                      <button key={t.id} id={`qs-opt-${i}`}
                              className={"qs-card" + (i === idx ? " active" : "")}
                              onMouseEnter={() => setIdx(i)}
                              onClick={() => onPick(t.id)}>
                        <div className="tpl-card-icon"><Icon name={specialtyIcon(t.specialty)} size={18} /></div>
                        <div className="qs-card-meta">
                          <div className="tpl-card-name">{loc(t.name, lang)}</div>
                          <div className="qs-card-sub">
                            {t.code && <span className="chip">{t.code}</span>}
                            <span>{specialtyLabel(t.specialty, lang)}</span>
                          </div>
                        </div>
                        <span className="qs-card-go"><Icon name="mic" size={14} /></span>
                      </button>
                    );
                  })}
                </div>
              ))
            )
          )}
        </LoadGate>
      </div>
      <div className="modal-f">
        <span className="qs-hint muted">↑↓ · Enter</span>
        <div style={{ flex: 1 }} />
        <a className="btn ghost sm" onClick={onManage}>
          {lang === "uk" ? "Керувати шаблонами" : "Manage templates"}
        </a>
      </div>
    </Modal>
  );
}
