// Panel.jsx — shared dashboard panel shell + per-panel state helper.
// One panel failing must not blank the others, so every panel renders its own
// loading / error / empty state inside this shell.
import React from "react";
import { Icon } from "../UI.jsx";
import { tr } from "../../i18n.js";

export function Panel({ title, icon, sub, gapNote, children }) {
  return (
    <section className="dash-panel">
      <header className="dash-panel-h">
        {icon && <span className="dash-panel-icon"><Icon name={icon} size={15} /></span>}
        <h2>{title}</h2>
        {sub && <span className="dash-panel-sub">{sub}</span>}
      </header>
      {gapNote && <div className="dash-gap-note">{gapNote}</div>}
      {children}
    </section>
  );
}

// Renders loading / error / empty fallbacks; returns null when there is real
// content to show (the caller renders that). `isEmpty` is caller-decided.
export function PanelState({ loading, error, isEmpty, onRetry, lang, loadingText, emptyText }) {
  if (loading) {
    return <div className="dash-panel-loading">{loadingText || (tr(lang, "Завантаження…", "Loading…"))}</div>;
  }
  if (error) {
    return (
      <div className="dash-panel-error">
        <span>{error.message || (tr(lang, "Помилка завантаження", "Failed to load"))}</span>
        {onRetry && (
          <button className="dash-retry" onClick={onRetry}>
            {tr(lang, "Повторити", "Retry")}
          </button>
        )}
      </div>
    );
  }
  if (isEmpty) {
    return <div className="dash-panel-empty">{emptyText || (tr(lang, "Немає даних", "No data"))}</div>;
  }
  return null;
}
