// TenantBadge.jsx — surfaces which tenant/clinic the active session is in
// (F-02 §1.6). Sourced from the access-token claims served by /auth/me.
//
// The backend pins isolation server-side from `tid`; the FE never sends a
// tenant id. This badge is display-only. If/when auth-service adds a
// human-readable tenant name claim (`tenant_name` / `tname`), we show it;
// until then we render a stable short form of the `tid` UUID with the full
// value on hover so a clinician can confirm the clinic at a glance.
import React from "react";
import { Icon } from "./UI.jsx";
import { useClaims } from "../auth/AuthContext.jsx";
import { tr } from "../i18n.js";

// "00000000-0000-0000-0000-00000000000a" → "····000a"
function shortTid(tid) {
  if (!tid) return "—";
  const tail = String(tid).replace(/-/g, "").slice(-4);
  return `····${tail}`;
}

export function tenantLabel(claims) {
  if (!claims) return null;
  return claims.tenant_name || claims.tname || shortTid(claims.tid);
}

export function TenantBadge({ lang = "en", collapsed = false }) {
  const claims = useClaims();
  if (!claims) return null;

  const named = claims.tenant_name || claims.tname;
  const label = tenantLabel(claims);
  const caption = tr(lang, "Клініка", "Clinic");
  const title = `${caption}: ${named || ""}${named ? " · " : ""}${claims.tid || ""}`.trim();

  if (collapsed) {
    return (
      <div className="tenant-badge collapsed" title={title} aria-label={title}>
        <Icon name="home" size={14} />
      </div>
    );
  }

  return (
    <div className="tenant-badge" title={title} aria-label={title}>
      <Icon name="home" size={13} />
      <div className="tenant-badge-text">
        <span className="tenant-badge-caption">{caption}</span>
        <span className="tenant-badge-name" style={{ fontFamily: named ? "inherit" : "var(--mono)" }}>
          {label}
        </span>
      </div>
    </div>
  );
}
