// Sparkline.jsx — dependency-free inline-SVG trend line over N points.
// `data` is an array of { value } (or numbers). Renders nothing meaningful for
// empty input — the parent should show its own empty state instead.
import React, { useMemo } from "react";

export function Sparkline({ data = [], width = 120, height = 32, strokeWidth = 1.75 }) {
  const values = useMemo(
    () => data.map((d) => (typeof d === "number" ? d : (d.value ?? d.count ?? 0))),
    [data],
  );
  const { path, area, last } = useMemo(() => {
    if (values.length === 0) return { path: "", area: "", last: null };
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const span = max - min || 1;
    const n = values.length;
    const dx = n > 1 ? width / (n - 1) : 0;
    const pad = strokeWidth + 1;
    const y = (v) => height - pad - ((v - min) / span) * (height - pad * 2);
    const pts = values.map((v, i) => [i * dx, y(v)]);
    const path = pts.map(([x, yy], i) => `${i ? "L" : "M"}${x.toFixed(1)},${yy.toFixed(1)}`).join(" ");
    const area = `${path} L${(width).toFixed(1)},${height} L0,${height} Z`;
    return { path, area, last: pts[pts.length - 1] };
  }, [values, width, height, strokeWidth]);

  if (!path) return <svg className="sparkline" width={width} height={height} aria-hidden="true" />;
  return (
    <svg className="sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`}
         preserveAspectRatio="none" aria-hidden="true">
      <path d={area} className="sparkline-area" />
      <path d={path} className="sparkline-line" fill="none" strokeWidth={strokeWidth} />
      {last && <circle cx={last[0]} cy={last[1]} r={strokeWidth + 0.5} className="sparkline-dot" />}
    </svg>
  );
}
