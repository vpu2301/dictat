// InfrastructureTab.jsx — where everything actually runs, with links that open it.
//
// Two lists: the nine HTTP services the SPA talks to (from api/services.js, with
// their real readiness), and the infrastructure behind them (Grafana, Prometheus,
// Jaeger, Loki, MinIO, Mailpit, Keycloak, the collector, the edge proxy) plus the
// three datastores that have no web UI at all.
//
// The reachability column is deliberately labelled "answered", not "healthy" —
// see the long note in ../infra.js. A cross-origin no-cors probe proves someone
// is listening; it cannot see the status code. Calling that "healthy" would be
// the same overclaim this console spends the rest of its surface avoiding.
import React from "react";
import { useAsync } from "../../api/useAsync.js";
import { Panel, PanelState } from "../../components/dashboard/Panel.jsx";
import { StatCard } from "../../components/dashboard/StatCard.jsx";
import { StatusBadge } from "../../components/dashboard/StatusBadge.jsx";
import { Icon } from "../../components/UI.jsx";
import { tr } from "../../i18n.js";
import { Provenance } from "../provenance.jsx";
import { INFRA, INFRA_NON_HTTP, probeAllInfra } from "../infra.js";
import { fetchPlatformHealth, SERVICE_ROLE } from "../../api/company.js";

