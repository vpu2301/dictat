// studio/StudioHistoryPage.jsx — the whole work list, in full.
//
// The sidebar shows the last few dozen things you have going, in a 248px
// column: enough to get back to this morning's draft, not enough to answer
// "what did I record on the 24th, and did it ever become a report?". This is
// that view — same four sources, same merge, but with the room to say what each
// row IS: kind, patient, state, when.
//
// It opens in a NEW BROWSER TAB from the sidebar, on purpose. Looking something
// up in your own history is a side errand; it should not cost you the document
// you were dictating.

import React, { useMemo, useState } from "react";

import { Icon, Empty } from "../components/UI.jsx";
import { ApiErrorView } from "../components/ApiErrorView.jsx";
import { tr } from "../i18n.js";
import { useStudioSessions } from "./useStudioSessions.js";
import { sessionParams, studioHref, statusTone, statusLabel } from "./sessions.js";

export const HISTORY_PATH = "/studio/history";

const KIND_META = {
  report:  { icon: "fileText", label: (l) => tr(l, "Звіт", "Report") },
  note:    { icon: "edit",     label: (l) => tr(l, "Нотатка", "Note") },
  dictate: { icon: "waveform", label: (l) => tr(l, "Запис", "Recording") },
  asr:     { icon: "audio",    label: (l) => tr(l, "Аудіо", "Audio") },
};

const FILTERS = ["all", "report", "note", "dictate", "asr"];

function fmtWhen(iso, lang) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const locale = lang === "uk" ? "uk-UA" : lang;
  return d.toLocaleString(locale, {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export function StudioHistoryPage({ lang = "uk", navigate }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  // A history view reaches further back than the rail's working set.
  const sessions = useStudioSessions({ lang, query, limit: 200 });

  const groups = useMemo(() => (
    kind === "all"
      ? sessions.groups
      : sessions.groups
          .map((g) => ({ ...g, items: g.items.filter((i) => i.kind === kind) }))
          .filter((g) => g.items.length)
  ), [sessions.groups, kind]);

  const total = useMemo(
    () => groups.reduce((n, g) => n + g.items.length, 0),
    [groups],
  );

  const open = (item) => {
    const next = sessionParams(item);
    if (next) navigate(studioHref(next));
  };

  return (
    <div className="page sh" data-testid="studio-history">
      <div className="page-h">
        <div>
          <h1>{tr(lang, "Історія сесій", "Session history")}</h1>
          <p className="sub">
            {tr(lang,
              "Усе, що ви записали, продиктували чи завантажили — звіти, нотатки, записи та аудіо в одному списку.",
              "Everything you recorded, dictated or uploaded — reports, notes, recordings and audio in one list.")}
          </p>
        </div>
        <div className="sh-tools">
          <div className="search-input">
            <Icon name="search" size={14} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tr(lang, "Пацієнт, назва, ID…", "Patient, title, ID…")}
              aria-label={tr(lang, "Пошук в історії", "Search history")}
            />
          </div>
          <button className="btn" onClick={sessions.reload} disabled={sessions.loading}>
            <Icon name="refresh" size={13} />
            <span>{tr(lang, "Оновити", "Refresh")}</span>
          </button>
        </div>
      </div>

      <div className="sh-filters" role="tablist" aria-label={tr(lang, "Тип документа", "Document kind")}>
        {FILTERS.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            className={`sh-filter${kind === k ? " on" : ""}`}
            data-testid={`sh-filter-${k}`}
            onClick={() => setKind(k)}
          >
            {k !== "all" && <Icon name={KIND_META[k].icon} size={12} />}
            {k === "all" ? tr(lang, "Усі", "All") : KIND_META[k].label(lang)}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <span className="sh-count">
          {total} {tr(lang, "записів", "items")}
        </span>
      </div>

      {/* One source down does not empty the page — the rows that loaded stay,
          and the gap is named. */}
      {sessions.failed.length > 0 && (
        <div className="asr-banner asr-banner-warn" role="status" style={{ marginBottom: 12 }}>
          <Icon name="alert" size={13} />
          <span>
            {tr(lang, "Частина списку недоступна: ", "Part of the list is unavailable: ")}
            {sessions.failed.map((f) => KIND_META[f.key]?.label(lang) || f.key).join(", ")}
          </span>
          <button className="btn ghost sm" onClick={sessions.reload}>
            {tr(lang, "Ще раз", "Retry")}
          </button>
        </div>
      )}

      {sessions.loading && <div className="sh-msg">{tr(lang, "Завантаження…", "Loading…")}</div>}

      {!sessions.loading && total === 0 && (
        <Empty
          icon="history"
          title={query || kind !== "all"
            ? tr(lang, "Нічого не знайдено", "Nothing found")
            : tr(lang, "Історія порожня", "No history yet")}
          body={query || kind !== "all"
            ? tr(lang, "Спробуйте інший запит або тип документа.", "Try another query or another kind.")
            : tr(lang, "Тут з'являться ваші записи, чернетки та завантаження.",
                       "Your recordings, drafts and uploads appear here.")}
        />
      )}

      {groups.map((g) => (
        <section key={g.key} className="sh-group">
          <h2 className="sh-group-h">{g.label} <span>{g.items.length}</span></h2>
          <div className="sh-table" role="table">
            <div className="sh-row sh-head" role="row">
              <span>{tr(lang, "Тип", "Kind")}</span>
              <span>{tr(lang, "Документ", "Document")}</span>
              <span>{tr(lang, "Пацієнт", "Patient")}</span>
              <span>{tr(lang, "Стан", "State")}</span>
              <span>{tr(lang, "Коли", "When")}</span>
            </div>
            {g.items.map((it) => (
              <button
                key={it.key}
                type="button"
                className="sh-row"
                role="row"
                data-kind={it.kind}
                data-testid="sh-row"
                onClick={() => open(it)}
              >
                <span className="sh-kind">
                  <i className="sh-kind-mark" data-kind={it.kind}>
                    <Icon name={KIND_META[it.kind]?.icon || "fileText"} size={12} />
                  </i>
                  {KIND_META[it.kind]?.label(lang) || it.kind}
                </span>
                <span className="sh-title">
                  {it.title}
                  {it.subtitle && <em>{it.subtitle}</em>}
                </span>
                <span className="sh-patient">{it.patientName || "—"}</span>
                <span>
                  <span className="sh-status" data-tone={statusTone(it)}>{statusLabel(it, lang)}</span>
                </span>
                <span className="sh-when">{fmtWhen(it.at, lang)}</span>
              </button>
            ))}
          </div>
        </section>
      ))}

      {sessions.failed.length > 0 && sessions.failed[0].error && (
        <div style={{ marginTop: 16 }}>
          <ApiErrorView error={sessions.failed[0].error} lang={lang} />
        </div>
      )}
    </div>
  );
}
