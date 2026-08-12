// NotificationsPage.jsx — the full notification history at /notifications.
//
// The bell dropdown is the recent slice; this is the archive. Both read
// the SAME store feed and render the same rows (NotificationList), so
// marking something read here moves the badge there, and a page loaded
// deep from this screen is already loaded when the dropdown opens.
//
// Filtering is client-side, over the pages pulled so far. The wire only
// offers `unread_only` (docs/api/notification-service-openapi.json) — no
// category or date filter — and running a second, differently-filtered
// cursor alongside the store's would mean two feeds that disagree. So
// the filters narrow what is loaded, "Load more" keeps pulling, and the
// empty state says plainly which of the two is happening.
//
// PHI note: as in the dropdown, rows show `title` / `body_text` verbatim.
// Never enrich a row by fetching the resource it points at — ADR-0031.

import React, { useEffect, useMemo, useRef, useState } from "react";

import { Icon } from "../components/UI.jsx";
import { MenuSelect } from "../components/MenuSelect.jsx";
import { NotificationList, useOpenNotification } from "../components/NotificationList.jsx";
import { tr } from "../i18n.js";
import { ALL_CATEGORIES } from "../notifications/constants.js";
import { categoryLabel } from "../notifications/labels.js";
import { useNotifications } from "../notifications/store.jsx";

export default function NotificationsPage({ lang = "uk", navigate }) {
  const n = useNotifications();
  const T = (uk, en) => tr(lang, uk, en);
  const [tab, setTab] = useState("all"); // all | unread
  const [category, setCategory] = useState("");
  const { open, unresolved } = useOpenNotification({ n, navigate });

  // One resync on arrival — the feed may be minutes stale if the socket
  // was asleep in a background tab. Ref-guarded so it does not re-fire on
  // every render the store triggers.
  const resync = n && n.resyncFromRest;
  const didResync = useRef(false);
  useEffect(() => {
    if (!resync || didResync.current) return;
    didResync.current = true;
    resync();
  }, [resync]);

  const items = n ? n.ordered : [];
  const byDay = n ? n.byDay : [];

  const counts = useMemo(() => {
    const map = new Map();
    for (const item of items) map.set(item.category, (map.get(item.category) || 0) + 1);
    return map;
  }, [items]);

  const { flat, groups } = useMemo(() => {
    const keep = (item) =>
      (tab !== "unread" || !item.read_at) && (!category || item.category === category);
    return {
      flat: items.filter(keep),
      groups: byDay
        .map((g) => ({ key: g.key, items: g.items.filter(keep) }))
        .filter((g) => g.items.length > 0),
    };
  }, [items, byDay, tab, category]);

  const header = (
    <div className="page-h">
      <div>
        <h1>{T("Сповіщення", "Notifications")}</h1>
        <p className="sub">
          {T(
            "Історія сповіщень цього облікового запису.",
            "The notification history for this account.",
          )}
        </p>
      </div>
      <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
        <button type="button" className="btn" onClick={() => navigate?.("/settings/notifications")}>
          <Icon name="sliders" size={14} />
          <span>{T("Налаштування", "Preferences")}</span>
        </button>
      </div>
    </div>
  );

  if (!n || !n.enabled) {
    return (
      <div className="page nh-page">
        {header}
        <section className="card">
          <p className="muted" style={{ margin: 0 }}>
            {T(
              "Сповіщення вимкнено в цьому середовищі.",
              "Notifications are disabled in this environment.",
            )}
          </p>
        </section>
      </div>
    );
  }

  const { loading, exhausted, error } = n.feed;
  const filtered = tab === "unread" || !!category;

  return (
    <div className="page nh-page">
      {header}

      {n.protocolMismatch && (
        <div className="nb-banner" role="alert">
          {T(
            "Версія застосунку застаріла — оновіть сторінку.",
            "This app version is out of date — please refresh.",
          )}
        </div>
      )}

      <div className="tabs nh-filters">
        <button
          type="button"
          className={`tab${tab === "all" ? " on" : ""}`}
          onClick={() => setTab("all")}
        >
          {T("Усі", "All")}
        </button>
        <button
          type="button"
          className={`tab${tab === "unread" ? " on" : ""}`}
          onClick={() => setTab("unread")}
        >
          {T("Непрочитані", "Unread")}
          {n.unreadCount > 0 && <span className="nh-count">{n.unreadCount}</span>}
        </button>

        <div className="nh-filters-right">
          <MenuSelect
            value={category}
            ariaLabel={T("Тип події", "Event type")}
            icon="filter"
            onChange={setCategory}
            options={[
              { value: "", label: T("Усі типи", "All types") },
              ...ALL_CATEGORIES.map((c) => ({
                value: c,
                label: categoryLabel(c, lang),
                // How many of this type are in the pages pulled so far —
                // not a total, so it is not presented as one.
                sub: counts.get(c) ? String(counts.get(c)) : undefined,
              })),
            ]}
          />
          <button
            type="button"
            className="btn sm"
            onClick={() => n.markAllRead()}
            disabled={n.unreadCount === 0}
          >
            <Icon name="check" size={13} />
            <span>{T("Прочитати всі", "Mark all read")}</span>
          </button>
          <button type="button" className="btn sm" onClick={() => n.resyncFromRest()} disabled={loading}>
            <Icon name="refresh" size={13} />
            <span>{T("Оновити", "Refresh")}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="nh-error card" role="alert">
          {T("Не вдалося завантажити сповіщення.", "Could not load notifications.")}{" "}
          {error.message}
        </div>
      )}

      <section className="card nh-card">
        <NotificationList
          className="nh-list"
          groups={groups}
          flat={flat}
          lang={lang}
          onOpen={open}
          onMarkRead={(id) => n.markRead(id)}
          unresolved={unresolved}
          empty={
            !loading && (
              <div className="nb-empty">
                <Icon name="bell" size={22} />
                <p>
                  {filtered
                    ? T(
                        "Серед завантажених сповіщень немає відповідних.",
                        "Nothing matches in the notifications loaded so far.",
                      )
                    : T("Сповіщень поки немає", "No notifications yet")}
                </p>
                {filtered && !exhausted && (
                  <p className="muted">
                    {T("Завантажте ще, щоб шукати далі.", "Load more to keep looking.")}
                  </p>
                )}
              </div>
            )
          }
        >
          {loading && (
            <div className="nb-loading" aria-live="polite">
              {T("Завантаження…", "Loading…")}
            </div>
          )}
        </NotificationList>

        <div className="nh-foot">
          {exhausted ? (
            flat.length > 0 && <span className="nb-end">{T("Це все", "That's everything")}</span>
          ) : (
            <button type="button" className="btn" onClick={() => n.loadMore()} disabled={loading}>
              {loading ? T("Завантаження…", "Loading…") : T("Показати ще", "Load more")}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
