// CompanyPage.jsx — the Klarnote *platform owner* console. Route #/company.
//
// This is the vendor's view, not a clinic's: the portfolio of tenants, the
// people in them, what the platform is being used for, the commercial picture,
// and live telemetry. It deliberately separates what the backend can actually
// answer today from what it cannot — see the Gaps tab and src/api/company.js.
//
// Access is an email allowlist (src/company/ownerAccess.js) because the backend
// has no platform-owner role. That gate is presentation only; the API is still
// the authority on every byte this page renders.

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import { hasClinicalAccess } from "../auth/roles.js";
import { logout as apiLogout } from "../api/endpoints.js";
import { ownerEmailOf, ownerGateReason, OWNER_EMAILS } from "./ownerAccess.js";
import { Icon } from "../components/UI.jsx";
import { tr } from "../i18n.js";
import { APP_VERSION } from "../api/services.js";

import { OverviewTab } from "./panels/OverviewTab.jsx";
import { BusinessTab } from "./panels/BusinessTab.jsx";
import { TenantsTab } from "./panels/TenantsTab.jsx";
import { TemplatesTab } from "./panels/TemplatesTab.jsx";
import { UsageTab } from "./panels/UsageTab.jsx";
import { SubscriptionsTab } from "./panels/SubscriptionsTab.jsx";
import { TechnicalTab } from "./panels/TechnicalTab.jsx";
import { TelemetryTab } from "./panels/TelemetryTab.jsx";
import { SupportTab } from "./panels/SupportTab.jsx";
import { ErrorsTab } from "./panels/ErrorsTab.jsx";
import { SecurityTab } from "./panels/SecurityTab.jsx";
import { OperationsTab } from "./panels/OperationsTab.jsx";
import { InfrastructureTab } from "./panels/InfrastructureTab.jsx";
import { RoadmapTab } from "./panels/RoadmapTab.jsx";

const RANGES = [7, 30, 90];

// Grouped so the nav reads as three jobs rather than a dozen buttons:
// run the company · run the customers · run the platform.
export const COMPANY_TABS = [
  { id: "overview",      group: "company",   icon: "grid",     uk: "Огляд",         en: "Overview" },
  { id: "business",      group: "company",   icon: "card",     uk: "Бізнес",        en: "Business" },
  { id: "subscriptions", group: "company",   icon: "tag",      uk: "Підписки",      en: "Subscriptions" },
  { id: "support",       group: "company",   icon: "inbox",    uk: "Підтримка",     en: "Support" },
  { id: "tenants",       group: "customers", icon: "building", uk: "Тенанти",       en: "Tenants" },
  { id: "templates",     group: "customers", icon: "layers",   uk: "Шаблони",       en: "Templates" },
  { id: "usage",         group: "customers", icon: "activity", uk: "Використання",  en: "Usage" },
  { id: "technical",     group: "platform",  icon: "layers",   uk: "Технічно",      en: "Technical" },
  { id: "telemetry",     group: "platform",  icon: "pulse",    uk: "Телеметрія",    en: "Telemetry" },
  { id: "errors",        group: "platform",  icon: "alert",    uk: "Помилки",       en: "Errors" },
  { id: "security",      group: "platform",  icon: "shield",   uk: "Безпека",       en: "Security" },
  { id: "operations",    group: "platform",  icon: "sliders",  uk: "Операції",      en: "Operations" },
  { id: "infrastructure", group: "platform", icon: "globe",    uk: "Інфраструктура", en: "Infrastructure" },
  { id: "roadmap",       group: "platform",  icon: "sparkle",  uk: "Дорожня карта", en: "Roadmap" },
];

const TAB_GROUPS = [
  { id: "company",   uk: "Компанія",  en: "Company" },
  { id: "customers", uk: "Клієнти",   en: "Customers" },
  { id: "platform",  uk: "Платформа", en: "Platform" },
];

