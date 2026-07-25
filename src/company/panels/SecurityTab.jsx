// SecurityTab.jsx — the security picture, and it is almost entirely REAL.
//
// The hash-chained audit trail already records every event a security review
// asks about: failed logins, role changes, break-glass grants on patient data,
// refresh-token replays, deactivations, tenant switches. Nothing here is mocked
// — the only limit is scope, since /audit/events is RLS-bound to the active
// tenant like everything else.
//
// A refresh replay deserves special treatment: auth-service force-revokes the
// whole session when it sees one, because it means a refresh token was used
// twice — either a bug or a stolen token. It is surfaced as its own alarm
// rather than a row in a list.
import React, { useMemo } from "react";
import { useAsync } from "../../api/useAsync.js";
import { Panel, PanelState } from "../../components/dashboard/Panel.jsx";
import { StatCard } from "../../components/dashboard/StatCard.jsx";
import { StatusBadge } from "../../components/dashboard/StatusBadge.jsx";
import { MiniBarChart } from "../../components/dashboard/MiniBarChart.jsx";
import { Icon } from "../../components/UI.jsx";
import { tr } from "../../i18n.js";
import { Provenance } from "../provenance.jsx";
import { fetchAuditTelemetry } from "../../api/company.js";

// kind → how alarming, and what it means. Anything not listed is routine.
const WATCHED = [
  { kind: "auth.refresh_replay_detected", tone: "danger", uk: "Повторне використання refresh-токена", en: "Refresh-token replay",
    whyUk: "Токен оновлення використано двічі. Сесію примусово відкликано — це або баг, або викрадений токен.",
    whyEn: "A refresh token was used twice. The session is force-revoked — either a bug or a stolen token." },
  { kind: "auth.login_failed", tone: "warn", uk: "Невдалі входи", en: "Failed sign-ins",
    whyUk: "Поодинокі — норма. Сплеск на один акаунт — підбір пароля.",
    whyEn: "A few are normal. A spike against one account is credential stuffing." },
  { kind: "phi_access.granted", tone: "warn", uk: "Доступ break-glass до PHI", en: "Break-glass PHI access",
    whyUk: "Адміністратор отримав доступ до даних пацієнта. Кожен випадок має мати причину.",
    whyEn: "An administrator reached patient data. Every instance should have a reason." },
  { kind: "user.roles_changed", tone: "info", uk: "Зміни ролей", en: "Role changes",
    whyUk: "Підвищення привілеїв. Перевіряйте, що кожне було очікуваним.",
    whyEn: "Privilege changes. Check each one was expected." },
  { kind: "user.deactivated", tone: "info", uk: "Деактивації користувачів", en: "User deactivations",
    whyUk: "Вхід вимкнено платформно, активні сесії відкликано.",
    whyEn: "Sign-in disabled platform-wide and active sessions revoked." },
  { kind: "user.reactivated", tone: "warn", uk: "Реактивації користувачів", en: "User reactivations",
    whyUk: "Повернення доступу — чутлива дія, тож фіксується з рівнем sec.",
    whyEn: "Re-granting access is sensitive, so it is recorded at severity sec." },
  { kind: "tenant.switched", tone: "info", uk: "Перемикання тенанта", en: "Tenant switches",
    whyUk: "Хтось запросив контекст іншої клініки.",
    whyEn: "Someone requested another clinic's context." },
  { kind: "asr.quota_exceeded", tone: "info", uk: "Перевищення квоти ASR", en: "ASR quota exceeded",
    whyUk: "Місячний ліміт байтів вичерпано — комерційний сигнал, не безпековий.",
    whyEn: "The monthly byte cap was hit — a commercial signal, not a security one." },
];

