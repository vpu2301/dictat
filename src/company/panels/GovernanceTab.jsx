// GovernanceTab.jsx — the two oversight queues, rolled up for an owner.
//
// Both queues already have working detail screens in the clinic app:
// /admin/privacy runs the two-person DSAR/erasure workflow, and
// /audit/phi-access lists and revokes break-glass grants. This tab does NOT
// re-implement either — a second approve button against a two-person rule is
// how you end up with two half-correct implementations of the same guarantee.
//
// What did not exist anywhere is the owner's question, which is not "approve
// this one" but "is anything rotting?": how long the oldest undecided request
// has been sitting, how many grants are open right now, and how many of those
// were minted and never actually used. Those are the numbers here, and every
// row deep-links to the screen that can act on it.
//
// Nothing is mocked. Each queue degrades on its own: an account without
// phi_access.read still gets the privacy roll-up rather than an empty page.

import React from "react";
import { useAsync } from "../../api/useAsync.js";
import { Panel, PanelState } from "../../components/dashboard/Panel.jsx";
import { StatCard } from "../../components/dashboard/StatCard.jsx";
import { StatusBadge } from "../../components/dashboard/StatusBadge.jsx";
import { StatusBreakdown } from "../../components/dashboard/StatusBreakdown.jsx";
import { Icon } from "../../components/UI.jsx";
import { ApiErrorView } from "../../components/ApiErrorView.jsx";
import { tr } from "../../i18n.js";
import { Provenance } from "../provenance.jsx";
import { fetchGovernanceQueue, PRIVACY_STATUSES } from "../../api/company.js";

