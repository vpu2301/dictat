// OverviewTab.jsx — the platform owner's first screen. Everything on it is a
// real number from a real endpoint; anything the backend cannot answer is shown
// as an explicit gap chip, never as a zero.
import React, { useMemo } from "react";
import { useAsync } from "../../api/useAsync.js";
import { StatCard } from "../../components/dashboard/StatCard.jsx";
import { Panel, PanelState } from "../../components/dashboard/Panel.jsx";
import { StatusBadge } from "../../components/dashboard/StatusBadge.jsx";
import { MiniBarChart } from "../../components/dashboard/MiniBarChart.jsx";
import { Icon } from "../../components/UI.jsx";
import { tr } from "../../i18n.js";
import {
  fetchTenantPortfolio,
  portfolioSummary,
  fetchPlatformHealth,
  fetchAuditTelemetry,
  fetchSubscriptionPicture,
  securitySignals,
  SERVICE_ROLE,
} from "../../api/company.js";

export function OverviewTab({ lang, rangeDays, activeTid, onGo }) {
  const T = (uk, en) => tr(lang, uk, en);

  const portfolioReq = useAsync(() => fetchTenantPortfolio(activeTid), [activeTid]);
  const healthReq = useAsync(() => fetchPlatformHealth(), []);
  const subsReq = useAsync(() => fetchSubscriptionPicture(), []);
  const auditReq = useAsync(() => fetchAuditTelemetry(rangeDays), [rangeDays]);

  const portfolio = useMemo(
    () => (portfolioReq.data ? portfolioSummary(portfolioReq.data) : null),
    [portfolioReq.data],
  );
  const signals = useMemo(
    () => (auditReq.data ? securitySignals(auditReq.data) : []),
    [auditReq.data],
  );

  return (
    <div className="co-stack">
      {/* ── KPI row ─────────────────────────────────────────────────── */}
      <div className="co-kpis">
        <StatCard
          label={T("Тенанти", "Tenants")}
          icon="building"
          accent
          loading={portfolioReq.loading}
          error={portfolioReq.error}
          value={portfolio ? portfolio.tenants : "—"}
          sublabel={portfolio
            ? `${portfolio.activeTenants} ${T("активних", "active")}${portfolio.suspendedTenants ? ` · ${portfolio.suspendedTenants} ${T("призупинених", "suspended")}` : ""}`
            : undefined}
        />
        <StatCard
          label={T("Люди в портфелі", "People in portfolio")}
          icon="users"
          loading={portfolioReq.loading}
          error={portfolioReq.error}
          value={portfolio ? portfolio.people : "—"}
          sublabel={portfolio
            ? `${portfolio.memberships} ${T("членств", "memberships")}`
            : undefined}
        />
        <StatCard
          label={T("Місця (активний тенант)", "Seats (active tenant)")}
          icon="user"
          loading={subsReq.loading}
          error={subsReq.error}
          value={subsReq.data ? subsReq.data.seats.active : "—"}
          sublabel={subsReq.data
            ? `${subsReq.data.clinicalSeats} ${T("клінічних", "clinical")} · ${T("тариф", "tier")} ${subsReq.data.plan.name}`
            : undefined}
        />
        <StatCard
          label={T("Сервіси готові", "Services ready")}
          icon="pulse"
          loading={healthReq.loading}
          error={healthReq.error}
          value={healthReq.data ? `${healthReq.data.ready}/${healthReq.data.total}` : "—"}
          sublabel={healthReq.data
            ? (healthReq.data.overall === "ready"
                ? T("уся платформа обслуговує", "whole platform serving")
                : T("є непрацездатні — див. Телеметрію", "degraded — see Telemetry"))
            : undefined}
        />
        <StatCard
          label={T("Події аудиту", "Audit events")}
          icon="history"
          loading={auditReq.loading}
          error={auditReq.error}
          value={auditReq.data ? auditReq.data.total : "—"}
          approx={auditReq.data?.capped}
          sublabel={auditReq.data
            ? `${T("за", "over")} ${rangeDays}d · ${T("активний тенант", "active tenant")}`
            : undefined}
        />
      </div>

      <div className="co-2col">
        {/* ── Tenant portfolio preview ─────────────────────────────── */}
        <Panel title={T("Портфель тенантів", "Tenant portfolio")} icon="building"
               sub={portfolioReq.data?.capped
                 ? T(`перші ${portfolioReq.data.cap}`, `first ${portfolioReq.data.cap}`)
                 : undefined}>
          {(portfolioReq.loading || portfolioReq.error) ? (
            <PanelState loading={portfolioReq.loading} error={portfolioReq.error}
                        onRetry={portfolioReq.reload} lang={lang} />
          ) : !portfolioReq.data.tenants.length ? (
            <div className="co-empty">
              {T("Цей акаунт не належить до жодного тенанта.", "This account belongs to no tenant.")}
            </div>
          ) : (
            <>
              <ul className="co-tenant-mini">
                {portfolioReq.data.tenants.slice(0, 6).map((t) => (
                  <li key={t.id}>
                    <span className="co-tenant-dot" data-active={t.isActive ? "1" : undefined} />
                    <span className="co-tenant-name">
                      {t.display_name || t.name}
                      {t.isActive && <em className="co-tenant-you">{T("активний", "active")}</em>}
                    </span>
                    <span className="co-tenant-meta">
                      {t.members.length} {T("уч.", "mem")}
                      {t.detail?.country ? ` · ${t.detail.country}` : ""}
                    </span>
                    <StatusBadge status={t.is_active === false ? "deactivated" : (t.status || "active")} />
                  </li>
                ))}
              </ul>
              {portfolioReq.data.tenants.length > 6 && (
                <button className="co-link" onClick={() => onGo("tenants")}>
                  {T(`Показати всі ${portfolioReq.data.tenants.length}`, `See all ${portfolioReq.data.tenants.length}`)}
                  <Icon name="chevRight" size={12} />
                </button>
              )}
              {portfolio?.countries.length > 0 && (
                <div className="co-inline-facts">
                  <span>{T("Країни", "Countries")}: {portfolio.countries.join(", ")}</span>
                  <span>{T("Локалі", "Locales")}: {portfolio.locales.join(", ")}</span>
                </div>
              )}
            </>
          )}
        </Panel>

        {/* ── Service health roll-up ───────────────────────────────── */}
        <Panel title={T("Стан платформи", "Platform health")} icon="pulse"
               sub={healthReq.data ? new Date(healthReq.data.checkedAt).toLocaleTimeString() : undefined}>
          {(healthReq.loading || healthReq.error) ? (
            <PanelState loading={healthReq.loading} error={healthReq.error}
                        onRetry={healthReq.reload} lang={lang} />
          ) : (
            <ul className="co-health-mini">
              {healthReq.data.services.map((s) => (
                <li key={s.key} className={"s-" + s.state}>
                  <span className="co-health-dot" />
                  <span className="co-health-name">{s.key}</span>
                  <span className="co-health-role">
                    {SERVICE_ROLE[s.key] ? T(SERVICE_ROLE[s.key].uk, SERVICE_ROLE[s.key].en) : ""}
                  </span>
                  <span className="co-health-ms">{s.state === "ready" ? `${s.ms} ms` : T("недоступно", "down")}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* ── Audit activity + security signals ────────────────────────── */}
      <Panel title={T("Активність аудиту", "Audit activity")} icon="history"
             sub={auditReq.data?.capped
               ? T(`обмежено ${auditReq.data.cap} подіями`, `capped at ${auditReq.data.cap} events`)
               : undefined}
             gapNote={T("Аудит обмежений RLS до активного тенанта.",
                        "The audit stream is RLS-scoped to the active tenant.")}>
        {(auditReq.loading || auditReq.error) ? (
          <PanelState loading={auditReq.loading} error={auditReq.error}
                      onRetry={auditReq.reload} lang={lang} />
        ) : auditReq.data.total === 0 ? (
          <div className="co-empty">{T("Жодної події за період.", "No events in this window.")}</div>
        ) : (
          <>
            <MiniBarChart data={auditReq.data.series} height={72}
                          formatLabel={(b) => `${b.key}: ${b.value}`} />
            <div className="co-kindrow">
              {auditReq.data.topKinds.slice(0, 8).map(([kind, n]) => (
                <span className="co-kindchip" key={kind} title={kind}>
                  <code>{kind}</code><b>{n}</b>
                </span>
              ))}
            </div>
            {signals.length > 0 && (
              <div className="co-signals">
                <strong><Icon name="alert" size={13} /> {T("Сигнали безпеки", "Security signals")}</strong>
                {signals.map((s) => (
                  <span className="co-signal" key={s.kind}><code>{s.kind}</code> × {s.count}</span>
                ))}
              </div>
            )}
            <button className="co-link" onClick={() => onGo("telemetry")}>
              {T("Уся телеметрія", "Full telemetry")} <Icon name="chevRight" size={12} />
            </button>
          </>
        )}
      </Panel>
    </div>
  );
}
