// SubscriptionsTab.jsx — the commercial picture, built only from signals that
// actually exist.
//
// There is NO billing service in the backend: no plan, price, invoice, trial or
// seat-limit resource anywhere in medical-dictation-backend. Pretending otherwise
// would be the worst thing this page could do, so it does the opposite — it
// shows the two real commercial signals (the seat roster and the ASR monthly
// quota trip), maps seats onto the published plan catalogue as an explicitly
// *indicative* tier, and states plainly that nothing here is billed.
import React from "react";
import { useAsync } from "../../api/useAsync.js";
import { Panel, PanelState } from "../../components/dashboard/Panel.jsx";
import { StatCard } from "../../components/dashboard/StatCard.jsx";
import { StatusBadge } from "../../components/dashboard/StatusBadge.jsx";
import { Icon } from "../../components/UI.jsx";
import { tr } from "../../i18n.js";
import { fetchSubscriptionPicture, PLAN_CATALOGUE, indicativeMrr } from "../../api/company.js";

export function SubscriptionsTab({ lang }) {
  const T = (uk, en) => tr(lang, uk, en);
  const req = useAsync(() => fetchSubscriptionPicture(), []);
  const d = req.data;

  return (
    <div className="co-stack">
      <div className="co-note co-note-warn">
        <Icon name="alert" size={13} />
        <span>
          <strong>{T("Це не платіжні дані.", "This is not billing data.")}</strong>{" "}
          {T("У бекенді немає домену білінгу — жодного ресурсу тарифу, підписки, рахунку чи ліміту місць. Нижче — лише реальні сигнали (реєстр місць і квота ASR) та орієнтовне зіставлення з опублікованим прайсом.",
             "The backend has no billing domain — no plan, subscription, invoice or seat-limit resource. Below are only the real signals (the seat roster and the ASR quota) plus an indicative mapping onto the published price list.")}
        </span>
      </div>

      <div className="co-kpis">
        <StatCard
          label={T("Клінічні місця", "Clinical seats")} icon="users" accent
          loading={req.loading} error={req.error}
          value={d ? d.clinicalSeats : "—"}
          approx={d?.capped}
          sublabel={d ? `${d.seats.active} ${T("активних усього", "active in total")}` : undefined}
        />
        <StatCard
          label={T("Орієнтовний тариф", "Indicative tier")} icon="card"
          loading={req.loading} error={req.error}
          value={d ? d.plan.name : "—"}
          sublabel={d ? T("за кількістю місць — не виставлено", "by seat count — not billed") : undefined}
        />
        <StatCard
          label={T("Орієнтовний MRR", "Indicative MRR")} icon="activity"
          loading={req.loading} error={req.error}
          value={d ? (d.indicativeMrr == null ? T("за запитом", "quote") : `$${d.indicativeMrr.toLocaleString()}`) : "—"}
          sublabel={d ? T("прайс × місця, не рахунок", "price list × seats, not an invoice") : undefined}
        />
        <StatCard
          label={T("Місячна квота ASR", "ASR monthly quota")} icon="bot"
          loading={req.loading} error={req.error}
          value={d ? (d.quota?.unknown ? "—" : (d.quota.exceeded ? T("перевищено", "exceeded") : T("у межах", "within"))) : "—"}
          sublabel={d?.quota?.at
            ? `${T("востаннє", "last")} ${new Date(d.quota.at).toLocaleDateString()}`
            : T("спожиті байти — бекенд не віддає", "bytes used — backend exposes none")}
        />
      </div>

      <Panel title={T("Каталог тарифів", "Plan catalogue")} icon="card"
             gapNote={T("Дзеркало публічної сторінки цін. Джерело істини для виставлення рахунків відсутнє.",
                        "Mirrors the public pricing page. There is no billing source of truth.")}>
        <div className="co-tablewrap">
          <table className="co-table">
            <thead>
              <tr>
                <th>{T("Тариф", "Plan")}</th>
                <th>{T("Ціна / місце / міс.", "Price / seat / mo")}</th>
                <th>{T("До скількох місць", "Seats up to")}</th>
                <th>{T("MRR за поточних місць", "MRR at current seats")}</th>
                <th>{T("Примітка", "Note")}</th>
              </tr>
            </thead>
            <tbody>
              {PLAN_CATALOGUE.map((p) => {
                const current = d && d.plan.id === p.id;
                const mrr = d ? indicativeMrr(p, d.clinicalSeats) : null;
                return (
                  <tr key={p.id} className={current ? "co-row is-active" : ""}>
                    <td>
                      <div className="co-cell-title">
                        {p.name}
                        {current && <em className="co-tenant-you">{T("поточний", "current")}</em>}
                      </div>
                    </td>
                    <td>{p.monthlyUsd == null ? T("за запитом", "custom") : `$${p.monthlyUsd}`}</td>
                    <td>{p.seatsUpTo === Infinity ? "∞" : p.seatsUpTo}</td>
                    <td>{mrr == null ? "—" : `$${mrr.toLocaleString()}`}</td>
                    <td className="co-cell-sub">{p.note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title={T("Реєстр місць", "Seat roster")} icon="users"
             sub={d?.capped ? T("обмежено", "capped") : undefined}
             gapNote={T("Ліміт місць не налаштований — бекенд не має ресурсу ліцензії.",
                        "No seat limit is configured — the backend has no licence resource.")}>
        {(req.loading || req.error) ? (
          <PanelState loading={req.loading} error={req.error} onRetry={req.reload} lang={lang} />
        ) : !d.users.length ? (
          <div className="co-empty">{T("Користувачів не знайдено.", "No users found.")}</div>
        ) : (
          <div className="co-tablewrap">
            <table className="co-table">
              <thead>
                <tr>
                  <th>{T("Користувач", "User")}</th>
                  <th>{T("Email", "Email")}</th>
                  <th>{T("Роль", "Role")}</th>
                  <th>{T("Статус", "Status")}</th>
                  <th>{T("Тарифікується", "Billable")}</th>
                </tr>
              </thead>
              <tbody>
                {d.users.map((u) => {
                  const billable = ["clinician", "nurse"].includes(String(u.role || "").toLowerCase())
                    && String(u.status || "").toLowerCase() === "active";
                  return (
                    <tr key={u.sub}>
                      <td className="co-cell-title">{u.display_name || String(u.sub).slice(0, 8)}</td>
                      <td className="co-cell-sub">{u.email}</td>
                      <td><span className="co-rolepill">{u.role}</span></td>
                      <td><StatusBadge status={u.status} /></td>
                      <td>{billable ? <StatusBadge tone="ok" label={T("так", "yes")} /> : <span className="co-na">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