export function InfrastructureTab({ lang }) {
  const T = (uk, en) => tr(lang, uk, en);
  const isUk = lang === "uk";

  const infraReq = useAsync(() => probeAllInfra(), []);
  const healthReq = useAsync(() => fetchPlatformHealth(), []);

  const answered = infraReq.data
    ? Object.values(infraReq.data).filter((r) => r.state === "answered").length
    : null;

  return (
    <div className="co-stack">
      <div className="co-note">
        <Icon name="info" size={13} />
        <span>
          {T("Стовпець доступності каже «відповів», а не «справний»: крос-доменна проба no-cors доводить, що хтось слухає порт, але не бачить код відповіді. Називати це справністю було б саме тим перебільшенням, якого решта консолі уникає.",
             "The reachability column says \"answered\", not \"healthy\": a cross-origin no-cors probe proves something is listening but cannot see the status code. Calling that healthy would be the overclaim the rest of this console avoids.")}
          {" "}<Provenance source="live" lang={lang}
                          note={T("Проба з браузера на цьому завантаженні.", "Probed from the browser on this page load.")} />
        </span>
      </div>

      <div className="co-kpis">
        <StatCard label={T("Сервіси застосунку", "Application services")} icon="layers" accent
                  loading={healthReq.loading} error={healthReq.error}
                  value={healthReq.data ? `${healthReq.data.ready}/${healthReq.data.total}` : "—"}
                  sublabel={T("готові (/readyz)", "ready (/readyz)")}>
          <Provenance source="live" lang={lang} note="GET /readyz × 9" />
        </StatCard>
        <StatCard label={T("Інфраструктура", "Infrastructure")} icon="globe"
                  loading={infraReq.loading}
                  value={answered != null ? `${answered}/${INFRA.length}` : "—"}
                  sublabel={T("відповіли", "answered")}>
          <Provenance source="live" lang={lang} note={T("no-cors проба", "no-cors probe")} />
        </StatCard>
        <StatCard label={T("Сховища даних", "Datastores")} icon="archive"
                  value={INFRA_NON_HTTP.length}
                  sublabel={T("без веб-інтерфейсу", "no web UI")}>
          <Provenance source="derived" lang={lang}
                      note={T("Із compose-файла стека.", "From the stack's compose file.")} />
        </StatCard>
        <StatCard label={T("Веб-інтерфейси", "Web consoles")} icon="grid"
                  value={INFRA.filter((e) => e.web).length}
                  sublabel={T("відкриваються нижче", "openable below")}>
          <Provenance source="derived" lang={lang} note={T("Реєстр infra.js.", "The infra.js registry.")} />
        </StatCard>
      </div>

      {/* ── Observability & tooling ──────────────────────────────────── */}
      <Panel title={T("Спостережуваність і сервіси", "Observability & tooling")} icon="globe"
             sub={infraReq.data ? `${answered}/${INFRA.length}` : undefined}>
        {infraReq.loading ? (
          <PanelState loading lang={lang} />
        ) : (
          <ul className="co-infra">
            {INFRA.map((e) => {
              const r = infraReq.data[e.key];
              const up = r?.state === "answered";
              const unverifiable = r?.state === "unverifiable";
              return (
                <li key={e.key} className={up ? "up" : unverifiable ? "unknown" : "down"}>
                  <span className="co-infra-dot" />
                  <div className="co-infra-body">
                    <strong>
                      {e.name}
                      {!e.web && (
                        <span className="co-infra-tag">{T("без UI", "no UI")}</span>
                      )}
                      {e.selfSigned && (
                        <span className="co-infra-tag warn">{T("самопідписаний TLS", "self-signed TLS")}</span>
                      )}
                    </strong>
                    <p>{isUk ? e.uk : e.en}</p>
                    <p className="co-infra-note">{isUk ? e.noteUk : e.noteEn}</p>
                    {(e.credsUk || e.credsEn) && (
                      <p className="co-infra-creds">
                        <Icon name="user" size={11} /> {isUk ? e.credsUk : e.credsEn}
                      </p>
                    )}
                  </div>
                  <div className="co-infra-right">
                    <StatusBadge tone={up ? "ok" : unverifiable ? "warn" : "danger"}
                                 label={up ? T("відповів", "answered")
                                   : unverifiable ? T("не перевірити", "cannot check")
                                   : T("немає відповіді", "no answer")} />
                    {up && <span className="co-rtt">{r.ms} ms</span>}
                    {unverifiable && (
                      <span className="co-infra-why">
                        {T("браузер відхиляє самопідписаний сертифікат — це не означає, що сервіс не працює",
                           "the browser rejects the self-signed certificate — this does not mean the service is down")}
                      </span>
                    )}
                    <a className="co-infra-open" href={e.url} target="_blank" rel="noreferrer noopener">
                      <Icon name="arrowRight" size={12} />
                      {e.web ? T("Відкрити", "Open") : T("Кінцева точка", "Endpoint")}
                    </a>
                    <code className="co-infra-url">{e.url}</code>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {/* ── Application services ─────────────────────────────────────── */}
      <Panel title={T("Сервіси застосунку", "Application services")} icon="layers"
             gapNote={T("Це справжня перевірка готовності — /readyz повертає стан, а не просто «щось відповіло».",
                        "This is a genuine readiness check — /readyz reports state, not merely that something answered.")}>
        {(healthReq.loading || healthReq.error) ? (
          <PanelState loading={healthReq.loading} error={healthReq.error}
                      onRetry={healthReq.reload} lang={lang} />
        ) : (
          <div className="co-tablewrap">
            <table className="co-table">
              <thead>
                <tr>
                  <th>{T("Сервіс", "Service")}</th>
                  <th>{T("Відповідає за", "Owns")}</th>
                  <th>{T("Стан", "State")}</th>
                  <th>{T("Відгук", "RTT")}</th>
                  <th>{T("Адреса", "Base")}</th>
                </tr>
              </thead>
              <tbody>
                {healthReq.data.services.map((s) => (
                  <tr key={s.key}>
                    <td className="co-cell-title">{s.key}</td>
                    <td className="co-cell-sub">
                      {SERVICE_ROLE[s.key] ? T(SERVICE_ROLE[s.key].uk, SERVICE_ROLE[s.key].en) : "—"}
                    </td>
                    <td className="co-statecell">
                      <StatusBadge tone={s.state === "ready" ? "ok" : s.state === "notready" ? "warn" : "danger"}
                                   label={s.state === "ready" ? T("готовий", "ready")
                                     : s.state === "notready" ? T("запуск", "starting")
                                     : T("недоступний", "down")} />
                    </td>
                    <td className="co-cell-sub">{s.state === "down" ? "—" : `${s.ms} ms`}</td>
                    <td className="co-cell-sub">
                      <a href={`${s.base}/docs`} target="_blank" rel="noreferrer noopener" className="co-infra-link">
                        <code>{s.base}</code>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* ── Datastores ───────────────────────────────────────────────── */}
      <Panel title={T("Сховища даних", "Datastores")} icon="archive"
             gapNote={T("Не HTTP, тож посилання неможливе — показуємо рядок підключення. «Де база?» — питання, на яке ця консоль має відповідати.",
                        "Not HTTP, so a link is impossible — the connection string is shown instead. \"Where is the database\" is a question this console should answer.")}>
        <ul className="co-infra co-infra-plain">
          {INFRA_NON_HTTP.map((e) => (
            <li key={e.key}>
              <span className="co-infra-dot neutral" />
              <div className="co-infra-body">
                <strong>{e.name}</strong>
                <p>{isUk ? e.uk : e.en}</p>
              </div>
              <div className="co-infra-right">
                <code className="co-infra-url">{e.dsn}</code>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
