// StatusBadge.jsx — small coloured pill for a status/health value.
// `tone` picks the palette: ok | warn | danger | info | muted. Falls back to a
// tone inferred from common status strings so callers can pass a raw status.
import React from "react";

const TONE_BY_STATUS = {
  active: "ok", ready: "ok", complete: "ok", signed: "ok", finalized: "info",
  invited: "warn", pending: "warn", running: "warn", queued: "warn", starting: "warn",
  draft: "muted", amended: "info",
  deactivated: "danger", failed: "danger", cancelled: "danger", down: "danger",
};

export function StatusBadge({ status, label, tone, dot = true }) {
  const t = tone || TONE_BY_STATUS[String(status || "").toLowerCase()] || "muted";
  return (
    <span className={"status-badge tone-" + t}>
      {dot && <span className="status-badge-dot" />}
      {label ?? status}
    </span>
  );
}
