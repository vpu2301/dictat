// NotificationPanel.jsx — the dropdown feed.
//
// Unread-first, grouped by day, infinite scroll on the REST cursor.
// Keyboard-operable end to end: arrow keys move between rows, Enter
// opens, and the list is a role="listbox" so a screen reader announces
// position.
//
// PHI note: rows render `title` / `body_text` EXACTLY as received. The
// backend guarantees those are pointers (a report code + a link), never
// content — ADR-0031. This component must never fetch the underlying
// resource to enrich a row, which would pull PHI into the chrome.

import React, { useCallback, useEffect, useRef, useState } from "react";

import { Icon } from "./UI.jsx";
import { tr } from "../i18n.js";
import { SEVERITY } from "../notifications/constants.js";
import { resolveRoute } from "../notifications/deepLink.js";
import { dayLabel, relativeTime } from "../notifications/relativeTime.js";
import { useNotifications } from "../notifications/store.jsx";

// Drawn from the existing Icon registry in UI.jsx — there is no
// `info`/`alert` glyph, and inventing one would mean editing UI.jsx,
// which carries unrelated uncommitted work. Colour does most of the
// severity signalling; the glyph is a secondary cue for users who
// cannot rely on it.
const SEVERITY_ICON = {
  [SEVERITY.INFO]: "check",
  [SEVERITY.WARNING]: "flag",
  [SEVERITY.CRITICAL]: "shield",
};

export function NotificationPanel({ lang = "uk", navigate, onClose }) {
  const n = useNotifications();
  const listRef = useRef(null);
  const [focusIdx, setFocusIdx] = useState(0);
  const [unresolved, setUnresolved] = useState(null);

  const groups = n ? n.byDay : [];
  const flat = n ? n.ordered : [];

  // Infinite scroll: load the next page when the sentinel nears view.
  const onScroll = useCallback(
    (e) => {
      const el = e.currentTarget;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) {
        n.loadMore();
      }
    },
    [n],
  );

  const open = useCallback(
    (item) => {
      n.markRead(item.id);
      const route = resolveRoute(item);
      if (!route) {
        // Unknown resource type — a newer backend category this client
        // does not route yet. Degrade visibly instead of crashing or
        // silently swallowing the click.
        setUnresolved(item.id);
        return;
      }
      if (navigate) navigate(route);
      if (onClose) onClose();
    },
    [n, navigate, onClose],
  );

  const onKeyDown = useCallback(
    (e) => {
      if (!flat.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIdx((i) => Math.min(flat.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "Home") {
        e.preventDefault();
        setFocusIdx(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setFocusIdx(flat.length - 1);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const item = flat[focusIdx];
        if (item) open(item);
      }
    },
    [flat, focusIdx, open],
  );

  // Move DOM focus with the virtual cursor so the screen reader follows.
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${focusIdx}"]`);
    if (el) el.focus();
  }, [focusIdx, flat.length]);

  if (!n) return null;

  const empty = !n.feed.loading && flat.length === 0;

  return (
    <div
      className="nb-panel"
      role="dialog"
      aria-label={tr(lang, "Сповіщення", "Notifications")}
    >
      <div className="nb-panel-head">
        <strong>{tr(lang, "Сповіщення", "Notifications")}</strong>
        <div style={{ flex: 1 }} />
        {n.unreadCount > 0 && (
          <button type="button" className="nb-link" onClick={() => n.markAllRead()}>
            {tr(lang, "Прочитати всі", "Mark all read")}
          </button>
        )}
        <button
          type="button"
          className="nb-link"
          onClick={() => {
            if (navigate) navigate("/settings/notifications");
            if (onClose) onClose();
          }}
          title={tr(lang, "Налаштування сповіщень", "Notification settings")}
        >
          {/* Same glyph the sidebar uses for Settings, so the jump to
              /settings/notifications reads as the same destination. */}
          <Icon name="sliders" size={13} />
        </button>
      </div>

      {n.protocolMismatch && (
        <div className="nb-banner" role="alert">
          {tr(
            lang,
            "Версія застосунку застаріла — оновіть сторінку.",
            "This app version is out of date — please refresh.",
          )}
        </div>
      )}

      <div className="nb-list" ref={listRef} onScroll={onScroll} onKeyDown={onKeyDown} role="listbox" tabIndex={-1}>
        {empty && (
          <div className="nb-empty">
            <Icon name="bell" size={22} />
            <p>{tr(lang, "Сповіщень поки немає", "No notifications yet")}</p>
          </div>
        )}

        {groups.map((group) => (
          <section key={group.key} className="nb-group">
            <h4 className="nb-day">{dayLabel(group.key, lang)}</h4>
            {group.items.map((item) => {
              const idx = flat.indexOf(item);
              return (
                <div
                  key={item.id}
                  data-idx={idx}
                  role="option"
                  aria-selected={idx === focusIdx}
                  tabIndex={idx === focusIdx ? 0 : -1}
                  className={`nb-row${item.read_at ? "" : " unread"} sev-${item.severity}`}
                  onClick={() => open(item)}
                >
                  <span className={`nb-sev sev-${item.severity}`} aria-hidden="true">
                    <Icon name={SEVERITY_ICON[item.severity] || "check"} size={14} />
                  </span>
                  <span className="nb-body">
                    <span className="nb-title">{item.title}</span>
                    {item.body_text && <span className="nb-text">{item.body_text}</span>}
                    <span className="nb-time">{relativeTime(item.created_at, lang)}</span>
                    {unresolved === item.id && (
                      <span className="nb-warn" role="alert">
                        {tr(
                          lang,
                          "Це сповіщення не має екрана в цій версії.",
                          "This notification has no screen in this version.",
                        )}
                      </span>
                    )}
                  </span>
                  {!item.read_at && (
                    <button
                      type="button"
                      className="nb-mark"
                      title={tr(lang, "Позначити прочитаним", "Mark read")}
                      aria-label={tr(lang, "Позначити прочитаним", "Mark read")}
                      onClick={(e) => {
                        e.stopPropagation();
                        n.markRead(item.id);
                      }}
                    >
                      <span className="nb-unread-dot" />
                    </button>
                  )}
                </div>
              );
            })}
          </section>
        ))}

        {n.feed.loading && (
          <div className="nb-loading" aria-live="polite">
            {tr(lang, "Завантаження…", "Loading…")}
          </div>
        )}
        {!n.feed.loading && n.feed.exhausted && flat.length > 0 && (
          <div className="nb-end">{tr(lang, "Це все", "That's everything")}</div>
        )}
      </div>
    </div>
  );
}
