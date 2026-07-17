// UI.jsx — Shared UI primitives + icons + shell (Sidebar, TopBar)
import React from 'react';
import { useI18n } from '../i18n.js';

export const Icon = ({ name, size = 16, ...rest }) => {
  const paths = {
    mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8.5 21h7" /></>,
    micOff: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8.5 21h7M3 3l18 18" /></>,
    pause: <><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></>,
    play: <path d="M6 4l14 8-14 8z" />,
    stop: <rect x="6" y="6" width="12" height="12" rx="1.5" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    chevDown: <path d="m6 9 6 6 6-6" />,
    chevRight: <path d="m9 6 6 6-6 6" />,
    chevLeft: <path d="m15 6-6 6 6 6" />,
    chevUp: <path d="m6 15 6-6 6 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    check: <path d="m5 13 4 4L19 7" />,
    x: <path d="M6 6l12 12M6 18 18 6" />,
    edit: <path d="M11 4H4v16h16v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />,
    save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 21v-8H7v8M7 3v5h8" /></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5M12 15V3" /></>,
    print: <><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>,
    sign: <path d="M3 17s2-4 6-4 4 4 8 4 4-4 4-4M3 21h18" />,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    users: <><circle cx="9" cy="8" r="4" /><path d="M3 21a6 6 0 0 1 12 0M16 4a4 4 0 0 1 0 8M21 21a6 6 0 0 0-4-5.66" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
    bell: <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M14 21a2 2 0 0 1-4 0" />,
    help: <><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" /></>,
    fileText: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" /></>,
    folder: <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />,
    clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
    waveform: <path d="M2 12h2M6 8v8M10 5v14M14 8v8M18 11v2M22 12h-2" />,
    sparkle: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />,
    keyboard: <><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M10 14h.01M14 14h.01M18 14h.01M7 14h10" /></>,
    heart: <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />,
    scalpel: <path d="M3 21h6l11-11-3-3L3 21zM14 7l3 3" />,
    bone: <path d="M17 10a3 3 0 0 0 0-6 3 3 0 0 0-3 3l-3 3-3-3a3 3 0 0 0-3-3 3 3 0 0 0 0 6 3 3 0 0 0 0 6 3 3 0 0 0 3 3l3-3 3 3a3 3 0 0 0 3 3 3 3 0 0 0 0-6 3 3 0 0 0 0-6z" />,
    scan: <><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M7 12h10" /></>,
    arrowLeft: <path d="m12 19-7-7 7-7M19 12H5" />,
    arrowRight: <path d="m12 5 7 7-7 7M5 12h14" />,
    moon: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></>,
    layers: <path d="m12 2-10 5 10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />,
    audio: <><path d="M11 5 6 9H2v6h4l5 4zM15 9a3 3 0 0 1 0 6M19 5a7 7 0 0 1 0 14" /></>,
    inbox: <><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></>,
    home: <path d="M3 12 12 3l9 9M5 10v10h14V10" />,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
    moreH: <><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></>,
    moreV: <><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" /></>,
    filter: <path d="M22 3H2l8 9.46V19l4 2v-8.54z" />,
    archive: <><rect x="2" y="3" width="20" height="5" rx="1" /><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4" /></>,
    tag: <><path d="M20.59 13.41 13 21a2 2 0 0 1-2.83 0L3 13.83V3h10.83L21 10.17a2 2 0 0 1-.41 3.24z" /><circle cx="7.5" cy="7.5" r="1" /></>,
    book: <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />,
    refresh: <><path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></>,
    eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" /><circle cx="12" cy="12" r="3" /></>,
    flag: <path d="M4 21V4M4 4h16l-4 5 4 5H4" />,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" /><path d="M12 7v5l3 3" /></>,
    bot: <><rect x="3" y="8" width="18" height="12" rx="3" /><path d="M12 2v4M9 14h.01M15 14h.01M9 17h6" /></>,
    sliders: <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />,
    bold: <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6zM6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />,
    italic: <path d="M19 4h-9M14 20H5M15 4 9 20" />,
    underline: <><path d="M6 4v6a6 6 0 0 0 12 0V4M4 20h16" /></>,
    list: <><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="3" cy="6" r="1" /><circle cx="3" cy="12" r="1" /><circle cx="3" cy="18" r="1" /></>,
    grid: <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />,
    star: <path d="M12 2.5l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.3l-5.8 3.05 1.11-6.46-4.7-4.58 6.49-.94z" />,
    diff: <><path d="M12 5v14M5 12h14M3 3l18 18M3 21 21 3" stroke="none" /><path d="M17 7H7v4h10V7zM7 13h10v4H7z" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.75"
         strokeLinecap="round" strokeLinejoin="round" {...rest}>
      {paths[name] || <circle cx="12" cy="12" r="8" />}
    </svg>
  );
};

// Brand mark
export const Logo = ({ size = 22 }) => (
  <span className="sb-brand-mark" style={{ width: size, height: size, fontSize: size * 0.5 }}>D</span>
);

