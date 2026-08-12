// NotificationList.jsx — the grouped, keyboard-operable feed.
//
// Shared by the bell dropdown (NotificationPanel) and the full history
// page (pages/NotificationsPage). Both read the same store feed, so the
// row markup and the "what does opening a row mean" rule live here once
// rather than drifting between a popover and a page.
//
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

// Drawn from the existing Icon registry in UI.jsx — there is no
// `info`/`alert` glyph, and inventing one would mean editing UI.jsx,
// which carries unrelated uncommitted work. Colour does most of the
// severity signalling; the glyph is a secondary cue for users who
// cannot rely on it.
export const SEVERITY_ICON = {
  [SEVERITY.INFO]: "check",
  [SEVERITY.WARNING]: "flag",
  [SEVERITY.CRITICAL]: "shield",
};

/**
 * Opening a row: mark it read, then route to the resource it points at.
 * A category this client cannot route yet degrades visibly (the caller
 * renders the returned `unresolved` id as an inline warning) instead of
 * crashing or silently swallowing the click.
 */
export function useOpenNotification({ n, navigate, onClose }) {
  const [unresolved, setUnresolved] = useState(null);

  const open = useCallback(
    (item) => {
      if (n) n.markRead(item.id);
      const route = resolveRoute(item);
      if (!route) {
        setUnresolved(item.id);
        return;
      }
      if (navigate) navigate(route);
      if (onClose) onClose();
    },
    [n, navigate, onClose],
  );

  return { open, unresolved };
}

export function NotificationList({
  groups,
  flat,
  lang = "uk",
  onOpen,
  onMarkRead,
  unresolved = null,
  className = "nb-list",
  onScroll,
  empty = null,
  children,
}) {
  const listRef = useRef(null);
  const [focusIdx, setFocusIdx] = useState(0);

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
        if (item) onOpen(item);
      }
    },
    [flat, focusIdx, onOpen],
  );

  // Move DOM focus with the virtual cursor so the screen reader follows.
  // Only once the list already holds focus — otherwise filtering on the
  // history page would yank focus out of the filter control the user is
  // still operating.
  useEffect(() => {
    const root = listRef.current;
    if (!root) return;
    if (!root.contains(document.activeElement)) return;
    const el = root.querySelector(`[data-idx="${focusIdx}"]`);
    if (el) el.focus();
  }, [focusIdx, flat.length]);

  // A shrinking list (filter change, mark-all-read on a filtered view)
  // must not leave the cursor pointing past the end.
  useEffect(() => {
    setFocusIdx((i) => (i > 0 && i >= flat.length ? Math.max(0, flat.length - 1) : i));
  }, [flat.length]);

  return (
    <div
      className={className}
      ref={listRef}
      onScroll={onScroll}
      onKeyDown={onKeyDown}
      role="listbox"
      tabIndex={-1}
    >
      {flat.length === 0 && empty}

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
                onClick={() => onOpen(item)}
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
                      onMarkRead(item.id);
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

      {children}
    </div>
  );
}
