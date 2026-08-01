// PhiAccessLogPage.jsx — /audit/phi-access. The break-glass oversight log:
// who opened a patient record they hold no standing right to, on what grounds,
// and how many times they actually read it.
//
// Why this page exists: `phi_access.read` is granted to auditor as well as
// tenant_admin (src/auth/roles.js), and GET /v1/phi-access-requests has been
// live on report-service since S14 — but nothing in the UI ever called it. An
// auditor could see that a grant was minted (the `sec`-severity event lands in
// /audit/events) and never see the grant itself: its reason, its expiry, or
// whether it was used once or forty times.
//
// Everything here is LIVE. The one thing the backend cannot answer is a
// server-side export of the full history — the endpoint caps at limit=200 and
// takes no cursor — so the CSV button is scoped to "what is on screen" and
// says so, rather than pretending to be a complete extract.
import React, { useCallback, useMemo, useState } from "react";
import { Icon } from "../components/UI.jsx";
import { MenuSelect } from "../components/MenuSelect.jsx";
import { Loading } from "../components/DataStates.jsx";
import { ApiErrorView } from "../components/ApiErrorView.jsx";
import { useAsync } from "../api/useAsync.js";
import { listPhiAccessRequests, revokePhiAccess, listAccessReasons } from "../api/phiAccess.js";
import { useMemberNames, shortSub } from "../api/memberNames.js";
import { tr } from "../i18n.js";

const LIMITS = [50, 100, 200];

