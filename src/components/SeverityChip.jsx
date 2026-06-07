// SeverityChip.jsx — Audit event severity pill.
import React from "react";

const STYLES = {
  info:  { bg: "rgba(107,116,128,.14)", fg: "#3b4351", dot: "#9ca3af" },
  warn:  { bg: "rgba(245,158,11,.14)",  fg: "#b45309", dot: "#f59e0b" },
  sec:   { bg: "rgba(220,38,38,.14)",   fg: "#dc2626", dot: "#ef4444" },
  error: { bg: "rgba(220,38,38,.18)",   fg: "#7f1d1d", dot: "#dc2626" },
};

export function SeverityChip({ severity = "info" }) {
  const s = STYLES[severity] || STYLES.info;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 500,
      background: s.bg, color: s.fg, textTransform: "uppercase", letterSpacing: ".04em",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: s.dot }} />
      {severity}
    </span>
  );
}
