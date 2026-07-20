// NotificationBell.jsx — app-chrome bell + unread badge + the panel.
//
// Slots into TopBar's `right` prop (an extension point UI.jsx already
// declared but nothing used). The popover follows the account-menu
// pattern from Sidebar.jsx: a ref, mousedown-outside, and Escape.

import React, { useCallback, useEffect, useRef, useState } from "react";

import { Icon } from "./UI.jsx";
import { tr } from "../i18n.js";
import { SOCKET_STATUS } from "../notifications/constants.js";
import { useNotifications } from "../notifications/store.jsx";
import { NotificationPanel } from "./NotificationPanel.jsx";

// Past this the badge reads "99+" — an exact count in the thousands is
// noise, and a four-digit badge breaks the chrome layout.
const BADGE_CAP = 99;

export function formatBadge(count) {
  if (!count || count < 1) return null;
  return count > BADGE_CAP ? `${BADGE_CAP}+` : String(count);
}

export function NotificationBell({ lang = "uk", navigate }) {
  const notifications = useNotifications();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        // Return focus to the trigger so keyboard users are not dumped
        // at the top of the document.
        if (buttonRef.current) buttonRef.current.focus();
      }
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = useCallback(() => {
    setOpen((o) => {
      // Opening is the natural moment to reconcile: the user is about to
      // read the list, so it had better be the real one.
      if (!o && notifications) notifications.resyncFromRest();
      return !o;
    });
  }, [notifications]);

  // The provider is absent on public shells, and the feature is flagged.
  if (!notifications || !notifications.enabled) return null;

  const badge = formatBadge(notifications.unreadCount);
  const degraded =
    notifications.socketStatus === SOCKET_STATUS.RECONNECTING ||
    notifications.socketStatus === SOCKET_STATUS.CLOSED;

  const label = badge
    ? tr(lang, `Сповіщення, ${notifications.unreadCount} непрочитаних`, `Notifications, ${notifications.unreadCount} unread`)
    : tr(lang, "Сповіщення", "Notifications");

  return (
    <div className="nb-wrap" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className="icon-btn nb-btn"
        onClick={toggle}
        title={label}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Icon name="bell" size={14} />
        {badge && <span className="nb-badge">{badge}</span>}
        {degraded && (
          // Deliberately subtle: live updates are paused but nothing is
          // lost — the feed still reads correctly over REST.
          <span
            className="nb-dot"
            title={tr(lang, "Оновлення в реальному часі призупинено", "Live updates paused")}
          />
        )}
      </button>

      {open && (
        <NotificationPanel
          lang={lang}
          navigate={navigate}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
