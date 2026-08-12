// AdminLayout.jsx — the admin console's chrome: a left rail naming the
// surfaces, a dense content pane. An operations tool, not a marketing page —
// the rail is the map of everything a tenant_admin runs, and it stays put
// while the tables change.
//
// The rail renders only the entries the CURRENT user may open (an auditor
// deep-linked into /admin/audit sees the audit entry, not a column of rows
// that would each stop at a forbidden page).
import React from "react";
import { Icon } from "../components/UI.jsx";
import { hasAnyRole, useAuth } from "../auth/AuthContext.jsx";
import { tr } from "../i18n.js";

export function AdminLayout({ nav, activeId, navigate, lang, children }) {
  const { state: auth } = useAuth();
  const visible = nav.filter((item) => hasAnyRole(auth?.claims, item.roles));
  return (
    <div className="page adm-shell" data-testid="admin-console">
      <nav className="adm-nav" aria-label={tr(lang, "Розділи адміністрування", "Admin sections")}>
        <div className="adm-nav-title">{tr(lang, "Адміністрування", "Administration")}</div>
        {visible.map((item) => (
          <a
            key={item.id}
            className={"adm-nav-link" + (item.id === activeId ? " on" : "")}
            onClick={() => navigate(item.path)}
            data-testid={`adm-nav-${item.id}`}
          >
            <Icon name={item.icon} size={15} />
            <span>{item.label(lang)}</span>
          </a>
        ))}
      </nav>
      <div className="adm-content">{children}</div>
    </div>
  );
}