function stamp(iso, lang) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(lang === "uk" ? "uk-UA" : "en-US", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// The row's real state, not just its stored `status`: a grant whose window has
// passed is spent whether or not anything has rewritten the column yet.
function grantState(g, now = Date.now()) {
  if (g.revoked_at) return "revoked";
  if (g.expires_at && Date.parse(g.expires_at) <= now) return "expired";
  return g.status === "active" ? "active" : (g.status || "expired");
}

const STATE_LABEL = {
  active:  { uk: "Активний",  en: "Active" },
  expired: { uk: "Завершено", en: "Expired" },
  revoked: { uk: "Відкликано", en: "Revoked" },
};

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function PhiAccessLogPage({ lang = "en" }) {
  const T = (uk, en) => tr(lang, uk, en);
  const [activeOnly, setActiveOnly] = useState(false);
  const [limit, setLimit] = useState(50);
  const [busyId, setBusyId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [actionErr, setActionErr] = useState(null);

  const req = useAsync(
    () => listPhiAccessRequests({ activeOnly, limit }),
    [activeOnly, limit],
  );
  // Reason vocabulary is served, not hard-coded — the codes are pinned by a DB
  // CHECK, so a client-side list would drift silently.
  const reasonsReq = useAsync(() => listAccessReasons(), []);
  const { nameFor } = useMemberNames();

  const reasonLabel = useMemo(() => {
    const map = {};
    for (const r of reasonsReq.data?.reasons || []) {
      map[r.code] = lang === "uk" ? r.label_uk : r.label_en;
    }
    return (code) => map[code] || code || "—";
  }, [reasonsReq.data, lang]);

  const items = req.data?.items || [];
  const now = Date.now();

  const doRevoke = useCallback(async (id) => {
    setBusyId(id); setActionErr(null);
    try {
      await revokePhiAccess(id);
      setConfirmId(null);
      req.reload();
    } catch (e) {
      setActionErr((e && e.message) || T("Не вдалося відкликати доступ", "Could not revoke the grant"));
    } finally {
      setBusyId(null);
    }
  }, [req, lang]);

  const exportCsv = () => {
    const head = [
      "granted_at", "expires_at", "revoked_at", "state", "requested_by",
      "reason_code", "reason_note", "resource_kind", "resource_id",
      "patient_id", "use_count", "last_used_at",
    ];
    const lines = [head.join(",")].concat(items.map((g) => [
      g.granted_at, g.expires_at, g.revoked_at || "", grantState(g, now),
      `${nameFor(g.requested_by)} <${g.requested_by}>`,
      g.reason_code, g.reason_note || "", g.resource_kind, g.resource_id,
      g.patient_id || "", g.use_count, g.last_used_at || "",
    ].map(csvEscape).join(",")));
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `phi-access-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  return (
    <div className="page">
      <div className="page-h">
        <div style={{ flex: 1 }}>
          <h1>{T("Доступ break-glass", "Break-glass access")}</h1>
          <p className="sub">
            {T("Хто відкривав медичні записи без постійного права доступу — підстава, строк і скільки разів запис читали.",
               "Who opened patient records without a standing right of access — the grounds, the window, and how many times the record was read.")}
          </p>
        </div>
        <button className="btn" onClick={exportCsv} disabled={items.length === 0}>
          <Icon name="download" size={13} /> {T("Експорт CSV", "Export CSV")}
        </button>
      </div>

      <div className="ptable-toolbar">
        <label className="pdir-inactive-toggle">
          <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
          <span>{T("Лише активні доступи", "Active grants only")}</span>
        </label>
        <div className="spacer" style={{ flex: 1 }} />
        <div className="pager-size">
          <span className="muted">{T("Показати", "Show")}</span>
          <MenuSelect
            value={limit}
            options={LIMITS.map((n) => ({ value: n, label: String(n) }))}
            onChange={setLimit}
            disabled={req.loading}
            ariaLabel={T("Кількість записів", "Rows to load")}
          />
        </div>
        <button className="btn ghost sm" onClick={req.reload} disabled={req.loading}>
          <Icon name="refresh" size={13} className={req.loading ? "spin" : undefined} />
          {T("Оновити", "Refresh")}
        </button>
      </div>

      {actionErr && <div className="form-error" style={{ marginBottom: 12 }}>{actionErr}</div>}
      {req.error && <ApiErrorView error={req.error} lang={lang} />}

      <section className="card">
        {req.loading && items.length === 0 ? <Loading lang={lang} /> : (
          <table className="audit-table phi-table">
            <thead>
              <tr>
                <th style={{ width: 150 }}>{T("Видано", "Granted")}</th>
                <th style={{ width: 150 }}>{T("Хто", "Who")}</th>
                <th>{T("Підстава", "Reason")}</th>
                <th style={{ width: 130 }}>{T("Запис", "Record")}</th>
                <th style={{ width: 110 }}>{T("Стан", "State")}</th>
                <th style={{ width: 130 }}>{T("Використань", "Uses")}</th>
                <th style={{ width: 110 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !req.loading && (
                <tr><td colSpan={7} className="audit-empty">
                  {activeOnly
                    ? T("Активних доступів немає.", "No active grants.")
                    : T("Записів немає — break-glass не застосовували.", "Nothing here — break-glass has never been used.")}
                </td></tr>
              )}
              {items.map((g) => {
                const state = grantState(g, now);
                return (
                  <tr key={g.id}>
                    <td className="phi-when">
                      {stamp(g.granted_at, lang)}
                      <span className="psub">
                        {T("до", "until")} {stamp(g.expires_at, lang)}
                      </span>
                    </td>
                    <td>
                      <span className="phi-who">{nameFor(g.requested_by)}</span>
                      <span className="psub mono">{shortSub(g.requested_by)}</span>
                    </td>
                    <td>
                      <span className="phi-reason">{reasonLabel(g.reason_code)}</span>
                      {g.reason_note && <span className="psub phi-note">{g.reason_note}</span>}
                    </td>
                    <td>
                      <code className="mono">{g.resource_kind}</code>
                      <span className="psub mono">{String(g.resource_id).slice(0, 8)}…</span>
                    </td>
                    <td><span className={`phi-state ${state}`}>{tr(lang, STATE_LABEL[state]?.uk, STATE_LABEL[state]?.en) || state}</span></td>
                    <td>
                      <span className="phi-uses">{g.use_count}</span>
                      {g.last_used_at && (
                        <span className="psub">{T("востаннє", "last")} {stamp(g.last_used_at, lang)}</span>
                      )}
                    </td>
                    <td>
                      {/* The flex row is an inner div, never the <td>: a cell
                          set to display:flex stops being a table-cell and
                          drops out of the row's column layout. */}
                      <div className="phi-actions">
                        {state === "active" && (
                          confirmId === g.id ? (
                            <>
                              <button className="btn danger sm" disabled={busyId === g.id}
                                onClick={() => doRevoke(g.id)}>
                                {busyId === g.id ? T("Відкликаємо…", "Revoking…") : T("Підтвердити", "Confirm")}
                              </button>
                              <button className="btn ghost sm" onClick={() => setConfirmId(null)}>
                                {T("Ні", "No")}
                              </button>
                            </>
                          ) : (
                            <button className="btn ghost sm" onClick={() => setConfirmId(g.id)}>
                              <Icon name="x" size={12} /> {T("Відкликати", "Revoke")}
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {items.length >= limit && (
          <div className="audit-foot phi-foot">
            <span className="psub">
              {T(`Показано ${items.length} найновіших. Збільште ліміт, щоб побачити більше.`,
                 `Showing the ${items.length} most recent. Raise the limit to see more.`)}
            </span>
          </div>
        )}
      </section>
    </div>
  );
}
