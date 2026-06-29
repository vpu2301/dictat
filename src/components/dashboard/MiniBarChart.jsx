// MiniBarChart.jsx — dependency-free inline-SVG bar chart ("activity by day").
// `data` is an array of { key, label?, count } (or { value }). Hover shows the
// per-bar value via a native <title>.
import React, { useMemo } from "react";

export function MiniBarChart({ data = [], height = 64, gap = 2, formatLabel }) {
  const bars = useMemo(
    () => data.map((d) => ({
      value: typeof d === "number" ? d : (d.value ?? d.count ?? 0),
      key: d.key,
      date: d.date,
    })),
    [data],
  );
  const max = Math.max(...bars.map((b) => b.value), 1);

  if (bars.length === 0) {
    return <div className="minibar-empty" aria-hidden="true" />;
  }
  return (
    <div className="minibar" style={{ height }} role="img" aria-label="Activity by day">
      {bars.map((b, i) => {
        const h = max ? Math.max(b.value > 0 ? 3 : 1, (b.value / max) * (height - 4)) : 1;
        const tip = formatLabel ? formatLabel(b) : `${b.key || i}: ${b.value}`;
        return (
          <div
            key={b.key || i}
            className={"minibar-col" + (b.value > 0 ? " has" : "")}
            style={{ marginLeft: i ? gap : 0 }}
            title={tip}
          >
            <span className="minibar-fill" style={{ height: h }} />
          </div>
        );
      })}
    </div>
  );
}
