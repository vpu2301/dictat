// studio/SidebarSessions.jsx — the clinician's work list, in the app sidebar.
//
// Same list the Studio used to keep in its own second rail, moved to where a
// chat app keeps its conversations: under the navigation, always there,
// scrolling on its own. Two things follow from the move — the workspace gets
// the full width for the document, and the list stays reachable from the
// patient roster, the documents page and everywhere else, so "back to what I
// was dictating" is one click from any screen.
//
// It refreshes on its own (mount, and whenever anything creates a session) via
// the `mdx:sessions-changed` event: the sidebar and the workspace are siblings
// with no shared parent state, and a window event is the honest way to say
// "the list you are showing is stale" without threading a store through the
// whole app.

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { Icon } from "../components/UI.jsx";
import { tr } from "../i18n.js";
import { useStudioSessions } from "./useStudioSessions.js";
import { sessionParams, studioHref, statusTone, statusLabel } from "./sessions.js";
import { HISTORY_PATH } from "./StudioHistoryPage.jsx";

export const SESSIONS_CHANGED = "mdx:sessions-changed";
export function notifySessionsChanged() {
  try { window.dispatchEvent(new CustomEvent(SESSIONS_CHANGED)); } catch {}
}

const KIND_ICON = { report: "fileText", note: "edit", dictate: "waveform", asr: "audio" };

function fmtWhen(iso, lang) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const locale = lang === "uk" ? "uk-UA" : lang;
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString(locale, { day: "numeric", month: "short" });
}

// Which row the current route is on. The workspace keeps its whole context in
// the hash query, so the highlight comes from the URL rather than from state
// the sidebar would have to be told about.
function activeKeyOf(route) {
  const q = new URLSearchParams((route || "").split("?")[1] || "");
  if (q.get("report")) return `report:${q.get("report")}`;
  if (q.get("job")) return `asr:${q.get("job")}`;
  if (q.get("session")) return `dictate:${q.get("session")}`;
  if (q.get("note")) return `note:${q.get("note")}`;
  return null;
}

export function SidebarSessions({ route, navigate, lang = "uk", limit = 40 }) {
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const sessions = useStudioSessions({ lang, query, limit });
  const { reload } = sessions;

  useEffect(() => {
    const onChanged = () => reload();
    window.addEventListener(SESSIONS_CHANGED, onChanged);
    return () => window.removeEventListener(SESSIONS_CHANGED, onChanged);
  }, [reload]);

  const activeKey = useMemo(() => activeKeyOf(route), [route]);
  const total = useMemo(
    () => sessions.groups.reduce((n, g) => n + g.items.length, 0),
    [sessions.groups],
  );

  const open = useCallback((item) => {
    const next = sessionParams(item);
    if (next) navigate(studioHref(next));
  }, [navigate]);

  return (
    <div className="sb-sessions" data-testid="sidebar-sessions">
      <div className="sb-sessions-h">
        <span className="sb-sessions-t">{tr(lang, "Сесії", "Sessions")}</span>
        {total > 0 && <span className="sb-sessions-n">{total}</span>}
        <div style={{ flex: 1 }} />
        <button
          type="button"
          className={`icon-btn sm${searchOpen ? " on" : ""}`}
          aria-label={tr(lang, "Пошук сесій", "Search sessions")}
          aria-pressed={searchOpen}
          onClick={() => {
            const next = !searchOpen;
            setSearchOpen(next);
            if (!next) setQuery("");
          }}
        >
          <Icon name="search" size={13} />
        </button>
        {/* The full history, in a new BROWSER tab: looking something up is a
            side errand and must not cost the clinician the document they are
            dictating. A real <a target="_blank"> so the browser's own "open in
            new tab / new window" gestures work too. */}
        <a
          className="icon-btn sm"
          href={`#${HISTORY_PATH}`}
          target="_blank"
          rel="noopener noreferrer"
          title={tr(lang, "Уся історія — у новій вкладці", "Full history — in a new tab")}
          aria-label={tr(lang, "Відкрити всю історію в новій вкладці", "Open the full history in a new tab")}
          data-testid="sb-sessions-history"
        >
          <Icon name="external" size={13} />
        </a>
      </div>

      {searchOpen && (
        <div className="sb-sessions-search">
          <Icon name="search" size={12} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr(lang, "Пацієнт, назва…", "Patient, title…")}
            aria-label={tr(lang, "Пошук сесій", "Search sessions")}
          />
        </div>
      )}

      <div className="sb-sessions-list">
        {sessions.loading && (
          <div className="sb-sessions-msg">{tr(lang, "Завантаження…", "Loading…")}</div>
        )}
        {!sessions.loading && total === 0 && (
          <div className="sb-sessions-msg">
            {query
              ? tr(lang, "Нічого не знайдено", "Nothing found")
              : tr(lang, "Тут з'являться ваші записи та чернетки.", "Your recordings and drafts appear here.")}
          </div>
        )}

        {sessions.groups.map((g) => (
          <section key={g.key}>
            <div className="sb-sessions-grp">{g.label}</div>
            {g.items.map((it) => (
              <button
                key={it.key}
                type="button"
                className={`sb-session${activeKey === it.key ? " on" : ""}`}
                data-testid="studio-session-row"
                data-kind={it.kind}
                title={`${it.title}${it.subtitle ? ` · ${it.subtitle}` : ""} · ${statusLabel(it, lang)}`}
                onClick={() => open(it)}
              >
                <Icon name={KIND_ICON[it.kind] || "fileText"} size={13} className="sb-session-i" />
                <span className="sb-session-t">{it.title}</span>
                <span className="sb-session-when">{fmtWhen(it.at, lang)}</span>
                <i className="sb-session-dot" data-tone={statusTone(it)} aria-hidden="true" />
              </button>
            ))}
          </section>
        ))}

        {sessions.failed.length > 0 && (
          <button type="button" className="sb-sessions-fail" onClick={reload}>
            <Icon name="alert" size={12} />
            <span>{tr(lang, "Частина списку недоступна", "Part of the list is unavailable")}</span>
          </button>
        )}
      </div>
    </div>
  );
}