export function CompanyPage({ lang = "en", navigate, tab = "overview" }) {
  const T = (uk, en) => tr(lang, uk, en);
  const { state, clear } = useAuth();
  const [rangeDays, setRangeDays] = useState(30);
  const [nonce, setNonce] = useState(0);        // global "refresh everything"
  const [signingOut, setSigningOut] = useState(false);

  // Sign-out returns to the STAFF door, not the clinic's — a Klarnote session
  // that ends should offer to start another Klarnote session.
  const signOut = async () => {
    setSigningOut(true);
    try { await apiLogout(); } catch { /* the local token is dropped regardless */ }
    clear();
    navigate("/company/login");
  };

  const gate = ownerGateReason(state);
  const activeTab = COMPANY_TABS.some((t) => t.id === tab) ? tab : "overview";

  // Unauthenticated → the STAFF door, not the clinic's. This is the whole
  // reason the console is excluded from App's shared auth gate.
  useEffect(() => {
    if (gate === "no-session" && typeof navigate === "function") navigate("/company/login");
  }, [gate, navigate]);

  const activeTid = state?.claims?.tid || null;
  const email = ownerEmailOf(state);

  if (gate === "no-session") return null;
  if (gate === "not-owner") {
    return <NotOwner lang={lang} navigate={navigate} email={email} onSignOut={signOut}
                     clinical={hasClinicalAccess(state?.claims)} signingOut={signingOut} />;
  }

  const go = (id) => navigate(`/company/${id}`);
  // Drives the page <h1>: the rail already says where you are, so the header
  // should name the section rather than repeat the brand on every screen.
  const activeMeta = COMPANY_TABS.find((t) => t.id === activeTab) || COMPANY_TABS[0];

  return (
    <div className="company">
      {/* Left rail. The console has outgrown a tab strip — thirteen sections
          across three jobs need a nav you can scan vertically, and grouping
          them by job (run the company / the customers / the platform) is what
          makes the size legible rather than overwhelming. */}
      <nav className="co-rail" aria-label={T("Розділи консолі", "Console sections")}>
        <div className="co-rail-brand">
          <span className="co-rail-mark"><Icon name="shield" size={15} /></span>
          <div>
            <strong>Klarnote</strong>
            <span>{T("Консоль платформи", "Platform console")}</span>
          </div>
        </div>

        <div className="co-rail-scroll">
          {TAB_GROUPS.map((g) => (
            <div className="co-rail-group" key={g.id}>
              <span className="co-rail-label">{T(g.uk, g.en)}</span>
              {COMPANY_TABS.filter((t) => t.group === g.id).map((t) => (
                <button key={t.id} className={activeTab === t.id ? "on" : ""}
                        aria-current={activeTab === t.id ? "page" : undefined}
                        onClick={() => go(t.id)}>
                  <Icon name={t.icon} size={15} />
                  <span>{T(t.uk, t.en)}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="co-rail-foot">
          <span className="co-rail-acct" title={email}>{email || "—"}</span>
          <span className="co-rail-tid" title={T("Активний тенант у токені", "Token-scoped tenant")}>
            tid {activeTid ? String(activeTid).slice(0, 8) : "—"} · SPA v{APP_VERSION}
          </span>
          {hasClinicalAccess(state?.claims) && (
            <button onClick={() => navigate("/")}>
              <Icon name="home" size={13} /> {T("Клініка", "Clinic app")}
            </button>
          )}
          <button className="co-signout" onClick={signOut} disabled={signingOut}>
            <Icon name="arrowLeft" size={13} />
            {signingOut ? T("Вихід…", "Signing out…") : T("Вийти", "Sign out")}
          </button>
        </div>
      </nav>

      <div className="co-main">
        <header className="co-head">
          <div className="co-head-id">
            <h1>{T(activeMeta.uk, activeMeta.en)}</h1>
            <p className="co-head-sub">
              {T("Уся платформа з одного місця — тенанти, люди, використання, комерція, телеметрія.",
                 "The whole platform in one place — tenants, people, usage, commercials, telemetry.")}
            </p>
          </div>
          <div className="co-head-actions">
            <div className="co-range" role="tablist" aria-label={T("Період", "Date range")}>
              {RANGES.map((d) => (
                <button key={d} className={rangeDays === d ? "on" : ""} aria-pressed={rangeDays === d}
                        onClick={() => setRangeDays(d)}>{d}d</button>
              ))}
            </div>
            <button className="co-refresh" onClick={() => setNonce((n) => n + 1)}
                    title={T("Оновити всі панелі", "Refresh every panel")}>
              <Icon name="refresh" size={13} /> {T("Оновити", "Refresh")}
            </button>
          </div>
        </header>

        <ScopeBanner lang={lang} activeTid={activeTid} />

        <div className="co-body" key={`${activeTab}-${nonce}`}>
          {activeTab === "overview"      && <OverviewTab lang={lang} rangeDays={rangeDays} activeTid={activeTid} navigate={navigate} onGo={go} />}
          {activeTab === "business"      && <BusinessTab lang={lang} rangeDays={rangeDays} activeTid={activeTid} />}
          {activeTab === "subscriptions" && <SubscriptionsTab lang={lang} />}
          {activeTab === "support"       && <SupportTab lang={lang} rangeDays={rangeDays} />}
          {activeTab === "tenants"       && <TenantsTab lang={lang} activeTid={activeTid} />}
          {activeTab === "templates"     && <TemplatesTab lang={lang} />}
          {activeTab === "usage"         && <UsageTab lang={lang} rangeDays={rangeDays} navigate={navigate} />}
          {activeTab === "technical"     && <TechnicalTab lang={lang} />}
          {activeTab === "telemetry"     && <TelemetryTab lang={lang} rangeDays={rangeDays} navigate={navigate} />}
          {activeTab === "errors"        && <ErrorsTab lang={lang} rangeDays={rangeDays} />}
          {activeTab === "security"      && <SecurityTab lang={lang} rangeDays={rangeDays} navigate={navigate} />}
          {activeTab === "operations"    && <OperationsTab lang={lang} rangeDays={rangeDays} navigate={navigate} />}
          {activeTab === "infrastructure" && <InfrastructureTab lang={lang} />}
          {activeTab === "roadmap"       && <RoadmapTab lang={lang} />}
        </div>
      </div>
    </div>
  );
}

// One honest, permanent statement of what this console can and cannot see.
// Repeating it per panel would be noise; hiding it would be dishonest.
function ScopeBanner({ lang, activeTid }) {
  const T = (uk, en) => tr(lang, uk, en);
  const [open, setOpen] = useState(false);
  return (
    <div className={"co-scope" + (open ? " open" : "")}>
      <button className="co-scope-h" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Icon name="info" size={13} />
        <span>
          {T("Портфель тенантів — крос-тенантний. Глибокі дані — лише активний тенант.",
             "Tenant portfolio is cross-tenant. Deep data is active-tenant only.")}
        </span>
        <Icon name={open ? "chevUp" : "chevDown"} size={13} />
      </button>
      {open && (
        <div className="co-scope-body">
          <p>
            {T("Профіль і склад учасників кожного тенанта, до якого ви належите, читаються напряму — auth-service перевіряє членство й обслуговує ці три ендпоінти поза RLS-пулом:",
               "Every tenant you belong to resolves its profile and member roster directly — auth-service checks membership and serves these three endpoints off the non-RLS pool:")}
            {" "}
            <code>GET /tenants</code>, <code>GET /tenants/{"{id}"}</code>, <code>GET /tenants/{"{id}"}/members</code>.
          </p>
          <p>
            {T("Усе інше — користувачі, звіти, сесії, ASR-завдання, аудит — обмежене RLS до тенанта в токені",
               "Everything else — users, reports, sessions, ASR jobs, audit — is RLS-scoped to the tenant in your token")}
            {activeTid ? ` (tid ${String(activeTid).slice(0, 8)}…)` : ""}.{" "}
            {T("Перемикання тенанта потребує повторної автентифікації, тому портфельні цифри використання поки неможливі — див. вкладку «Прогалини».",
               "Switching tenant needs re-authentication, so portfolio-wide usage numbers are not possible yet — see the Gaps tab.")}
          </p>
        </div>
      )}
    </div>
  );
}

function NotOwner({ lang, navigate, email, onSignOut, clinical, signingOut }) {
  const T = (uk, en) => tr(lang, uk, en);
  return (
    <div className="company co-forbidden">
      <div className="co-forbidden-card">
        <span className="co-forbidden-icon"><Icon name="shield" size={22} /></span>
        <h1>{T("Консоль власника платформи", "Platform owner console")}</h1>
        <p>
          {T("Ця сторінка призначена для власників Klarnote, а не для адміністраторів клінік.",
             "This page is for Klarnote's owners, not for clinic administrators.")}
        </p>
        <p className="co-forbidden-detail">
          {T("Ви увійшли як", "You are signed in as")} <strong>{email || "—"}</strong>.{" "}
          {T("Доступ мають лише акаунти зі списку власників", "Access is limited to the owner allowlist")}
          {" "}(<code>VITE_PLATFORM_OWNER_EMAILS</code>
          {OWNER_EMAILS.length === 1 ? ` — ${OWNER_EMAILS[0]}` : ""}).
        </p>
        {/* Full-bleed page — these are the only ways out, so both a route back
            into the clinic app and a sign-out have to be here. */}
        <div className="co-forbidden-actions">
          {clinical && (
            <button className="colog-btn primary" onClick={() => navigate("/")}>
              {T("До робочого простору", "Go to my workspace")}
            </button>
          )}
          <button className="colog-btn" onClick={() => navigate("/dashboard")}>
            {T("Панель клініки", "Clinic dashboard")}
          </button>
          <button className="colog-btn ghost" onClick={onSignOut} disabled={signingOut}>
            {signingOut ? T("Вихід…", "Signing out…") : T("Вийти", "Sign out")}
          </button>
        </div>
      </div>
    </div>
  );
}
