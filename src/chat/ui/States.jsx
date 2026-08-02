// chat/ui/States.jsx — loading / empty / error, panel-scoped.
//
// Every one of these renders INSIDE the module's own box. No fixed positioning,
// no viewport-sized overlay, no full-page takeover: the host owns the page, and
// a feature that blanks the whole screen because one list failed is a feature
// that broke its host (§5).

import React from "react";
import { Icon } from "./Icon.jsx";
import { t } from "../i18n.js";

export function LoadingSkeleton({ variant = "block", rows = 3, className = "" }) {
  if (variant === "list") {
    return (
      <div className={`ec-skel-list ${className}`} aria-busy="true" aria-live="polite">
        {Array.from({ length: rows }, (_, i) => (
          <div className="ec-skel-listrow" key={i}>
            <div className="ec-skel ec-skel-dot" />
            <div style={{ flex: 1 }}>
              <div className="ec-skel" style={{ width: `${72 - i * 9}%`, height: 12 }} />
              <div className="ec-skel" style={{ width: "30%", height: 10, marginTop: 8 }} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (variant === "cards") {
    return (
      <div className={`ec-skel-cards ${className}`} aria-busy="true" aria-live="polite">
        {Array.from({ length: rows }, (_, i) => (
          <div className="ec-skel-card" key={i}>
            <div className="ec-skel" style={{ width: "70%", height: 12 }} />
            <div className="ec-skel" style={{ width: "40%", height: 10, marginTop: 10 }} />
            <div className="ec-skel" style={{ width: "90%", height: 10, marginTop: 10 }} />
          </div>
        ))}
      </div>
    );
  }
  return <div className={`ec-skel ${className}`} style={{ height: 14 }} aria-busy="true" />;
}

export function EmptyState({ icon = "message", title, body, action, compact = false }) {
  return (
    <div className={`ec-state${compact ? " ec-state-compact" : ""}`}>
      <span className="ec-state-mark"><Icon name={icon} size={compact ? 16 : 20} /></span>
      <h3 className="ec-state-title">{title}</h3>
      {body && <p className="ec-state-body">{body}</p>}
      {action && <div className="ec-state-actions">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, locale = "en", title, compact = false }) {
  const status = error?.status ? ` (${error.status})` : "";
  return (
    <div className={`ec-state ec-state-error${compact ? " ec-state-compact" : ""}`} role="alert">
      <span className="ec-state-mark"><Icon name="alert" size={compact ? 16 : 20} /></span>
      <h3 className="ec-state-title">
        {title || t(locale, "Не вдалося завантажити", "Couldn’t load this")}
      </h3>
      <p className="ec-state-body">
        {(error?.message || t(locale, "Невідома помилка", "Unknown error")) + status}
      </p>
      {onRetry && (
        <div className="ec-state-actions">
          <button type="button" className="ec-btn" onClick={onRetry}>
            <Icon name="refresh" size={13} />
            <span>{t(locale, "Спробувати ще раз", "Try again")}</span>
          </button>
        </div>
      )}
    </div>
  );
}
