// NotificationPanel.jsx — the dropdown feed.
//
// Unread-first, grouped by day, infinite scroll on the REST cursor. The
// rows themselves live in NotificationList.jsx, shared with the full
// history page at /notifications — the dropdown is the recent slice, the
// page is the archive, and they must not drift.

import React, { useCallback } from "react";

import { Icon } from "./UI.jsx";
import { tr } from "../i18n.js";
import { NotificationList, useOpenNotification } from "./NotificationList.jsx";
import { useNotifications } from "../notifications/store.jsx";

export function NotificationPanel({ lang = "uk", navigate, onClose }) {
  const n = useNotifications();
  const { open, unresolved } = useOpenNotification({ n, navigate, onClose });

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

  const go = useCallback(
    (path) => {
      if (navigate) navigate(path);
      if (onClose) onClose();
    },
    [navigate, onClose],
  );

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
          onClick={() => go("/settings/notifications")}
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

      <NotificationList
        groups={groups}
        flat={flat}
        lang={lang}
        onOpen={open}
        onMarkRead={(id) => n.markRead(id)}
        unresolved={unresolved}
        onScroll={onScroll}
        empty={
          empty && (
            <div className="nb-empty">
              <Icon name="bell" size={22} />
              <p>{tr(lang, "Сповіщень поки немає", "No notifications yet")}</p>
            </div>
          )
        }
      >
        {n.feed.loading && (
          <div className="nb-loading" aria-live="polite">
            {tr(lang, "Завантаження…", "Loading…")}
          </div>
        )}
        {!n.feed.loading && n.feed.exhausted && flat.length > 0 && (
          <div className="nb-end">{tr(lang, "Це все", "That's everything")}</div>
        )}
      </NotificationList>

      {/* The way out of the popover: the dropdown only ever holds the
          pages already pulled, so the archive needs its own door. */}
      <div className="nb-panel-foot">
        <button type="button" className="nb-all" onClick={() => go("/notifications")}>
          <span>{tr(lang, "Усі сповіщення", "See all notifications")}</span>
          <Icon name="arrowRight" size={14} />
        </button>
      </div>
    </div>
  );
}
