// AccessReviewPage.jsx — /audit/access. The periodic access review: who holds
// an account in this clinic, on what role, and which of those roles can reach
// patient data.
//
// Why an auditor gets this: libs/auth/perms.py grants
// ("auditor", "user.read", "user") explicitly — "read-only visibility of the
// tenant's user roster" — but the only UI over GET /admin/users was
// AdminUsersPage, gated to tenant_admin. The permission existed with nowhere
// to spend it.
//
// Access control review is the routine an auditor actually performs: GDPR
// Art. 32(1)(b) and (4) ask that access to personal data be limited to those
// who need it and that the limitation be demonstrable. The page therefore
// leads with the two findings that matter — accounts that can reach patient
// data, and non-active accounts that still carry a role — rather than making
// the auditor eyeball a flat list.
//
// Read-only on purpose: the auditor holds `user.read` and nothing else. Role
// changes, invites and deactivation live in /admin/users, which requires
// tenant_admin.
import React, { useMemo, useState } from "react";
import { Icon } from "../components/UI.jsx";
import { Loading } from "../components/DataStates.jsx";
import { ApiErrorView } from "../components/ApiErrorView.jsx";
import { Pagination } from "../components/Pagination.jsx";
import { useAsync } from "../api/useAsync.js";
import { listUsers } from "../api/endpoints.js";
import { tr } from "../i18n.js";

// The list endpoint caps at 200 per call; the roster of one clinic fits well
// inside that, so it is fetched once and paged client-side.
const FETCH_LIMIT = 200;
const PAGE_SIZES = [25, 50, 100];

// Roles that can reach patient data — directly (clinical) or by breaking glass
// (tenant_admin). This mirrors libs/auth/perms.py; the note on each says how.
const PHI_CAPABLE = {
  clinician:    { uk: "Клінічний доступ до записів", en: "Standing clinical access to records" },
  nurse:        { uk: "Клінічний доступ до записів", en: "Standing clinical access to records" },
  tenant_admin: { uk: "Без постійного доступу — лише break-glass, під журнал", en: "No standing access — break-glass only, logged" },
};

const ROLE_LABEL = {
  tenant_admin: { uk: "Адміністратор клініки", en: "Clinic admin" },
  clinician:    { uk: "Лікар",                 en: "Clinician" },
  nurse:        { uk: "Медсестра/брат",        en: "Nurse" },
  auditor:      { uk: "Аудитор",               en: "Auditor" },
  service:      { uk: "Службовий акаунт",      en: "Service account" },
};

