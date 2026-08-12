// AdminRoutes.jsx — the admin console's own route table (sprint 17).
//
// THE BOUNDARY, same contract as EvidenceRoutes: App.jsx hands every
// `#/admin/*` path to this module and knows nothing else about the console —
// no per-surface imports, no per-surface branches. Adding a surface is one
// entry in ROUTES here (component, path, roles, nav label), not an edit to
// the host router.
//
// GATING. Every surface names its own role list and RequireRole enforces it
// client-side — while the SERVER stays the real boundary: each API these
// screens call re-checks permissions, and the mutation routes additionally
// demand a verified-MFA session (the 403 grace signal routes to enrolment via
// the fetch client, with a way back — see auth/mfaGrace.js). The client gate
// exists so a blocked user gets one honest forbidden page instead of a screen
// of failing requests.
//
//   tenant_admin            — the whole console
//   auditor                 — the audit surface only (server grants audit.read)
//   super_admin             — kept on privacy for consistency with the old
//                             route; the server neither issues nor honours it
import React, { useEffect } from "react";
import { RequireRole } from "../auth/RequireRole.jsx";
import { tr } from "../i18n.js";
import { AdminLayout } from "./AdminLayout.jsx";
import { UsersAdmin } from "./pages/UsersAdmin.jsx";
import { AuditAdmin } from "./pages/AuditAdmin.jsx";
import { PrivacyAdminPage } from "../pages/PrivacyAdminPage.jsx";
import { TemplatesAdmin } from "./pages/TemplatesAdmin.jsx";
import { DictionaryAdmin } from "./pages/DictionaryAdmin.jsx";
import { AutocompleteAdmin } from "./pages/AutocompleteAdmin.jsx";
import { SynonymsAdmin } from "./pages/SynonymsAdmin.jsx";

export const ADMIN_BASE_PATH = "/admin";

// Where the bare /admin lands: the templates surface — the console's centre
// of gravity (the sprint's first promise and the busiest admin workflow).
const ADMIN_HOME = "/admin/templates";

function AdminHomeRedirect({ navigate }) {
  useEffect(() => { navigate(ADMIN_HOME); }, [navigate]);
  return null;
}