export function GovernanceTab({ lang, navigate }) {
  const T = (uk, en) => tr(lang, uk, en);
  const isUk = lang === "uk";
  const req = useAsync(() => fetchGovernanceQueue(), []);
  const d = req.data;
  const p = d?.privacy;
  const g = d?.grants;

  return (
    <div className="co-stack">
      <div className="co-note">
        <Icon name="info" size={13} />
        <span>
          {T("Дві черги нагляду за активним тенантом. Рішення ухвалюються на екранах клініки — тут лише те, що має турбувати власника: що застоялося і що зараз відкрите.",
             "The active tenant's two oversight queues. Decisions are taken on the clinic screens — what is here is the owner's question: what has gone stale, and what is open right now.")}
          {" "}<Provenance source="live" lang={lang} note="GET /privacy-requests + GET /v1/phi-access-requests" />
        </span>
      </div>

      <div className="co-kpis">
        <StatCard label={T("Відкриті запити приватності", "Open privacy requests")} icon="shield" accent
                  loading={req.loading} error={req.error || p?.error}
                  value={p?.open.length ?? "—"}
                  sublabel={p ? `${p.items.length} ${T("усього", "total")}` : undefined}>
          <Provenance source="live" lang={lang} note="GET /privacy-requests" />
        </StatCard>
        <StatCard label={T("Чекають другої людини", "Awaiting a second person")} icon="user"
                  loading={req.loading} error={req.error || p?.error}
                  value={p?.awaitingApproval.length ?? "—"}
                  sublabel={T("стирання, яке ніхто не розглянув", "erasures nobody has decided")}>
          <Provenance source="derived" lang={lang} note="kind=erasure, status in {requested, review}" />
        </StatCard>
        <StatCard label={T("Найстаріший відкритий", "Oldest open")} icon="clock"
                  loading={req.loading} error={req.error || p?.error}
                  value={p ? (p.open.length ? `${p.oldestOpenDays}d` : "—") : "—"}
                  sublabel={p?.oldestOpenDays > 30
                    ? T("прострочено за будь-яким регламентом", "past any reasonable SLA")
                    : T("від дати запиту", "since it was requested")}>
          <Provenance source="derived" lang={lang} note="now − requested_at, open statuses only" />
        </StatCard>
        <StatCard label={T("Відкриті break-glass", "Open break-glass grants")} icon="eye"
                  loading={req.loading} error={req.error || g?.error}
                  value={g?.open.length ?? "—"}
                  sublabel={g ? `${g.unused.length} ${T("жодного разу не використано", "never used")}` : undefined}>
          <Provenance source="derived" lang={lang} note="status=granted and expires_at in the future" />
        </StatCard>
      </div>

      <div className="co-2col">
        <Panel title={T("Черга приватності", "Privacy queue")} icon="shield"
               sub={p ? `${p.items.length}` : undefined}>
          {(req.loading || req.error || !p) ? (
            <PanelState loading={req.loading} error={req.error} onRetry={req.reload} lang={lang} />
          ) : p.error ? (
            <>
              <ApiErrorView error={p.error} lang={lang} />
              <p className="co-cell-sub">
                {T("GET /privacy-requests потребує scope patient.read у ЦЬОМУ тенанті. Якщо ваш токен вказує на інший — черга буде порожньою, а не помилковою.",
                   "GET /privacy-requests needs patient.read in THIS tenant. If your token points elsewhere the queue is absent, not wrong.")}
              </p>
            </>
          ) : !p.items.length ? (
            <div className="co-empty">
              {T("Жодного запиту DSAR чи стирання. Це нормальний стан.",
                 "No DSAR or erasure requests. That is the normal state.")}
            </div>
          ) : (
            <>
              <StatusBreakdown
                segments={PRIVACY_STATUSES.map((s) => ({ key: s, label: s, count: p.byStatus[s] || 0 }))}
                total={p.items.length} />
              <div className="co-tablewrap">
                <table className="co-table co-table-dense">
                  <thead>
                    <tr>
                      <th>{T("Тип", "Kind")}</th><th>{T("Стан", "Status")}</th>
                      <th>{T("Запитано", "Requested")}</th><th>{T("Виконати", "Scheduled")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.items.slice(0, 10).map((r) => (
                      <tr key={r.id}>
                        <td><code>{r.kind}</code></td>
                        <td><StatusBadge status={r.status} /></td>
                        <td className="co-cell-sub">{fmt(r.requested_at)}</td>
                        <td className="co-cell-sub">{r.scheduled_for ? fmt(r.scheduled_for) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button className="co-link" onClick={() => navigate("/admin/privacy")}>
                {T("Ухвалити рішення", "Take a decision")} <Icon name="chevRight" size={12} />
              </button>
            </>
          )}
        </Panel>

        <Panel title={T("Доступ break-glass", "Break-glass access")} icon="eye"
               sub={g ? `${g.items.length}${g.capped ? "+" : ""}` : undefined}>
          {(req.loading || req.error || !g) ? (
            <PanelState loading={req.loading} error={req.error} onRetry={req.reload} lang={lang} />
          ) : g.error ? (
            <>
              <ApiErrorView error={g.error} lang={lang} />
              <p className="co-cell-sub">
                {T("GET /v1/phi-access-requests потребує scope phi_access.read (tenant_admin або auditor).",
                   "GET /v1/phi-access-requests needs phi_access.read (tenant_admin or auditor).")}
              </p>
            </>
          ) : !g.items.length ? (
            <div className="co-empty">
              {T("Ніхто не розбивав скло. Це найкращий можливий результат.",
                 "Nobody has broken glass. That is the best possible result.")}
            </div>
          ) : (
            <>
              <ul className="co-watchlist">
                {Object.entries(g.byReason)
                  .sort((a, b) => b[1] - a[1])
                  .map(([code, n]) => {
                    const label = g.reasonLabels[code];
                    return (
                      <li key={code} className={code === "other" ? "hit t-warn" : ""}>
                        <span className="co-watch-n">{n}</span>
                        <div>
                          <strong>{label ? (isUk ? label.label_uk : label.label_en) : code}</strong>
                          <p><code>{code}</code></p>
                        </div>
                      </li>
                    );
                  })}
              </ul>
              {g.open.length > 0 && (
                <div className="co-tablewrap">
                  <table className="co-table co-table-dense">
                    <thead>
                      <tr>
                        <th>{T("Хто", "Who")}</th><th>{T("На що", "On what")}</th>
                        <th>{T("Спливає", "Expires")}</th><th>{T("Читань", "Reads")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.open.slice(0, 10).map((row) => (
                        <tr key={row.id}>
                          <td className="co-cell-sub"><code>{String(row.requested_by || "—").slice(0, 8)}</code></td>
                          <td className="co-cell-sub">
                            {row.resource_kind} <code>{String(row.resource_id || "").slice(0, 8)}</code>
                          </td>
                          <td className="co-cell-sub">{fmt(row.expires_at)}</td>
                          <td>{Number(row.use_count) || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <button className="co-link" onClick={() => navigate("/audit/phi-access")}>
                {T("Повний журнал і відкликання", "Full log and revocation")} <Icon name="chevRight" size={12} />
              </button>
            </>
          )}
        </Panel>
      </div>

      <Panel title={T("Як це читати", "How to read this")} icon="book">
        <ul className="co-worklist">
          <li>
            {T("Стирання — правило двох людей: запитувач не може схвалити власний запит (сервер відповість 403 two_person_rule). Тому «чекають другої людини» — це черга, яка не рухається сама.",
               "Erasure is a two-person rule: the requester cannot approve their own request (the server answers 403 two_person_rule). So \"awaiting a second person\" is a queue that will not move on its own.")}
          </li>
          <li>
            {T("Виданий, але жодного разу не використаний break-glass варто відкликати: або причина зникла, або хтось тримає ключ, який йому не знадобився.",
               "A break-glass grant that was minted and never used is worth revoking: either the reason evaporated, or somebody is holding a key they did not need.")}
          </li>
          <li>
            {T("Причина «other» вимагає письмового пояснення — саме її перевіряйте першою.",
               "The \"other\" reason requires a written note — that is the one to read first.")}
          </li>
          <li>
            {T("Журнал доступу обмежений сервером (без курсора), тож великі періоди читаються частинами.",
               "The grant log is server-capped and takes no cursor, so long windows are read in slices.")}
          </li>
        </ul>
      </Panel>
    </div>
  );
}

function fmt(v) {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d) ? "—" : d.toLocaleString();
}
