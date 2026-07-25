// BusinessTab.jsx — Klarnote as a business, not as a product.
//
// Three tiers of honesty, badged on every tile (see ../provenance.jsx):
//   live    — tenants, seats, signed reports. Real endpoints, this page load.
//   derived — ARPA, seat expansion, activation. Real inputs, stated assumptions.
//   mock    — MRR, churn, CAC, funnel, support, runway. NOT measured; every one
//             comes from ../mockData.js and says what would make it real.
//
// The mocked half is deliberately the half that needs systems Klarnote has not
// built: there is no billing service, no CRM, no helpdesk. Showing the report
// we want is useful; showing it without saying which numbers are invented would
// not be.
import React, { useMemo } from "react";
import { useAsync } from "../../api/useAsync.js";
import { Panel, PanelState } from "../../components/dashboard/Panel.jsx";
import { StatCard } from "../../components/dashboard/StatCard.jsx";
import { MiniBarChart } from "../../components/dashboard/MiniBarChart.jsx";
import { Sparkline } from "../../components/dashboard/Sparkline.jsx";
import { Icon } from "../../components/UI.jsx";
import { tr } from "../../i18n.js";
import { Provenance, ProvenanceLegend, MockBanner } from "../provenance.jsx";
import {
  fetchTenantPortfolio,
  portfolioSummary,
  fetchSubscriptionPicture,
  fetchReportStats,
  fetchSessionUsage,
} from "../../api/company.js";
import {
  MOCK_ACQUISITION,
  MOCK_FUNNEL,
  MOCK_METRIC_COUNT,
  MOCK_MRR_SERIES,
  MOCK_NOTICE_EN,
  MOCK_NOTICE_UK,
  MOCK_RETENTION,
  MOCK_REVENUE,
  MOCK_RUNWAY,
  MOCK_SUPPORT,
  MOCK_TENANT_SERIES,
} from "../mockData.js";

const usd = (n) => (n == null ? "—" : `$${Number(n).toLocaleString()}`);
const pct = (n) => (n == null ? "—" : `${n}%`);

