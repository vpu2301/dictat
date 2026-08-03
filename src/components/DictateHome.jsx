// DictateHome.jsx — the dictation half of the workspace home page.
//
// There used to be a whole second landing here (`DictateToday`, the symmetric
// twin of ScribeToday) behind the Scribe/Dictate product switch. The switch is
// gone and so is the twin: one home page now shows the day AND the documents,
// and it assembles itself from the pieces below — the report row, its status
// chip, and the quick-start template palette.
import React, { useState, useEffect, useMemo } from 'react';
import { Icon, Empty, Modal } from './UI.jsx';
import { getUsage } from '../api/templatePrefs.js';
import { LoadGate } from './DataStates.jsx';
import { specialtyIcon } from '../api/templates.js';
import { SPECIALTIES } from './TemplatesPage.jsx';
import { tr } from "../i18n.js";

// ── Helpers (mirrors Scribe.jsx / Reports.jsx conventions) ────────────────
function loc(v, lang) {
  if (v == null) return "";
  if (typeof v === "object") return v[lang] ?? v.en ?? Object.values(v)[0] ?? "";
  return v;
}
function fmtDate(iso, lang) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(tr(lang, "uk-UA", "en-GB"), { day: "2-digit", month: "short", year: "numeric" });
}
function fmtRel(iso, lang) {
  if (!iso) return "";
  const d = new Date(iso);
  const diffMin = Math.floor((Date.now() - d) / 60000);
  if (diffMin < 1) return tr(lang, "щойно", "just now");
  if (diffMin < 60) return lang === "uk" ? `${diffMin} хв тому` : `${diffMin} min ago`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return lang === "uk" ? `${h} год тому` : `${h} h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return lang === "uk" ? `${days} дн. тому` : `${days} d ago`;
  return fmtDate(iso, lang);
}
export const reportModified = (r) => r.modified || r.modified_at || r.updated_at || r.created_at;

function specialtyLabel(spec, lang) {
  const row = SPECIALTIES.find((s) => s[0] === spec);
  return row ? (lang === "uk" ? row[1] : row[2]) : (spec || "");
}

export function StatusChip({ status, lang }) {
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
export function ReportRow({ r, tpl, lang, onClick }) {
  return (
    <div className="note-row" onClick={onClick}>
      <div className="tpl-icon sm"><Icon name={tpl?.icon || "fileText"} size={14} /></div>
      <div className="note-row-body">
        <div className="note-row-1">
          <span className="note-row-name">{loc(r.patient?.name, lang) || r.patient?.ref || (tr(lang, "Без пацієнта", "No patient"))}</span>
          {/* Fall back to the report code, never the raw template UUID: a
              template the library no longer returns (deprecated, deleted)
              used to print its id into the row. */}
          <span className="chip">{loc(tpl?.name, lang) || r.code || tr(lang, "Звіт", "Report")}</span>
          <StatusChip status={r.status} lang={lang} />
        </div>
        <div className="note-row-2">{fmtRel(reportModified(r), lang)}</div>
      </div>
      <Icon name="chevRight" size={14} />
    </div>
  );
}

// ── Quick-start palette ─────────────────────────────────────────────────────
// Command-palette style: search on top, most-used templates underneath
// (usage counts from templatePrefs — the same source the Studio records to).
// ArrowUp/Down + Enter drive the selection; Esc closes (Modal handles it).
export function QuickStartModal({ templates, req, lang, onPick, onManage, onClose }) {
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
      ...(top.length ? [{ label: tr(lang, "Найчастіше використовувані", "Most used"), items: top }] : []),
      ...(rest.length ? [{ label: tr(lang, "Усі шаблони", "All templates"), items: rest }] : []),
    ];
  } else {
    groups = [{ label: tr(lang, "Результати", "Results"), items: filtered }];
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
          placeholder={tr(lang, "Пошук шаблону…", "Search templates…")}
          aria-label={tr(lang, "Пошук шаблону", "Search templates")}
        />
        <button className="icon-btn" onClick={onClose} aria-label={tr(lang, "Закрити", "Close")}>
          <Icon name="x" size={14} />
        </button>
      </div>
      <div className="qs-modal-body">
        <LoadGate req={req} lang={lang}
          empty={() => <Empty icon="layers" title={tr(lang, "Немає шаблонів", "No templates")} />}>
          {() => (
            flat.length === 0 ? (
              <Empty icon="search" title={tr(lang, "Нічого не знайдено", "No matches")}
                body={tr(lang, "Спробуйте іншу назву або код шаблону.", "Try a different name or template code.")} />
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
          {tr(lang, "Керувати шаблонами", "Manage templates")}
        </a>
      </div>
    </Modal>
  );
}