const STATUS_LABEL = {
  active:    { uk: "Активний",   en: "Active" },
  invited:   { uk: "Запрошено",  en: "Invited" },
  suspended: { uk: "Призупинено", en: "Suspended" },
  disabled:  { uk: "Вимкнено",   en: "Disabled" },
};

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function AccessReviewPage({ lang = "en" }) {
  const T = (uk, en) => tr(lang, uk, en);
  const req = useAsync(() => listUsers({ limit: FETCH_LIMIT, offset: 0 }), []);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState("");   // "" | role | "phi" | "inactive"

  const all = useMemo(() => (Array.isArray(req.data) ? req.data : req.data?.items || []), [req.data]);

  const byRole = useMemo(() => {
    const m = {};
    for (const u of all) m[u.role] = (m[u.role] || 0) + 1;
    return m;
  }, [all]);

  const phiCount = all.filter((u) => PHI_CAPABLE[u.role]).length;
  // A suspended or disabled account that still carries a role is the classic
  // access-review finding: the role should have been withdrawn with the account.
  const staleCount = all.filter((u) => u.status && u.status !== "active" && u.status !== "invited").length;

  const rows = useMemo(() => {
    if (roleFilter === "phi") return all.filter((u) => PHI_CAPABLE[u.role]);
    if (roleFilter === "inactive") return all.filter((u) => u.status && u.status !== "active" && u.status !== "invited");
    if (roleFilter) return all.filter((u) => u.role === roleFilter);
    return all;
  }, [all, roleFilter]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  React.useEffect(() => { setPage(1); }, [roleFilter, pageSize]);
  React.useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  const exportCsv = () => {
    const head = ["sub", "email", "display_name", "role", "status", "phi_capable"];
    const lines = [head.join(",")].concat(rows.map((u) => [
      u.sub, u.email, u.display_name, u.role, u.status, PHI_CAPABLE[u.role] ? "yes" : "no",
    ].map(csvEscape).join(",")));
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `access-review-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const Tile = ({ id, label, value, tone }) => (
    <button type="button"
      className={"ar-tile" + (tone ? ` ${tone}` : "") + (roleFilter === id ? " on" : "")}
      onClick={() => setRoleFilter(roleFilter === id ? "" : id)}>
      <span className="ar-tile-v">{value}</span>
      <span className="ar-tile-l">{label}</span>
    </button>
  );

  return (
    <div className="page">
      <div className="page-h">
        <div style={{ flex: 1 }}>
          <h1>{T("Огляд доступів", "Access review")}</h1>
          <p className="sub">
            {T("Хто має обліковий запис у цій клініці та які ролі відкривають доступ до даних пацієнтів. Лише для читання — ролі змінює адміністратор клініки.",
               "Who holds an account in this clinic and which roles open access to patient data. Read-only — roles are changed by the clinic admin.")}
          </p>
        </div>
        <button className="btn" onClick={exportCsv} disabled={rows.length === 0}>
          <Icon name="download" size={13} /> {T("Експорт CSV", "Export CSV")}
        </button>
      </div>

      {req.error && <ApiErrorView error={req.error} lang={lang} />}
      {req.loading && all.length === 0 ? <Loading lang={lang} /> : (
        <>
          <div className="ar-tiles">
            <Tile id="" label={T("Усього облікових записів", "Accounts in total")} value={all.length} />
            <Tile id="phi" label={T("Можуть дістатися даних пацієнтів", "Can reach patient data")} value={phiCount} tone="warn" />
            <Tile id="inactive" label={T("Неактивні, але з роллю", "Not active, still holding a role")} value={staleCount}
              tone={staleCount > 0 ? "risk" : ""} />
            {Object.keys(ROLE_LABEL).filter((r) => byRole[r]).map((r) => (
              <Tile key={r} id={r} label={tr(lang, ROLE_LABEL[r].uk, ROLE_LABEL[r].en)} value={byRole[r]} />
            ))}
          </div>

          {roleFilter && (
            <div className="ar-filter-note">
              <Icon name="filter" size={12} />
              {T("Показано підмножину.", "Showing a subset.")}
              <button type="button" className="btn ghost sm" onClick={() => setRoleFilter("")}>
                {T("Показати всіх", "Show everyone")}
              </button>
            </div>
          )}

          <section className="card">
            <table className="audit-table ar-table">
              <thead>
                <tr>
                  <th>{T("Особа", "Person")}</th>
                  <th style={{ width: 180 }}>{T("Роль", "Role")}</th>
                  <th style={{ width: 130 }}>{T("Стан", "Status")}</th>
                  <th>{T("Доступ до даних пацієнтів", "Access to patient data")}</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 && (
                  <tr><td colSpan={4} className="audit-empty">{T("Записів немає.", "Nothing to show.")}</td></tr>
                )}
                {pageRows.map((u) => {
                  const phi = PHI_CAPABLE[u.role];
                  const inactive = u.status && u.status !== "active" && u.status !== "invited";
                  return (
                    <tr key={u.sub} className={inactive ? "ar-inactive" : ""}>
                      <td>
                        <span className="ar-name">{u.display_name || u.email}</span>
                        <span className="psub">{u.email}</span>
                      </td>
                      <td>
                        <span className="ar-role">{tr(lang, ROLE_LABEL[u.role]?.uk, ROLE_LABEL[u.role]?.en) || u.role}</span>
                        <span className="psub mono">{u.role}</span>
                      </td>
                      <td>
                        <span className={"ar-status " + (inactive ? "off" : u.status || "")}>
                          {tr(lang, STATUS_LABEL[u.status]?.uk, STATUS_LABEL[u.status]?.en) || u.status || "—"}
                        </span>
                      </td>
                      <td>
                        {/* Inner div, not the <td>: display:flex on a cell
                            takes it out of the row's column layout. */}
                        <div className="ar-phi">
                          {phi ? (
                            <>
                              <Icon name="alert" size={12} />
                              <span>{tr(lang, phi.uk, phi.en)}</span>
                            </>
                          ) : (
                            <span className="muted">{T("Немає", "None")}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="audit-foot">
              <Pagination
                page={page} pageCount={pageCount}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => Math.min(pageCount, p + 1))}
                onPage={setPage}
                lang={lang} total={rows.length}
                pageSize={pageSize} pageSizeOptions={PAGE_SIZES} onPageSizeChange={setPageSize}
              />
            </div>
          </section>

          {all.length >= FETCH_LIMIT && (
            <p className="psub" style={{ marginTop: 10 }}>
              {T(`Показано перші ${FETCH_LIMIT} облікових записів — стільки віддає ендпоінт за один запит.`,
                 `Showing the first ${FETCH_LIMIT} accounts — the endpoint's per-call maximum.`)}
            </p>
          )}
        </>
      )}
    </div>
  );
}