export function BusinessTab({ lang, rangeDays, activeTid }) {
  const T = (uk, en) => tr(lang, uk, en);
  const isUk = lang === "uk";

  const portfolioReq = useAsync(() => fetchTenantPortfolio(activeTid), [activeTid]);
  const subsReq = useAsync(() => fetchSubscriptionPicture(), []);
  const reportsReq = useAsync(() => fetchReportStats(rangeDays), [rangeDays]);
  const sessionsReq = useAsync(() => fetchSessionUsage(rangeDays), [rangeDays]);

  const portfolio = useMemo(
    () => (portfolioReq.data ? portfolioSummary(portfolioReq.data) : null),
    [portfolioReq.data],
  );

  // ── Derived: real inputs, assumptions stated in the badge tooltip ──────
  const tenants = portfolio?.tenants ?? null;
  const clinicalSeats = subsReq.data?.clinicalSeats ?? null;
  const seatsPerTenant = (tenants && clinicalSeats != null && tenants > 0)
    ? (clinicalSeats / tenants).toFixed(1)
    : null;
  // ARPA off the MOCK MRR — so it is mock-tainted, and badged as such rather
  // than laundered into "derived" by touching one live number.
  const arpaUsd = tenants ? Math.round(MOCK_REVENUE.mrrUsd / tenants) : null;
  const mrrGrowthPct = MOCK_REVENUE.mrrPrevUsd
    ? (((MOCK_REVENUE.mrrUsd - MOCK_REVENUE.mrrPrevUsd) / MOCK_REVENUE.mrrPrevUsd) * 100).toFixed(1)
    : null;
  const netNewMrr = MOCK_REVENUE.expansionMrrUsd - MOCK_REVENUE.contractionMrrUsd - MOCK_REVENUE.churnedMrrUsd;
  const ltvCac = (MOCK_ACQUISITION.ltvUsd / MOCK_ACQUISITION.cacUsd).toFixed(1);

  const signedReports = reportsReq.data?.counts?.signed ?? null;
  const minutes = sessionsReq.data?.minutes ?? null;

  const funnelMax = Math.max(...MOCK_FUNNEL.stages.map((s) => s.count), 1);

  return (
    <div className="co-stack">
      <MockBanner
        lang={lang}
        what={isUk ? MOCK_NOTICE_UK : MOCK_NOTICE_EN}
        need={isUk
          ? "білінг, CRM і служба підтримки з API — див. вкладку «Дорожня карта»."
          : "billing, a CRM and a helpdesk with APIs — see the Roadmap tab."}
      />
      <ProvenanceLegend lang={lang} mockCount={MOCK_METRIC_COUNT} />

      {/* ── Revenue ─────────────────────────────────────────────────── */}
      <h3 className="co-sectionhead">{T("Дохід", "Revenue")}</h3>
      <div className="co-kpis">
        <StatCard label={T("MRR", "MRR")} icon="card" accent value={usd(MOCK_REVENUE.mrrUsd)}
                  sublabel={mrrGrowthPct != null ? `${mrrGrowthPct > 0 ? "+" : ""}${mrrGrowthPct}% ${T("до попереднього міс.", "vs prev month")}` : undefined}>
          <Provenance source="mock" lang={lang} note={MOCK_REVENUE.need} />
        </StatCard>
        <StatCard label={T("ARR", "ARR")} icon="activity" value={usd(MOCK_REVENUE.arrUsd)}
                  sublabel={T("MRR × 12", "MRR × 12")}>
          <Provenance source="mock" lang={lang} note={MOCK_REVENUE.need} />
        </StatCard>
        <StatCard label={T("Чистий новий MRR", "Net new MRR")} icon="pulse" value={usd(netNewMrr)}
                  sublabel={`+${usd(MOCK_REVENUE.expansionMrrUsd)} / −${usd(MOCK_REVENUE.contractionMrrUsd + MOCK_REVENUE.churnedMrrUsd)}`}>
          <Provenance source="mock" lang={lang} note={MOCK_REVENUE.need} />
        </StatCard>
        <StatCard label={T("ARPA", "ARPA")} icon="building" value={usd(arpaUsd)}
                  sublabel={tenants ? `${T("на", "across")} ${tenants} ${T("тенантів", "tenants")}` : undefined}
                  loading={portfolioReq.loading}>
          <Provenance source="mock" lang={lang}
                      note={T("Тенанти справжні, MRR — ні, тому результат теж макет.",
                              "The tenant count is real, the MRR is not — so this is a mock too.")} />
        </StatCard>
      </div>

      <div className="co-2col">
        <Panel title={T("MRR за 12 місяців", "MRR over 12 months")} icon="activity">
          <MiniBarChart data={MOCK_MRR_SERIES} height={90}
                        formatLabel={(b) => `${b.key}: $${b.value.toLocaleString()}`} />
          <div className="co-axis">
            <span>{usd(MOCK_MRR_SERIES[0].value)}</span>
            <span><Provenance source="mock" lang={lang} compact note={MOCK_REVENUE.need} /></span>
            <span>{usd(MOCK_MRR_SERIES[MOCK_MRR_SERIES.length - 1].value)}</span>
          </div>
        </Panel>

        <Panel title={T("Утримання", "Retention")} icon="heart">
          <div className="co-metricrows">
            <MetricRow label={T("Чисте утримання доходу (NRR)", "Net revenue retention")}
                       value={pct(MOCK_RETENTION.netRevenueRetentionPct)}
                       source="mock" note={MOCK_RETENTION.need} lang={lang} good={MOCK_RETENTION.netRevenueRetentionPct >= 100} />
            <MetricRow label={T("Відтік клієнтів (валовий)", "Gross logo churn")}
                       value={pct(MOCK_RETENTION.grossLogoChurnPct)}
                       source="mock" note={MOCK_RETENTION.need} lang={lang} />
            <MetricRow label={T("Середня тривалість контракту", "Average contract length")}
                       value={`${MOCK_RETENTION.averageContractMonths} ${T("міс.", "mo")}`}
                       source="mock" note={MOCK_RETENTION.need} lang={lang} />
          </div>
        </Panel>
      </div>

      {/* ── Growth: the live half ───────────────────────────────────── */}
      <h3 className="co-sectionhead">{T("Зростання", "Growth")}</h3>
      <div className="co-kpis">
        <StatCard label={T("Активні тенанти", "Active tenants")} icon="building"
                  loading={portfolioReq.loading} error={portfolioReq.error}
                  value={portfolio ? portfolio.activeTenants : "—"}
                  sublabel={portfolio ? `${portfolio.tenants} ${T("усього", "total")}` : undefined}>
          <Provenance source="live" lang={lang} note="GET /tenants" />
        </StatCard>
        <StatCard label={T("Клінічні місця", "Clinical seats")} icon="users"
                  loading={subsReq.loading} error={subsReq.error}
                  value={clinicalSeats ?? "—"}
                  sublabel={T("активний тенант", "active tenant only")}>
          <Provenance source="live" lang={lang} note="GET /admin/users" />
        </StatCard>
        <StatCard label={T("Місць на тенанта", "Seats per tenant")} icon="activity"
                  loading={portfolioReq.loading || subsReq.loading}
                  value={seatsPerTenant ?? "—"}>
          <Provenance source="derived" lang={lang}
                      note={T("Місця / тенанти. Місця видно лише для активного тенанта, тож це заниження.",
                              "Seats ÷ tenants. Seats are only visible for the active tenant, so this under-reports.")} />
        </StatCard>
        <StatCard label={T("Підписаних звітів", "Reports signed")} icon="sign"
                  loading={reportsReq.loading} error={reportsReq.error}
                  value={signedReports ?? "—"}
                  sublabel={minutes != null ? `${minutes.toLocaleString()} ${T("хв диктування", "min dictated")}` : undefined}>
          <Provenance source="live" lang={lang} note="GET /v1/reports/search?status=signed" />
        </StatCard>
      </div>

      <Panel title={T("Тенанти за 12 місяців", "Tenants over 12 months")} icon="building"
             gapNote={T("Ряд — макет: бекенд не віддає історію створення тенантів у зведеному вигляді.",
                        "The series is a mock — the backend exposes no aggregate tenant-creation history.")}>
        <MiniBarChart data={MOCK_TENANT_SERIES} height={72}
                      formatLabel={(b) => `${b.key}: ${b.value}`} />
        <div className="co-axis">
          <span>{MOCK_TENANT_SERIES[0].value}</span>
          <span><Provenance source="mock" lang={lang} compact /></span>
          <span>{MOCK_TENANT_SERIES[MOCK_TENANT_SERIES.length - 1].value}</span>
        </div>
      </Panel>

      {/* ── Acquisition ─────────────────────────────────────────────── */}
      <h3 className="co-sectionhead">{T("Залучення", "Acquisition")}</h3>
      <div className="co-2col">
        <Panel title={T("Юніт-економіка", "Unit economics")} icon="card">
          <div className="co-metricrows">
            <MetricRow label="CAC" value={usd(MOCK_ACQUISITION.cacUsd)}
                       source="mock" note={MOCK_ACQUISITION.need} lang={lang} />
            <MetricRow label="LTV" value={usd(MOCK_ACQUISITION.ltvUsd)}
                       source="mock" note={MOCK_ACQUISITION.need} lang={lang} />
            <MetricRow label="LTV : CAC" value={`${ltvCac}×`}
                       source="mock" note={MOCK_ACQUISITION.need} lang={lang} good={ltvCac >= 3} />
            <MetricRow label={T("Окупність CAC", "CAC payback")}
                       value={`${MOCK_ACQUISITION.paybackMonths} ${T("міс.", "mo")}`}
                       source="mock" note={MOCK_ACQUISITION.need} lang={lang} />
          </div>
        </Panel>

        <Panel title={T("Воронка продажів", "Sales funnel")} icon="filter"
               gapNote={isUk ? MOCK_FUNNEL.needUk : MOCK_FUNNEL.need}>
          <ul className="co-funnel">
            {MOCK_FUNNEL.stages.map((s, i) => {
              const prev = i > 0 ? MOCK_FUNNEL.stages[i - 1].count : null;
              const conv = prev ? ((s.count / prev) * 100).toFixed(0) : null;
              return (
                <li key={s.key}>
                  <span className="co-funnel-label">{isUk ? s.labelUk : s.labelEn}</span>
                  <span className="co-funnel-track">
                    <span className="co-funnel-fill" style={{ width: `${(s.count / funnelMax) * 100}%` }} />
                  </span>
                  <span className="co-funnel-n">{s.count}</span>
                  <span className="co-funnel-conv">{conv ? `${conv}%` : "—"}</span>
                </li>
              );
            })}
          </ul>
          <div className="co-axis">
            <span><Provenance source="mock" lang={lang} note={MOCK_FUNNEL.need} /></span>
            <span>
              {T("Наскрізна конверсія", "End-to-end")}:{" "}
              <b>{((MOCK_FUNNEL.stages[3].count / MOCK_FUNNEL.stages[0].count) * 100).toFixed(1)}%</b>
            </span>
          </div>
        </Panel>
      </div>

      {/* ── Operations ──────────────────────────────────────────────── */}
      <h3 className="co-sectionhead">{T("Операції", "Operations")}</h3>
      <div className="co-2col">
        <Panel title={T("Підтримка", "Support")} icon="help">
          <div className="co-metricrows">
            <MetricRow label={T("Відкриті звернення", "Open tickets")} value={MOCK_SUPPORT.openTickets}
                       source="mock" note={MOCK_SUPPORT.need} lang={lang} />
            <MetricRow label={T("Медіана першої відповіді", "Median first response")}
                       value={`${MOCK_SUPPORT.medianFirstResponseHours} ${T("год", "h")}`}
                       source="mock" note={MOCK_SUPPORT.need} lang={lang} />
            <MetricRow label="CSAT" value={pct(MOCK_SUPPORT.csatPct)}
                       source="mock" note={MOCK_SUPPORT.need} lang={lang} good={MOCK_SUPPORT.csatPct >= 90} />
          </div>
        </Panel>

        <Panel title={T("Фінансування", "Runway")} icon="clock">
          <div className="co-metricrows">
            <MetricRow label={T("Місячне спалювання", "Monthly burn")} value={usd(MOCK_RUNWAY.monthlyBurnUsd)}
                       source="mock" note={MOCK_RUNWAY.need} lang={lang} />
            <MetricRow label={T("Кошти", "Cash")} value={usd(MOCK_RUNWAY.cashUsd)}
                       source="mock" note={MOCK_RUNWAY.need} lang={lang} />
            <MetricRow label={T("Запас часу", "Runway")}
                       value={`${MOCK_RUNWAY.runwayMonths} ${T("міс.", "mo")}`}
                       source="mock" note={MOCK_RUNWAY.need} lang={lang}
                       good={MOCK_RUNWAY.runwayMonths >= 12} />
          </div>
          <p className="co-cell-sub" style={{ marginTop: 10 }}>
            {T("Фінансові дані завжди вводять вручну — продукт їх не вимірює.",
               "Finance data is always entered by hand — the product never measures it.")}
          </p>
        </Panel>
      </div>
    </div>
  );
}

function MetricRow({ label, value, source, note, lang, good }) {
  return (
    <div className="co-metricrow">
      <span className="co-metricrow-l">
        {label}
        <Provenance source={source} note={note} lang={lang} compact />
      </span>
      <span className={"co-metricrow-v" + (good === true ? " good" : good === false ? " bad" : "")}>
        {value}
      </span>
    </div>
  );
}
