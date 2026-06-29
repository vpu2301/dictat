// DashboardPage.jsx — Business-owner (tenant_admin) dashboard. Route #/dashboard.
// Layout: 4 KPI StatCards → usage trend + reports-by-status → doctors table →
// product capabilities. A header date-range selector (7/30/90d) drives the
// usage/reports queries. Each panel loads/handles errors independently.
// A sticky section scroll-menu jumps between panels and scroll-spies the
// active one as the page scrolls.
import React, { useState, useMemo, useEffect, useRef } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import { LicensePanel } from "../components/dashboard/LicensePanel.jsx";
import { UsagePanel } from "../components/dashboard/UsagePanel.jsx";
import { DoctorsPanel } from "../components/dashboard/DoctorsPanel.jsx";
import { ReportsPanel } from "../components/dashboard/ReportsPanel.jsx";
import { CapabilitiesPanel } from "../components/dashboard/CapabilitiesPanel.jsx";

const RANGES = [7, 30, 90];

export function DashboardPage({ lang = "en", navigate }) {
  const T = (uk, en) => (lang === "uk" ? uk : en);
  const { state } = useAuth();
  const [rangeDays, setRangeDays] = useState(30);

  const tenant = useMemo(() => {
    const c = state?.claims;
    return state?.dbUser?.tenant_name || c?.tenant_name || c?.tid || "";
  }, [state]);

  // Section scroll-menu: jump targets + active-section scroll-spy.
  const SECTIONS = useMemo(
    () => [
      { id: "licenses", label: T("Ліцензії", "Licenses") },
      { id: "usage", label: T("Використання", "Usage") },
      { id: "doctors", label: T("Лікарі", "Doctors") },
      { id: "capabilities", label: T("Можливості", "Capabilities") },
    ],
    [lang]
  );
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);

  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean);
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActiveSection(visible[0].target.id);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.25, 0.5, 1] }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [SECTIONS]);

  const goTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveSection(id);
  };

  return (
    <div className="dashboard">
      <header className="dash-head">
        <div>
          <h1>{T("Панель власника", "Owner dashboard")}</h1>
          <p className="muted">
            {T("Стан вашого акаунту з першого погляду.", "Your account health at a glance.")}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {tenant && (
            <span className="dash-tenant" title={T("Тенант", "Tenant")}>
              {String(tenant).slice(0, 18)}
            </span>
          )}
          <div className="dash-range" role="tablist" aria-label={T("Період", "Date range")}>
            {RANGES.map((d) => (
              <button key={d} className={rangeDays === d ? "on" : ""}
                      aria-pressed={rangeDays === d}
                      onClick={() => setRangeDays(d)}>
                {d}d
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Sticky section scroll-menu */}
      <nav className="dash-scrollmenu" aria-label={T("Розділи панелі", "Dashboard sections")}>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            className={activeSection === s.id ? "on" : ""}
            aria-current={activeSection === s.id ? "true" : undefined}
            onClick={() => goTo(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {/* Row 1 — Licenses/seats (KPIs + quota) */}
      <section id="licenses" className="dash-section">
        <LicensePanel lang={lang} />
      </section>

      {/* Row 2 — Usage trend + Reports by status */}
      <section id="usage" className="dash-section">
        <div className="dash-2col">
          <UsagePanel lang={lang} rangeDays={rangeDays} />
          <ReportsPanel lang={lang} rangeDays={rangeDays} navigate={navigate} />
        </div>
      </section>

      {/* Row 3 — Doctors */}
      <section id="doctors" className="dash-section">
        <DoctorsPanel lang={lang} navigate={navigate} />
      </section>

      {/* Row 4 — Product capabilities */}
      <section id="capabilities" className="dash-section">
        <CapabilitiesPanel lang={lang} />
      </section>
    </div>
  );
}