// One entry per surface. `match(path, query)` → mount props or null.
// `nav` names the left-rail entry (omit for routes that share a surface's
// entry, e.g. /admin/audit/verify rides the audit entry).
const ROUTES = [
  {
    id: "templates",
    roles: ["tenant_admin"],
    // Owns the whole /admin/templates/* namespace; the page module routes the
    // remainder (list vs detail editor) off subPath.
    match: (p, q) =>
      p === "/admin/templates" || p.startsWith("/admin/templates/")
        ? { subPath: p.slice("/admin/templates".length), query: q }
        : null,
    Component: TemplatesAdmin,
    nav: {
      icon: "fileText",
      label: (lang) => tr(lang, "Шаблони", "Templates"),
      path: "/admin/templates",
    },
    crumb: (lang) => tr(lang, "Шаблони", "Templates"),
  },
  {
    id: "dictionary",
    roles: ["tenant_admin"],
    match: (p, q) =>
      p === "/admin/dictionary" ? { tab: q.get("tab") || "abbreviations" } : null,
    Component: DictionaryAdmin,
    nav: {
      icon: "book",
      label: (lang) => tr(lang, "Словник і команди", "Dictionary & commands"),
      path: "/admin/dictionary",
    },
    crumb: (lang) => tr(lang, "Словник і команди", "Dictionary & commands"),
  },
  {
    id: "autocomplete",
    roles: ["tenant_admin"],
    match: (p, q) =>
      p === "/admin/autocomplete" ? { tab: q.get("tab") || "phrases" } : null,
    Component: AutocompleteAdmin,
    nav: {
      icon: "keyboard",
      label: (lang) => tr(lang, "Автодоповнення", "Autocomplete"),
      path: "/admin/autocomplete",
    },
    crumb: (lang) => tr(lang, "Автодоповнення", "Autocomplete"),
  },
  {
    id: "synonyms",
    roles: ["tenant_admin"],
    match: (p) => (p === "/admin/synonyms" ? {} : null),
    Component: SynonymsAdmin,
    nav: {
      icon: "link",
      label: (lang) => tr(lang, "Синоніми пошуку", "Search synonyms"),
      path: "/admin/synonyms",
    },
    crumb: (lang) => tr(lang, "Синоніми пошуку", "Search synonyms"),
  },
  {
    id: "users",
    // tenant_admin only, matching the route this replaces. The auditor's
    // read-only roster keeps its own home at /audit/access.
    roles: ["tenant_admin"],
    match: (p) => (p === "/admin/users" ? {} : null),
    Component: UsersAdmin,
    nav: {
      icon: "users",
      label: (lang) => tr(lang, "Користувачі", "Users"),
      path: "/admin/users",
    },
    crumb: (lang) => tr(lang, "Користувачі", "Users"),
  },
  {
    id: "audit",
    roles: ["tenant_admin", "auditor"],
    match: (p, q) => {
      if (p === "/admin/audit") return { tab: "events", initialFromSeq: q.get("from_seq") || "" };
      if (p === "/admin/audit/verify") return { tab: "verify" };
      return null;
    },
    Component: AuditAdmin,
    nav: {
      icon: "history",
      label: (lang) => tr(lang, "Аудит", "Audit"),
      path: "/admin/audit",
    },
    crumb: (lang) => tr(lang, "Аудит", "Audit"),
  },
  {
    id: "privacy",
    roles: ["tenant_admin", "super_admin"],
    match: (p) => (p === "/admin/privacy" ? {} : null),
    Component: PrivacyAdminPage,
    nav: {
      icon: "shield",
      label: (lang) => tr(lang, "Приватність", "Privacy"),
      path: "/admin/privacy",
    },
    crumb: (lang) => tr(lang, "Приватність", "Privacy"),
  },
];

// The left rail: every surface with a nav entry, in table order, each carrying
// its role list so AdminLayout can hide what the current user cannot open.
const NAV = ROUTES.filter((r) => r.nav).map((r) => ({
  id: r.id,
  icon: r.nav.icon,
  label: r.nav.label,
  path: r.nav.path,
  roles: r.roles,
}));

function matchRoute(route) {
  const [path, search] = String(route || "").split("?");
  const query = new URLSearchParams(search || "");
  for (const entry of ROUTES) {
    const props = entry.match(path, query);
    if (props) return { entry, props };
  }
  return null;
}

/** Does the console claim this path? False ⇒ the host renders its 404. */
export function isAdminRoute(route) {
  const path = String(route || "").split("?")[0];
  if (path === ADMIN_BASE_PATH) return true;
  return !!matchRoute(route);
}

/** Breadcrumbs for the host's top bar; null when the console does not own it. */
export function adminCrumbs(route, lang = "uk") {
  const path = String(route || "").split("?")[0];
  const head = { label: tr(lang, "Адміністрування", "Administration") };
  if (path === ADMIN_BASE_PATH) return [head];
  const hit = matchRoute(route);
  if (!hit) return null;
  return [head, { label: hit.entry.crumb(lang) }];
}

export function AdminRoutes({ route, navigate, lang = "uk", onToast }) {
  const path = String(route || "").split("?")[0];

  if (path === ADMIN_BASE_PATH) {
    return (
      <RequireRole any={["tenant_admin"]} navigate={navigate}>
        <AdminHomeRedirect navigate={navigate} />
      </RequireRole>
    );
  }

  const hit = matchRoute(route);
  if (!hit) return null;
  const { entry, props } = hit;

  return (
    <RequireRole any={entry.roles} navigate={navigate}>
      <AdminLayout nav={NAV} activeId={entry.id} navigate={navigate} lang={lang}>
        <entry.Component {...props} lang={lang} navigate={navigate} onToast={onToast} />
      </AdminLayout>
    </RequireRole>
  );
}