// ── Sidebar ─────────────────────────────────────────────────────────────
export function Sidebar({ route, navigate, lang, setLang, theme, setTheme, onNewSession, onNewDictation, collapsed, onToggleCollapse, user }) {
  const { t } = useI18n();
  const product = route.startsWith("/dictate") ? "dictate" : "scribe";

  // Switch product → land on its index
  const setProduct = (p) => {
    if (p === "scribe") navigate("/scribe");
    else navigate("/dictate");
  };

  const Link = ({ icon, label, path, badge, exact, prefix }) => {
    const active = exact ? route === path : route.startsWith(prefix || path);
    return (
      <a className={`sb-link ${active ? "on" : ""}`} onClick={() => navigate(path)}>
        <Icon name={icon} size={16} />
        <span className="sb-link-label">{label}</span>
        {badge != null && <span className="badge">{badge}</span>}
      </a>
    );
  };

  return (
    <aside className={`sb${collapsed ? " collapsed" : ""}`}>
      <div className="sb-brand">
        <div className="sb-brand-inner" onClick={() => navigate(product === "scribe" ? "/scribe" : "/dictate")}>
          <Logo size={26} />
          {!collapsed && <span>Klarnote</span>}
        </div>
        <button className="sb-toggle" onClick={onToggleCollapse}
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          <Icon name={collapsed ? "chevRight" : "chevLeft"} size={13} />
        </button>
      </div>

      <div className="sb-product" role="tablist">
        <button data-p="scribe" className={product === "scribe" ? "on" : ""} onClick={() => setProduct("scribe")}>
          <span className="dot" />
          {!collapsed && <span>Scribe</span>}
        </button>
        <button data-p="dictate" className={product === "dictate" ? "on" : ""} onClick={() => setProduct("dictate")}>
          <span className="dot" />
          {!collapsed && <span>Dictate</span>}
        </button>
      </div>

      {product === "scribe" ? (
        <>
          <button className="sb-cta" onClick={onNewSession} title={lang === "uk" ? "Нова консультація" : "New consultation"}>
            <span className="sb-cta-icon"><Icon name="mic" size={13} /></span>
            {!collapsed && <span className="sb-cta-label">{lang === "uk" ? "Нова консультація" : "New consultation"}</span>}
            {!collapsed && <kbd>N</kbd>}
          </button>

          <div className="sb-section">
            {!collapsed && <div className="sb-section-h">{lang === "uk" ? "Робочий простір" : "Workspace"}</div>}
            <Link icon="inbox" label={lang === "uk" ? "Сьогодні" : "Today"} path="/scribe" exact />
            <Link icon="users" label={lang === "uk" ? "Пацієнти" : "Patients"} path="/scribe/patients" prefix="/scribe/patients" />
            <Link icon="fileText" label={lang === "uk" ? "Нотатки" : "Notes"} path="/scribe/notes" />
            <Link icon="layers" label={lang === "uk" ? "Шаблони нотаток" : "Note templates"} path="/scribe/templates" />
          </div>
        </>
      ) : (
        <>
          <button className="sb-cta" onClick={onNewDictation} title={lang === "uk" ? "Нове диктування" : "New dictation"}>
            <span className="sb-cta-icon"><Icon name="mic" size={13} /></span>
            {!collapsed && <span className="sb-cta-label">{lang === "uk" ? "Нове диктування" : "New dictation"}</span>}
            {!collapsed && <kbd>D</kbd>}
          </button>

          <div className="sb-section">
            {!collapsed && <div className="sb-section-h">{lang === "uk" ? "Робочий простір" : "Workspace"}</div>}
            <Link icon="mic" label={lang === "uk" ? "Студія" : "Studio"} path="/dictate" exact />
            <Link icon="fileText" label={lang === "uk" ? "Звіти" : "Reports"} path="/dictate/reports" prefix="/dictate/reports" badge="7" />
            <Link icon="layers" label={lang === "uk" ? "Шаблони" : "Templates"} path="/dictate/templates" />
          </div>
        </>
      )}

      <div className="sb-section">
        {!collapsed && <div className="sb-section-h">{lang === "uk" ? "Адмін" : "Admin"}</div>}
        <Link icon="sliders" label={lang === "uk" ? "Налаштування" : "Settings"} path="/settings" />
        <Link icon="shield" label={lang === "uk" ? "Аудит" : "Audit log"} path="/audit" />
      </div>

      <div className="sb-spacer" />

      <div className="sb-foot">
        <div className="sb-controls">
          {!collapsed && (
            <div className="lang-pill">
              <button className={lang === "uk" ? "on" : ""} onClick={() => setLang("uk")}>UK</button>
              <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>EN</button>
            </div>
          )}
          {!collapsed && <div style={{ flex: 1 }} />}
          {!collapsed && (
            <button className="icon-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title="Theme">
              <Icon name={theme === "dark" ? "sun" : "moon"} size={14} />
            </button>
          )}
          {!collapsed && <button className="icon-btn" title="Help"><Icon name="help" size={14} /></button>}
        </div>
        <div className="sb-user">
          <div className="avatar">{(user?.display_name || "?").slice(0, 2).toUpperCase()}</div>
          {!collapsed && (
            <>
              <div className="sb-user-info">
                <div className="sb-user-name">{user?.display_name || (lang === "uk" ? "Гість" : "Guest")}</div>
                {user?.role && <div className="sb-user-role">{user.role}</div>}
              </div>
              <Icon name="chevRight" size={14} />
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

// ── DictateTopBar ────────────────────────────────────────────────────────
export function DictateTopBar({ route, navigate, lang, setLang, theme, setTheme }) {
  const tabs = [
    { icon: "mic", labelUk: "Диктування", labelEn: "Studio", path: "/dictate", exact: true },
    { icon: "fileText", labelUk: "Звіти", labelEn: "Reports", path: "/dictate/reports", badge: "7" },
    { icon: "layers", labelUk: "Шаблони", labelEn: "Templates", path: "/dictate/templates" },
  ];
  return (
    <header className="dtb">
      <div className="dtb-brand" onClick={() => navigate("/dictate")}>
        <Logo size={26} />
        <span>Klarnote</span>
      </div>
      <nav className="dtb-nav">
        {tabs.map((tab) => {
          const active = tab.exact ? route === tab.path : route.startsWith(tab.path);
          const label = lang === "uk" ? tab.labelUk : tab.labelEn;
          return (
            <button key={tab.path} className={"dtb-tab" + (active ? " on" : "")} onClick={() => navigate(tab.path)}>
              <Icon name={tab.icon} size={14} />
              <span>{label}</span>
              {tab.badge && <span className="badge">{tab.badge}</span>}
            </button>
          );
        })}
      </nav>
      <div className="dtb-right">
        <div className="lang-pill">
          <button className={lang === "uk" ? "on" : ""} onClick={() => setLang("uk")}>UK</button>
          <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>EN</button>
        </div>
        <button className="icon-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title="Theme">
          <Icon name={theme === "dark" ? "sun" : "moon"} size={14} />
        </button>
        <button className="icon-btn" title="Help"><Icon name="help" size={14} /></button>
        <button className="icon-btn" title="Notifications"><Icon name="bell" size={14} /></button>
        <button className="dtb-user" title="Profile">
          <div className="avatar">КВ</div>
        </button>
      </div>
    </header>
  );
}

// ── TopBar ──────────────────────────────────────────────────────────────
export function TopBar({ title, subtitle, crumbs, back, onBack, right, search, lang }) {
  return (
    <header className="tb">
      {back && (
        <button className="tb-back" onClick={onBack} title="Back"><Icon name="arrowLeft" size={16} /></button>
      )}
      {crumbs ? (
        <nav className="tb-crumbs">
          {crumbs.map((c, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="sep">/</span>}
              {c.path ? <a onClick={c.onClick}>{c.label}</a> : <span className="cur">{c.label}</span>}
            </React.Fragment>
          ))}
        </nav>
      ) : (
        <div>
          <div className="tb-title">{title}</div>
          {subtitle && <div className="tb-sub">{subtitle}</div>}
        </div>
      )}
      <div className="tb-spacer" />
      {search !== false && (
        <div className="tb-search">
          <Icon name="search" size={14} />
          <input placeholder={lang === "uk" ? "Пошук…" : "Search…"} />
          <kbd>⌘K</kbd>
        </div>
      )}
      {right}
    </header>
  );
}

// ── Toast ───────────────────────────────────────────────────────────────
export function Toast({ message, action, onAction, onClose, duration = 3500 }) {
  React.useEffect(() => {
    const id = setTimeout(onClose, duration);
    return () => clearTimeout(id);
  }, [onClose, duration]);
  return (
    <div className="toast">
      <span>{message}</span>
      {action && <button onClick={onAction}>{action}</button>}
    </div>
  );
}

// ── Modal ───────────────────────────────────────────────────────────────
export function Modal({ children, onClose }) {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// ── SaveStatus ──────────────────────────────────────────────────────────
export function SaveStatus({ state, lastSavedAt }) {
  const { t, lang } = useI18n();
  const since = lastSavedAt ? Math.max(0, Math.floor((Date.now() - lastSavedAt) / 60000)) : 0;
  const labels = {
    saved: since === 0 ? (lang === "uk" ? "Збережено" : "Saved") : (lang === "uk" ? `Збережено ${since} хв тому` : `Saved ${since} min ago`),
    saving: lang === "uk" ? "Збереження…" : "Saving…",
    unsaved: lang === "uk" ? "Незбережено" : "Unsaved",
    error: lang === "uk" ? "Помилка збереження" : "Save error",
  };
  return (
    <div className="save-status" data-state={state}>
      <span className="dot" />
      <span>{labels[state]}</span>
    </div>
  );
}

// ── Empty state ─────────────────────────────────────────────────────────
export function Empty({ icon = "fileText", title, body, action }) {
  return (
    <div className="empty">
      <Icon name={icon} size={36} />
      <h3>{title}</h3>
      {body && <p>{body}</p>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}