export function SecurityTab({ lang, rangeDays, navigate }) {
  const T = (uk, en) => tr(lang, uk, en);
  const isUk = lang === "uk";
  const req = useAsync(() => fetchAuditTelemetry(rangeDays), [rangeDays]);

  const watched = useMemo(() => {
    const byKind = req.data?.byKind || {};
    return WATCHED.map((w) => ({ ...w, count: byKind[w.kind] || 0 }));
  }, [req.data]);

  const replay = watched.find((w) => w.kind === "auth.refresh_replay_detected");
  const failedLogins = watched.find((w) => w.kind === "auth.login_failed");
  const breakGlass = watched.find((w) => w.kind === "phi_access.granted");
  const secEvents = req.data?.bySeverity?.sec || 0;

  // Events in the watch-list, most recent first — the actual review queue.
  const feed = useMemo(() => {
    const kinds = new Set(WATCHED.map((w) => w.kind));
    return (req.data?.events || []).filter((e) => kinds.has(e.kind)).slice(0, 30);
  }, [req.data]);

  return (
    <div className="co-stack">
      <div className="co-note">
        <Icon name="check" size={13} />
        <span>
          {T("Ця сторінка не містить макетів. Усе походить із хеш-зв'язаного журналу аудиту — обмеженого RLS до активного тенанта, як і решта глибоких даних.",
             "Nothing on this page is mocked. It all comes from the hash-chained audit trail — RLS-bound to the active tenant, like every other deep read.")}
          {" "}<Provenance source="live" lang={lang} note="GET /audit/events" />
        </span>
      </div>

      {/* The one event that is always an alarm. */}
      {replay?.count > 0 && (
        <div className="co-alarm" role="alert">
          <Icon name="alert" size={18} />
          <div>
            <strong>{T("Виявлено повторне використання refresh-токена", "Refresh-token replay detected")} × {replay.count}</strong>
            <p>{isUk ? replay.whyUk : replay.whyEn}</p>
          </div>
        </div>
      )}

      <div className="co-kpis">
        <StatCard label={T("Події безпеки (sec)", "Security events (sec)")} icon="shield" accent
                  loading={req.loading} error={req.error} value={secEvents}
                  approx={req.data?.capped}
                  sublabel={`${T("за", "over")} ${rangeDays}d`}>
          <Provenance source="live" lang={lang} note="severity=sec in /audit/events" />
        </StatCard>
        <StatCard label={T("Невдалі входи", "Failed sign-ins")} icon="x"
                  loading={req.loading} error={req.error} value={failedLogins?.count ?? "—"}>
          <Provenance source="live" lang={lang} note="auth.login_failed" />
        </StatCard>
        <StatCard label={T("Доступ break-glass", "Break-glass access")} icon="eye"
                  loading={req.loading} error={req.error} value={breakGlass?.count ?? "—"}
                  sublabel={breakGlass?.count ? T("кожен потребує перевірки", "each needs review") : T("жодного", "none")}>
          <Provenance source="live" lang={lang} note="phi_access.granted" />
        </StatCard>
        <StatCard label={T("Повтори токена", "Token replays")} icon="alert"
                  loading={req.loading} error={req.error} value={replay?.count ?? "—"}
                  sublabel={replay?.count ? T("сесію відкликано", "session revoked") : T("чисто", "clear")}>
          <Provenance source="live" lang={lang} note="auth.refresh_replay_detected" />
        </StatCard>
      </div>

      <Panel title={T("Спостережувані події", "Watched events")} icon="shield"
             sub={req.data?.capped ? T(`обмежено ${req.data.cap}`, `capped at ${req.data.cap}`) : undefined}>
        {(req.loading || req.error) ? (
          <PanelState loading={req.loading} error={req.error} onRetry={req.reload} lang={lang} />
        ) : (
          <ul className="co-watchlist">
            {watched.map((w) => (
              <li key={w.kind} className={w.count > 0 ? "hit t-" + w.tone : ""}>
                <span className="co-watch-n">{w.count}</span>
                <div>
                  <strong>{isUk ? w.uk : w.en} <code>{w.kind}</code></strong>
                  <p>{isUk ? w.whyUk : w.whyEn}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="co-2col">
        <Panel title={T("Обсяг подій за днями", "Event volume by day")} icon="activity">
          {(req.loading || req.error) ? (
            <PanelState loading={req.loading} error={req.error} lang={lang} />
          ) : (
            <>
              <MiniBarChart data={req.data.series} height={78}
                            formatLabel={(b) => `${b.key}: ${b.value}`} />
              <div className="co-axis">
                <span>{req.data.series[0]?.key}</span>
                <span>{req.data.series[req.data.series.length - 1]?.key}</span>
              </div>
            </>
          )}
        </Panel>

        <Panel title={T("Практики", "Practices")} icon="book">
          <ul className="co-worklist">
            <li>{T("Перевіряйте кожен break-glass — доступ адміністратора до PHI має мати письмову причину.",
                   "Review every break-glass — an admin reaching PHI should have a written reason.")}</li>
            <li>{T("Повтор refresh-токена ніколи не буває нормою. Розберіть кожен випадок.",
                   "A refresh replay is never routine. Investigate every one.")}</li>
            <li>{T("Перевіряйте ланцюг аудиту регулярно — на вкладці «Телеметрія».",
                   "Verify the audit chain regularly — on the Telemetry tab.")}</li>
            <li>{T("MFA реалізовано, але вимкнено (MDX_REQUIRE_MFA=false). Це найдешевше посилення, яке лишилося.",
                   "MFA is implemented but disabled (MDX_REQUIRE_MFA=false). It is the cheapest hardening left.")}</li>
          </ul>
          <button className="co-link" onClick={() => navigate("/company/telemetry")}>
            {T("До перевірки ланцюга", "Go to chain verify")} <Icon name="chevRight" size={12} />
          </button>
        </Panel>
      </div>

      <Panel title={T("Черга перегляду", "Review queue")} icon="list"
             sub={`${feed.length}`}>
        {(req.loading || req.error) ? (
          <PanelState loading={req.loading} error={req.error} lang={lang} />
        ) : !feed.length ? (
          <div className="co-empty">
            {T("Жодної спостережуваної події за період — це добра новина.",
               "No watched events in this window — that is the good outcome.")}
          </div>
        ) : (
          <div className="co-tablewrap">
            <table className="co-table co-table-dense">
              <thead>
                <tr>
                  <th>seq</th><th>{T("Час", "Time")}</th><th>{T("Подія", "Event")}</th>
                  <th>{T("Актор", "Actor")}</th><th>{T("Ціль", "Target")}</th><th>{T("Рівень", "Severity")}</th>
                </tr>
              </thead>
              <tbody>
                {feed.map((e, i) => (
                  <tr key={e.seq ?? i}>
                    <td className="co-cell-sub">{e.seq ?? "—"}</td>
                    <td className="co-cell-sub">{fmt(e.created_at || e.at || e.ts)}</td>
                    <td><code>{e.kind}</code></td>
                    <td className="co-cell-sub"><code>{e.actor_sub ? String(e.actor_sub).slice(0, 8) : "system"}</code></td>
                    <td className="co-cell-sub">
                      {e.target_kind ? `${e.target_kind}${e.target_id ? ` ${String(e.target_id).slice(0, 8)}` : ""}` : "—"}
                    </td>
                    <td><StatusBadge tone={sevTone(e.severity)} label={String(e.severity || "info")} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function sevTone(s) {
  const v = String(s || "info").toLowerCase();
  if (v === "error") return "danger";
  if (v === "warn") return "warn";
  if (v === "sec") return "info";
  return "muted";
}
function fmt(v) {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d) ? "—" : d.toLocaleString();
}
