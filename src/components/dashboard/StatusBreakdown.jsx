// StatusBreakdown.jsx — horizontal stacked bar + legend, segmented by status.
// `segments` is an array of { key, label, count, color }. Zero-count segments
// are dropped from the bar but kept in the legend so the full taxonomy shows.
import React, { useMemo } from "react";

export function StatusBreakdown({ segments = [], total }) {
  const sum = useMemo(
    () => (total != null ? total : segments.reduce((s, x) => s + (x.count || 0), 0)),
    [segments, total],
  );
  return (
    <div className="status-breakdown">
      <div className="sbar" role="img" aria-label="Status breakdown">
        {sum === 0 ? (
          <span className="sbar-seg sbar-empty" style={{ width: "100%" }} />
        ) : (
          segments
            .filter((s) => (s.count || 0) > 0)
            .map((s) => (
              <span
                key={s.key}
                className="sbar-seg"
                style={{ width: `${((s.count || 0) / sum) * 100}%`, background: s.color }}
                title={`${s.label}: ${s.count}`}
              />
            ))
        )}
      </div>
      <ul className="sbar-legend">
        {segments.map((s) => (
          <li key={s.key}>
            <span className="sbar-dot" style={{ background: s.color }} />
            <span className="sbar-legend-label">{s.label}</span>
            <span className="sbar-legend-count">{s.count ?? 0}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
