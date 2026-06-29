// StatCard.jsx — big number + label + optional sublabel/trend, with built-in
// loading and error skins. Reused across every dashboard KPI tile.
import React from "react";
import { Icon } from "../UI.jsx";

export function StatCard({
  label, value, sublabel, icon, accent, loading, error, approx, children,
}) {
  return (
    <div className={"stat-card" + (accent ? " accent" : "")} role="group" aria-label={label}>
      <div className="stat-card-h">
        <span className="stat-card-label">{label}</span>
        {icon && <span className="stat-card-icon"><Icon name={icon} size={15} /></span>}
      </div>
      {loading ? (
        <div className="stat-card-skel" aria-hidden="true" />
      ) : error ? (
        <div className="stat-card-value stat-card-err" title={String(error.message || error)}>—</div>
      ) : (
        <div className="stat-card-value">
          {value}
          {approx && <span className="stat-card-approx" title="Computed client-side (approximate)">≈</span>}
        </div>
      )}
      {sublabel && !loading && !error && <div className="stat-card-sub">{sublabel}</div>}
      {children}
    </div>
  );
}
