// AsrStatusPill.jsx — Status pill for ASR jobs (queued/running/complete/failed/cancelled).
import React from "react";

const STYLES = {
  queued:    { bg: "rgba(107,116,128,.14)", fg: "#3b4351", dot: "#9ca3af", labelUk: "У черзі",     labelEn: "Queued" },
  running:   { bg: "rgba(37,99,235,.14)",   fg: "#1d4ed8", dot: "#2563eb", labelUk: "Виконується", labelEn: "Running" },
  complete:  { bg: "rgba(4,120,87,.12)",    fg: "#047857", dot: "#10b981", labelUk: "Готово",      labelEn: "Complete" },
  failed:    { bg: "rgba(220,38,38,.14)",   fg: "#7f1d1d", dot: "#dc2626", labelUk: "Помилка",     labelEn: "Failed" },
  cancelled: { bg: "rgba(180,83,9,.12)",    fg: "#b45309", dot: "#f59e0b", labelUk: "Скасовано",   labelEn: "Cancelled" },
};

export function AsrStatusPill({ status, lang = "en" }) {
  const s = STYLES[status] || STYLES.queued;
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 500,
        background: s.bg, color: s.fg, lineHeight: 1.5,
      }}
      title={status}
    >
      <span
        style={{
          width: 6, height: 6, borderRadius: 999, background: s.dot,
          animation: status === "running" ? "asrPulse 1.4s ease-in-out infinite" : "none",
        }}
      />
      {lang === "uk" ? s.labelUk : s.labelEn}
    </span>
  );
}
