// Sidebar.jsx — Left sidebar with collapsible dropdown sections for
// Workspace / Settings / Admin / Audit / Account. Replaces the flat sidebar.
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Icon, Logo, Modal } from "./UI.jsx";
import { HealthBadge } from "./HealthBadge.jsx";
import { ClinicMenuSection, CreateClinicModal } from "./TenantSwitcher.jsx";
import { useAuth, hasAnyRole } from "../auth/AuthContext.jsx";
import { hasClinicalAccess, isAuditorOnly, canReadPatients } from "../auth/permissions.js";
import { isPlatformOwner } from "../company/ownerAccess.js";
import { logout as apiLogout } from "../api/endpoints.js";
import { FEATURES } from "../api/services.js";
import { useAsync } from "../api/useAsync.js";
import { countReports } from "../api/reports.js";
import { tr } from "../i18n.js";

// One collapsible group ── header clickable, body slides under.
// When the sidebar itself is collapsed, the group header is hidden and the
// children render as a flat icon list so every page stays reachable.
function Group({ id, title, icon, defaultOpen = false, openSet, setOpenSet, collapsed, children, badge }) {
  const open = collapsed ? true : openSet.has(id);
  const toggle = () => {
    setOpenSet((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  useEffect(() => {
    if (defaultOpen) setOpenSet((cur) => { if (cur.has(id)) return cur; const n = new Set(cur); n.add(id); return n; });
    // eslint-disable-next-line
  }, []);
  if (collapsed) {
    return <div className="sb-group collapsed">{children}</div>;
  }
  return (
    <div className={"sb-group " + (open ? "open " : "")}>
      <button className="sb-group-h" onClick={toggle} title={title} aria-expanded={open}>
        <Icon name={icon} size={14} />
        <span className="sb-group-title">{title}</span>
        {badge != null && <span className="badge">{badge}</span>}
        <Icon name={open ? "chevDown" : "chevRight"} size={12} />
      </button>
      {open && <div className="sb-group-body">{children}</div>}
    </div>
  );
}

// A single account-menu row that opens a flyout submenu to the side. Used to
// fold the Clinic / Admin / Audit sections so the dropup stays short. Opens on
// hover (with a small close delay so the pointer can cross the gap) and also
// toggles on click for keyboard/touch.
function SubMenu({ icon, label, children }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null); // { left, bottom } in viewport px
  const triggerRef = useRef(null);
  const timer = useRef(null);
  // The account dropup lives inside `.sb`, which clips horizontal overflow, so
  // an absolutely-positioned flyout would be cut off at the sidebar edge. We
  // position it `fixed` from the trigger's rect instead, escaping the clip.
  const place = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ left: Math.round(r.right + 6), bottom: Math.round(window.innerHeight - r.bottom - 5) });
  };
  const openNow = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } place(); setOpen(true); };
  const closeSoon = () => { timer.current = setTimeout(() => setOpen(false), 140); };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return (
    <div className="sb-submenu-wrap" onMouseEnter={openNow} onMouseLeave={closeSoon}>
      <button
        ref={triggerRef}
        className={"sb-user-menu-item sb-submenu-trigger" + (open ? " open" : "")}
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => { if (!open) place(); setOpen((v) => !v); }}
      >
        <Icon name={icon} size={14} />
        <span className="sb-submenu-label">{label}</span>
        <Icon name="chevRight" size={13} />
      </button>
      {open && pos && (
        <div
          className="sb-user-submenu"
          role="menu"
          style={{ left: pos.left, bottom: pos.bottom }}
          onMouseEnter={openNow}
          onMouseLeave={closeSoon}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function NavLink({ route, navigate, path, prefix, exact, icon, label, badge, collapsed, onClick, disabled, comingSoon }) {
  const active = !disabled && (exact ? route === path : route.startsWith(prefix || path));
  const cls = "sb-link" + (active ? " on" : "") + (disabled ? " is-disabled" : "");
  const tip = collapsed ? label : (comingSoon ? `${label} — coming soon` : undefined);
  return (
    <a
      className={cls}
      aria-disabled={disabled || undefined}
      onClick={(e) => {
        e.preventDefault();
        if (disabled) return;
        if (onClick) onClick(); else navigate(path);
      }}
      title={tip}
    >
      <Icon name={icon} size={14} />
      {!collapsed && <span className="sb-link-label">{label}</span>}
      {!collapsed && comingSoon && (
        <span className="badge" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>soon</span>
      )}
      {!collapsed && !comingSoon && badge != null && <span className="badge">{badge}</span>}
    </a>
  );
}

export function Sidebar({
  route,
  navigate,
  lang,
  setLang,
  tweaks,
  setTweak,
  onNewSession,
  onNewDictation,
  collapsed,
  onToggleCollapse,
  onToast,
}) {
  const { state, clear } = useAuth();
  const claims = state?.claims;
  const dbUser = state?.dbUser;
  const isAdmin = hasAnyRole(claims, ["tenant_admin"]);
  const isAuditor = hasAnyRole(claims, ["auditor", "tenant_admin"]);
  const isOwner = isPlatformOwner(state);
  // S14 — an administrator holds no clinical permission, so the notes,
  // dictation and report surfaces would 403 on every call. Hiding them is
  // not the security boundary (the server is); it is the difference
  // between a product that says "not for your role" and one that shows a
  // doctor's nav full of buttons that fail. The patient roster stays —
  // that one an admin genuinely uses.
  const clinical = hasClinicalAccess(claims);
  // …and an auditor holds neither clinical nor administrative permission.
  // The roster is not theirs (`patients.read` excludes auditor), and neither
  // is dictation, so the product switcher and the record CTA go with it:
  // what is left is the trail they are here to read.
  const auditorOnly = isAuditorOnly(claims);
  const canPatients = canReadPatients(claims);

  const product = route.startsWith("/dictate") ? "dictate" : "scribe";

  // Live count for the "Reports" nav badge — exact number of draft reports
  // needing attention (mirrors the Reports page's own `mine` count). Uses the
  // cheap total=exact path so the badge is accurate rather than counting a
  // truncated page. Only fetched when the Dictate product is active and the
  // reports feature is on; hidden at zero so an empty list shows no badge.
  const reportsBadgeReq = useAsync(
    () => countReports({ status: "draft" }),
    [claims?.tid],
    // `clinical` gate added in S14: an admin has no report.read, so
    // this badge fetch would be a guaranteed 403 on every render.
    { enabled: !!state && clinical && FEATURES.reports && product === "dictate" },
  );
  const draftReportCount = typeof reportsBadgeReq.data === "number" ? reportsBadgeReq.data : 0;

  // open dropdowns — persisted to localStorage
  const [openSet, setOpenSet] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("mdx_sb_open") || "[]");
      return new Set(saved);
    } catch { return new Set(["workspace"]); }
  });
  useEffect(() => {
    try { localStorage.setItem("mdx_sb_open", JSON.stringify(Array.from(openSet))); } catch {}
  }, [openSet]);

  // Auto-open the group matching the active route on navigation.
  useEffect(() => {
    let want = null;
    if (route.startsWith("/asr")) want = "asr";
    else if (route.startsWith("/chat")) want = "evidence";
    else if (route.startsWith("/audit")) want = "audit";
    else if (route.startsWith("/scribe") || route.startsWith("/dictate")) want = "workspace";
    if (want) setOpenSet((cur) => { if (cur.has(want)) return cur; const n = new Set(cur); n.add(want); return n; });
  }, [route]);

  // Sign-out is confirmed through a modal before the session is torn down.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  // Create-clinic modal is owned here (not inside the account menu) so it
  // survives the menu closing when "Create clinic" is picked.
  const [createClinicOpen, setCreateClinicOpen] = useState(false);

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await apiLogout();
    } catch {}
    clear();
    setSigningOut(false);
    setConfirmOpen(false);
    if (onToast) onToast(tr(lang, "Сесію завершено", "Signed out"));
    navigate("/login");
  };

  const setProduct = (p) => {
    if (p === "scribe") navigate("/scribe");
    else navigate("/dictate");
  };

  const initials = useMemo(() => {
    const src = dbUser?.display_name || claims?.sub || "??";
    return src.split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  }, [dbUser, claims]);

  // User menu popover (Profile / Settings / Sign out).
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onDocDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);
  const pickMenu = (fn) => () => { setMenuOpen(false); fn(); };

  // Secondary nav (Admin / Audit) — folded into the account dropup so the
  // sidebar footer stays clean. Clinic controls live in ClinicMenuSection just
  // above these. Each section is role-gated.
  const navSections = useMemo(() => {
    const secs = [];
    // Klarnote's own console — the vendor view, above the customer's own admin
    // section because it is a different job entirely. Gated on the platform-owner
    // allowlist (there is no server-side platform role to check yet).
    if (isOwner) {
      secs.push({
        title: tr(lang, "Klarnote", "Klarnote"),
        icon: "building",
        items: [
          { icon: "building", label: tr(lang, "Компанія", "Company"), path: "/company", prefix: "/company" },
        ],
      });
    }
    if (isAdmin) {
      secs.push({
        title: tr(lang, "Адмін", "Admin"),
        icon: "grid",
        items: [
          { icon: "grid", label: tr(lang, "Панель", "Dashboard"), path: "/dashboard", exact: true },
          { icon: "users", label: tr(lang, "Користувачі", "Users"), path: "/admin/users", exact: true },
          { icon: "shield", label: tr(lang, "Приватність", "Privacy"), path: "/admin/privacy", exact: true },
        ],
      });
    }
    // For an auditor-only account the trail IS the workspace — it already sits
    // in the main nav above, so folding a second copy into the account dropup
    // would be duplicate navigation. Admins keep it here, where it is one of
    // several secondary jobs.
    if (isAuditor && !auditorOnly) {
      secs.push({
        title: tr(lang, "Комплаєнс", "Compliance"),
        icon: "history",
        items: [
          { icon: "history", label: tr(lang, "Події", "Events"), path: "/audit/events", prefix: "/audit/events" },
          { icon: "shield", label: tr(lang, "Перевірка ланцюга", "Chain verify"), path: "/audit/verify", exact: true },
          { icon: "eye", label: tr(lang, "Break-glass", "Break-glass"), path: "/audit/phi-access", exact: true },
          { icon: "users", label: tr(lang, "Огляд доступів", "Access review"), path: "/audit/access", exact: true },
          { icon: "book", label: tr(lang, "Докази для аудиту", "Audit evidence"), path: "/audit/compliance", exact: true },
        ],
      });
    }
    return secs;
  }, [isOwner, isAdmin, isAuditor, auditorOnly, lang]);

  return (
    <>
    <aside className={"sb" + (collapsed ? " collapsed" : "")}>
      <div className="sb-brand">
        <div className="sb-brand-inner"
             onClick={() => navigate(auditorOnly ? "/audit/events" : product === "scribe" ? "/scribe" : "/dictate")}>
          <Logo size={26} />
          {/* An auditor-only account is not in Scribe or Dictate — it has no
              product switch at all — so the wordmark is what names the product
              they are actually in. */}
          {!collapsed && (
            <span className="sb-wordmark">
              Klarnote{auditorOnly && <span className="sb-wordmark-sfx">Audit</span>}
            </span>
          )}
        </div>
        <button className="sb-toggle" onClick={onToggleCollapse} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          <Icon name={collapsed ? "chevRight" : "chevLeft"} size={13} />
        </button>
      </div>

      {!auditorOnly && (
        <div className="sb-product" role="tablist">
          <button data-p="scribe" className={product === "scribe" ? "on" : ""} onClick={() => setProduct("scribe")}>
            <span className="dot" />{!collapsed && <span>Scribe</span>}
          </button>
          <button data-p="dictate" className={product === "dictate" ? "on" : ""} onClick={() => setProduct("dictate")}>
            <span className="dot" />{!collapsed && <span>Dictate</span>}
          </button>
        </div>
      )}

      {/* An auditor cannot start a recording (`dictation.start` excludes the
          role), so the primary CTA is not theirs to press. */}
      {!auditorOnly && (product === "scribe" ? (
        <button className="sb-cta" onClick={onNewSession}>
          <span className="sb-cta-icon"><Icon name="mic" size={13} /></span>
          {!collapsed && <span className="sb-cta-label">{tr(lang, "Нова консультація", "New consultation")}</span>}
          {!collapsed && <kbd>N</kbd>}
        </button>
      ) : (
        <button className="sb-cta" onClick={onNewDictation}>
          <span className="sb-cta-icon"><Icon name="mic" size={13} /></span>
          {!collapsed && <span className="sb-cta-label">{tr(lang, "Нове диктування", "New dictation")}</span>}
          {!collapsed && <kbd>D</kbd>}
        </button>
      ))}

      {auditorOnly ? (
        /* ── Audit (the auditor's whole workspace) ─────────── */
        <Group id="audit" title={tr(lang, "Комплаєнс", "Compliance")} icon="history"
               openSet={openSet} setOpenSet={setOpenSet} collapsed={collapsed} defaultOpen>
          <NavLink {...{ route, navigate, collapsed }} icon="history"
                   label={tr(lang, "Події", "Events")}
                   path="/audit/events" prefix="/audit/events" />
          <NavLink {...{ route, navigate, collapsed }} icon="shield"
                   label={tr(lang, "Перевірка ланцюга", "Chain verify")}
                   path="/audit/verify" exact />
          {/* Break-glass oversight. `phi_access.read` admits the auditor, and
              the grant record answers what the audit event alone cannot: on
              what grounds, for how long, and how often it was used. */}
          <NavLink {...{ route, navigate, collapsed }} icon="eye"
                   label={tr(lang, "Break-glass", "Break-glass")}
                   path="/audit/phi-access" exact />
          {/* `user.read` is the auditor's server-side permission for the roster
              — the access-control review GDPR Art. 32(4) asks them to perform. */}
          <NavLink {...{ route, navigate, collapsed }} icon="users"
                   label={tr(lang, "Огляд доступів", "Access review")}
                   path="/audit/access" exact />
          <NavLink {...{ route, navigate, collapsed }} icon="book"
                   label={tr(lang, "Докази для аудиту", "Audit evidence")}
                   path="/audit/compliance" exact />
          {/* `templates.read` admits the auditor: the template library is the
              reference they read a record's structure against, and it holds
              no patient data. */}
          <NavLink {...{ route, navigate, collapsed }} icon="layers"
                   label={tr(lang, "Шаблони нотаток", "Note templates")}
                   path="/scribe/templates"
                   comingSoon={!FEATURES.templates} />
        </Group>
      ) : (
      /* ── Workspace ─────────────────────────────────────── */
      <Group id="workspace" title={tr(lang, "Робочий простір", "Workspace")} icon="folder"
             openSet={openSet} setOpenSet={setOpenSet} collapsed={collapsed} defaultOpen>
        {product === "scribe" ? (
          <>
            {clinical && (
              <NavLink {...{ route, navigate, collapsed }} icon="inbox" label={tr(lang, "Сьогодні", "Today")} path="/scribe" exact />
            )}
            {canPatients && (
              <NavLink {...{ route, navigate, collapsed }} icon="users"
                       label={tr(lang, "Пацієнти", "Patients")}
                       path="/scribe/patients" prefix="/scribe/patients"
                       comingSoon={!FEATURES.patients} />
            )}
            {clinical && (
              <NavLink {...{ route, navigate, collapsed }} icon="fileText"
                       label={tr(lang, "Нотатки", "Notes")}
                       path="/scribe/notes"
                       comingSoon={!FEATURES.notes} />
            )}
            <NavLink {...{ route, navigate, collapsed }} icon="layers"
                     label={tr(lang, "Шаблони нотаток", "Note templates")}
                     path="/scribe/templates"
                     comingSoon={!FEATURES.templates} />
          </>
        ) : (
          <>
            {clinical && (
              <>
                <NavLink {...{ route, navigate, collapsed }} icon="inbox" label={tr(lang, "Огляд", "Overview")} path="/dictate" exact />
                <NavLink {...{ route, navigate, collapsed }} icon="mic"
                         label={tr(lang, "Студія", "Studio")}
                         path="/dictate/studio" prefix="/dictate/studio" />
                <NavLink {...{ route, navigate, collapsed }} icon="fileText"
                         label={tr(lang, "Звіти", "Reports")}
                         path="/dictate/reports" prefix="/dictate/reports"
                         badge={FEATURES.reports && draftReportCount > 0 ? String(draftReportCount) : undefined}
                         comingSoon={!FEATURES.reports} />
              </>
            )}
            {/* Templates are clinical CONTENT, not a clinical RECORD — an
                admin curates the tenant's template library. */}
            <NavLink {...{ route, navigate, collapsed }} icon="layers"
                     label={tr(lang, "Шаблони", "Templates")}
                     path="/dictate/templates"
                     comingSoon={!FEATURES.templates} />
          </>
        )}
      </Group>
      )}

      {/* ── Transcription (ASR — clinical roles only since S14) ── */}
      {state && clinical && (
        <Group id="asr" title={tr(lang, "Транскрипція", "Transcription")} icon="bot"
               openSet={openSet} setOpenSet={setOpenSet} collapsed={collapsed}>
          <NavLink {...{ route, navigate, collapsed }} icon="inbox"
                   label={tr(lang, "Завдання", "Jobs")}
                   path="/asr/jobs" prefix="/asr/jobs" />
          <NavLink {...{ route, navigate, collapsed }} icon="plus"
                   label={tr(lang, "Нове завдання", "New job")}
                   path="/asr/new" exact />
        </Group>
      )}

      {/* ── Evidence (embedded module — chat, agents, connectors) ── */}
      {state && clinical && (
        <Group id="evidence" title={tr(lang, "Доказова база", "Evidence")} icon="sparkle"
               openSet={openSet} setOpenSet={setOpenSet} collapsed={collapsed}>
          <NavLink {...{ route, navigate, collapsed }} icon="sparkle"
                   label={tr(lang, "Платформа", "Evidence platform")}
                   path="/chat" exact />
          <NavLink {...{ route, navigate, collapsed }} icon="users"
                   label={tr(lang, "Агенти", "Agents")}
                   path="/chat/agents" prefix="/chat/agents" />
        </Group>
      )}

      <div className="sb-spacer" />

      <div className="sb-foot">
        {!collapsed && (
          <div className="sb-controls">
            <HealthBadge lang={lang} />
            <div style={{ flex: 1 }} />
            <button className="icon-btn" title="Help"><Icon name="help" size={14} /></button>
          </div>
        )}
        <div className="sb-user-wrap" ref={menuRef}>
          <div
            className={"sb-user" + (menuOpen ? " open" : "")}
            onClick={() => setMenuOpen((v) => !v)}
            role="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title={state ? (tr(lang, "Меню акаунту", "Account menu")) : (tr(lang, "Увійти", "Sign in"))}
          >
            <div className="avatar">{initials}</div>
            {!collapsed && (
              <>
                <div className="sb-user-info">
                  <div className="sb-user-name">
                    {dbUser?.display_name || claims?.sub?.slice(0, 12) || (tr(lang, "Гість", "Guest"))}
                  </div>
                  <div className="sb-user-role">
                    {claims ? (claims.roles || []).join(", ") : (tr(lang, "Не авторизовано", "Not signed in"))}
                  </div>
                </div>
                <Icon name={menuOpen ? "chevDown" : "chevRight"} size={14} />
              </>
            )}
          </div>
          {menuOpen && (
            <div className={"sb-user-menu" + (collapsed ? " collapsed" : "")} role="menu">
              {state ? (
                <>
                  <button className="sb-user-menu-item" role="menuitem" onClick={pickMenu(() => navigate("/profile"))}>
                    <Icon name="user" size={14} />
                    <span>{tr(lang, "Профіль", "Profile")}</span>
                  </button>
                  <button className="sb-user-menu-item" role="menuitem" onClick={pickMenu(() => navigate("/settings"))}>
                    <Icon name="sliders" size={14} />
                    <span>{tr(lang, "Налаштування", "Settings")}</span>
                  </button>
                  <SubMenu icon="home" label={tr(lang, "Клініка", "Clinic")}>
                    <ClinicMenuSection
                      embedded
                      lang={lang}
                      navigate={navigate}
                      onToast={onToast}
                      onNavigate={(path) => { setMenuOpen(false); navigate(path); }}
                      onCreateClinic={() => { setMenuOpen(false); setCreateClinicOpen(true); }}
                    />
                  </SubMenu>
                  {navSections.map((sec) => (
                    <SubMenu key={sec.title} icon={sec.icon} label={sec.title}>
                      {sec.items.map((it) => {
                        const active = it.exact ? route === it.path : route.startsWith(it.prefix || it.path);
                        return (
                          <button
                            key={it.path}
                            className={"sb-user-menu-item" + (active ? " on" : "")}
                            role="menuitem"
                            onClick={pickMenu(() => navigate(it.path))}
                          >
                            <Icon name={it.icon} size={14} />
                            <span>{it.label}</span>
                          </button>
                        );
                      })}
                    </SubMenu>
                  ))}
                  <div className="sb-user-menu-sep" />
                  <button className="sb-user-menu-item danger" role="menuitem" onClick={pickMenu(() => setConfirmOpen(true))}>
                    <Icon name="arrowLeft" size={14} />
                    <span>{tr(lang, "Вийти", "Sign out")}</span>
                  </button>
                </>
              ) : (
                <button className="sb-user-menu-item" role="menuitem" onClick={pickMenu(() => navigate("/login"))}>
                  <Icon name="user" size={14} />
                  <span>{tr(lang, "Увійти", "Sign in")}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>

    {confirmOpen && (
      <Modal onClose={() => { if (!signingOut) setConfirmOpen(false); }}>
        <div className="signout-modal">
          <span className="signout-modal-mark">
            <Icon name="arrowLeft" size={20} />
          </span>
          <h2 className="signout-modal-title">
            {tr(lang, "Вийти з акаунту?", "Sign out?")}
          </h2>
          <p className="signout-modal-body">
            {tr(lang, "Поточну сесію буде завершено. Незбережені зміни може бути втрачено.", "Your current session will end. Any unsaved changes may be lost.")}
          </p>
          <div className="signout-modal-actions">
            <button
              className="btn btn-ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={signingOut}
            >
              {tr(lang, "Скасувати", "Cancel")}
            </button>
            <button
              className="btn btn-danger"
              onClick={handleLogout}
              disabled={signingOut}
              autoFocus
            >
              {signingOut
                ? tr(lang, "Вихід…", "Signing out…")
                : tr(lang, "Вийти", "Sign out")}
            </button>
          </div>
        </div>
      </Modal>
    )}

    {createClinicOpen && (
      <CreateClinicModal
        lang={lang}
        onClose={() => setCreateClinicOpen(false)}
        onCreated={(t) => {
          setCreateClinicOpen(false);
          if (onToast) onToast(lang === "uk" ? `Клініку «${t.display_name}» створено` : `Clinic “${t.display_name}” created`);
        }}
      />
    )}
    </>
  );
}
