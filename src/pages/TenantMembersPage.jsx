// TenantMembersPage.jsx — /tenant/members. Lists the active tenant's members
// and (for owner/admin) adds, re-roles, suspends and removes them.
//
// Two different lifecycles meet in this table and the row menu keeps them
// apart on purpose:
//   • MEMBERSHIP (tenant-scoped): add / change role / remove. Removing only
//     revokes access to THIS clinic; the account itself keeps working.
//   • ACCOUNT (platform-wide): suspend / reactivate, via
//     POST /admin/users/{sub}/deactivate|reactivate. Suspending disables login
//     everywhere and revokes every live session, so it is confirmed separately
//     and labelled as platform-wide in the dialog.
// The backend has no membership-level "suspended" state (PATCH accepts `role`
// only, extra="forbid"), so clinic-scoped suspension is not offered here.
//
// The backend refuses to demote/remove the LAST owner (409) — we surface that
// inline against the row and leave it unchanged rather than crashing.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon, Modal, Empty } from "../components/UI.jsx";
import { MenuSelect } from "../components/MenuSelect.jsx";
import { ApiErrorView } from "../components/ApiErrorView.jsx";
import { Loading, asList } from "../components/DataStates.jsx";
import { useAsync } from "../api/useAsync.js";
import { useClaims } from "../auth/AuthContext.jsx";
import {
  getCurrentTenant, listMembers, addMember, updateMember, removeMember,
  canManageTenant, MANAGEMENT_ROLES,
} from "../api/tenants.js";
import { deactivateUser, reactivateUser } from "../api/endpoints.js";
import { fetchAllUsers } from "../api/dashboard.js";
import { tr } from "../i18n.js";

export function TenantMembersPage({ lang = "en", onToast }) {
  const claims = useClaims();
  const tenantReq = useAsync(() => getCurrentTenant(), [claims?.tid]);
  const tenant = tenantReq.data;

  if (tenantReq.loading) return <div className="page"><Loading lang={lang} /></div>;
  if (tenantReq.error)   return <div className="page"><ApiErrorView error={tenantReq.error} lang={lang} /></div>;
  if (!tenant)           return <div className="page"><ApiErrorView error={{ status: 404, problem: { title: "No active clinic" } }} lang={lang} /></div>;

  return (
    <MembersTable
      tenant={tenant}
      canManage={canManageTenant(claims, tenant.my_role)}
      mySub={claims?.sub}
      lang={lang}
      onToast={onToast}
    />
  );
}

function roleChip(role) {
  const manages = role === "owner" || role === "admin";
  return <span className={"chip " + (manages ? "chip-ok" : "")}>{role}</span>;
}

// One shared option list for the row dropdown + the add-member modal. The value
// is the raw backend role (also what the chips show); the sub line explains it.
function roleOptions(lang) {
  const SUBS = {
    owner:     { uk: "Повний контроль над клінікою", en: "Full control of the clinic" },
    admin:     { uk: "Керує учасниками й налаштуваннями", en: "Manages members and settings" },
    doctor:    { uk: "Диктує та підписує звіти", en: "Dictates and signs reports" },
    nurse:     { uk: "Готує звіти без підпису", en: "Prepares reports, cannot sign" },
    assistant: { uk: "Допоміжний доступ", en: "Support access" },
    viewer:    { uk: "Лише перегляд", en: "Read-only access" },
  };
  return MANAGEMENT_ROLES.map((r) => ({
    value: r,
    label: r,
    sub: SUBS[r] ? tr(lang, SUBS[r].uk, SUBS[r].en) : undefined,
  }));
}

function initials(m) {
  const src = (m.display_name || m.email || "?").trim();
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  const two = (parts[0] || "?").charAt(0) + (parts.length > 1 ? parts[1].charAt(0) : "");
  return two.toUpperCase();
}

function MembersTable({ tenant, canManage, mySub, lang, onToast }) {
  const req = useAsync(() => listMembers(tenant.id), [tenant.id]);
  const members = asList(req.data);
  const [addOpen, setAddOpen] = useState(false);
  const [rowBusy, setRowBusy] = useState(null);   // user_sub in-flight
  const [rowError, setRowError] = useState(null);  // { sub, msg }
  const [action, setAction] = useState(null);      // { kind, member } pending confirmation
  const [search, setSearch] = useState("");
  const [roleTab, setRoleTab] = useState("");      // "" = all

  const errMsg = (err, fallback) => (err?.problem?.detail || err?.problem?.title || err?.message || fallback);
  const ROLE_OPTIONS = useMemo(() => roleOptions(lang), [lang]);

  // Account status (active | invited | deactivated) lives on the platform user
  // record, not on the membership — GET /tenants/{id}/members never returns it.
  // We cross-reference the RLS-scoped admin directory by sub. Non-fatal: without
  // it the column just reads "—" and the suspend/reactivate items stay hidden.
  const [accounts, setAccounts] = useState(null);   // Map sub → user | null
  const reloadAccounts = React.useCallback(() => {
    if (!canManage) { setAccounts(null); return Promise.resolve(); }
    return fetchAllUsers()
      .then(({ users }) => setAccounts(new Map(users.map((u) => [u.sub, u]))))
      .catch(() => setAccounts(null));
  }, [canManage]);
  useEffect(() => { reloadAccounts(); }, [reloadAccounts, tenant.id]);

  const accountOf = (m) => (accounts ? accounts.get(m.user_sub) || null : null);
  const accountStatus = (m) => (accountOf(m)?.status || "").toLowerCase();

  // Counts drive both the stat row and the per-role tab badges.
  const stats = useMemo(() => {
    const byRole = {};
    for (const m of members) byRole[m.role] = (byRole[m.role] || 0) + 1;
    const statusOf = (m) => String((accounts && accounts.get(m.user_sub)?.status) || "").toLowerCase();
    return {
      total: members.length,
      byRole,
      managers: members.filter((m) => m.role === "owner" || m.role === "admin").length,
      active: members.filter((m) => m.status === "active").length,
      pending: members.filter((m) => m.status && m.status !== "active").length,
      suspended: accounts ? members.filter((m) => statusOf(m) === "deactivated").length : null,
      invited: accounts ? members.filter((m) => statusOf(m) === "invited").length : null,
    };
  }, [members, accounts]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (roleTab && m.role !== roleTab) return false;
      if (!q) return true;
      return [m.display_name, m.email, m.user_sub].some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [members, search, roleTab]);

  // member · email · role · membership · platform role (+ account, + actions)
  const cols = 5 + (accounts ? 1 : 0) + (canManage ? 1 : 0);

  const onChangeRole = async (m, role) => {
    if (role === m.role) return;
    setRowBusy(m.user_sub); setRowError(null);
    try {
      await updateMember(tenant.id, m.user_sub, role);
      if (onToast) onToast(tr(lang, "Роль оновлено", "Role updated"));
      req.reload();
    } catch (err) {
      const msg = err.status === 409
        ? (tr(lang, "Клініка має мати щонайменше одного власника", "A clinic must keep at least one owner"))
        : errMsg(err, tr(lang, "Не вдалося змінити роль", "Could not change role"));
      setRowError({ sub: m.user_sub, msg });
    } finally { setRowBusy(null); }
  };

  // One runner for every confirmed row action. `kind` decides the call, the
  // toast and the reload; 409 (last owner) and 403 (no MFA / not tenant_admin)
  // are translated, everything else falls back to the problem detail.
  const runAction = async ({ kind, member: m }) => {
    setRowBusy(m.user_sub); setRowError(null);
    try {
      if (kind === "remove") {
        await removeMember(tenant.id, m.user_sub);
        if (onToast) onToast(tr(lang, "Учасника вилучено", "Member removed"));
        req.reload();
      } else if (kind === "suspend") {
        await deactivateUser(m.user_sub);
        if (onToast) onToast(tr(lang, "Обліковий запис призупинено", "Account suspended"));
        await reloadAccounts();
      } else if (kind === "reactivate") {
        await reactivateUser(m.user_sub);
        if (onToast) onToast(tr(lang, "Обліковий запис відновлено", "Account reactivated"));
        await reloadAccounts();
      }
      setAction(null);
    } catch (err) {
      const fallback = {
        remove:     tr(lang, "Не вдалося вилучити", "Could not remove member"),
        suspend:    tr(lang, "Не вдалося призупинити обліковий запис", "Could not suspend the account"),
        reactivate: tr(lang, "Не вдалося відновити обліковий запис", "Could not reactivate the account"),
      }[kind];
      const msg = err.status === 409
        ? tr(lang, "Клініка має мати щонайменше одного власника", "A clinic must keep at least one owner")
        : err.status === 403
          ? tr(lang, "Потрібні права адміністратора та підтверджений MFA.", "Requires tenant admin rights and a verified MFA session.")
          : errMsg(err, fallback);
      setRowError({ sub: m.user_sub, msg });
      setAction(null);
    } finally { setRowBusy(null); }
  };

  const tabs = ["", ...MANAGEMENT_ROLES.filter((r) => stats.byRole[r])];

  return (
    <div className="page tenant-members">
      <div className="page-h">
        <div>
          <h1>{tr(lang, "Учасники клініки", "Clinic members")}</h1>
          <p className="sub">
            {tr(lang, "Хто має доступ до", "Who has access to")} {tenant.display_name}.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
          <button className="btn" onClick={() => req.reload()} disabled={req.loading}>
            <Icon name="refresh" size={14} />
            <span>{tr(lang, "Оновити", "Refresh")}</span>
          </button>
          {canManage && (
            <button className="btn accent" onClick={() => setAddOpen(true)}>
              <Icon name="plus" size={14} />
              <span>{tr(lang, "Додати учасника", "Add member")}</span>
            </button>
          )}
        </div>
      </div>

      {!canManage && (
        <div className="tenant-readonly-note">
          <Icon name="eye" size={14} />
          <span>{tr(lang, "Лише для перегляду. Керувати учасниками можуть власник або адміністратор.", "Read-only. Only an owner or admin can manage members.")}</span>
        </div>
      )}

      <div className="tenant-stats">
        <div className="stat-card">
          <div className="stat-card-h">
            <span className="stat-card-label">{tr(lang, "Усього", "Members")}</span>
            <span className="stat-card-icon"><Icon name="users" size={15} /></span>
          </div>
          <div className="stat-card-value">{stats.total}</div>
          <div className="stat-card-sub">{tenant.display_name}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-h">
            <span className="stat-card-label">{tr(lang, "Керівники", "Owners & admins")}</span>
            <span className="stat-card-icon"><Icon name="shield" size={15} /></span>
          </div>
          <div className="stat-card-value">{stats.managers}</div>
          <div className="stat-card-sub">{tr(lang, "можуть керувати клінікою", "can manage this clinic")}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-h">
            <span className="stat-card-label">{tr(lang, "Активні", "Active")}</span>
            <span className="stat-card-icon"><Icon name="check" size={15} /></span>
          </div>
          <div className="stat-card-value">{stats.active}</div>
          <div className="stat-card-sub">
            {stats.pending
              ? `${stats.pending} ${tr(lang, "неактивні", "not active")}`
              : tr(lang, "усі учасники активні", "everyone is active")}
          </div>
        </div>
        {stats.suspended !== null && (
          <div className={"stat-card" + (stats.suspended ? " tm-stat-warn" : "")}>
            <div className="stat-card-h">
              <span className="stat-card-label">{tr(lang, "Призупинені", "Suspended")}</span>
              <span className="stat-card-icon"><Icon name="shield" size={15} /></span>
            </div>
            <div className="stat-card-value">{stats.suspended}</div>
            <div className="stat-card-sub">
              {stats.invited
                ? `${stats.invited} ${tr(lang, "запрошені, ще не входили", "invited, never signed in")}`
                : tr(lang, "заблоковані облікові записи", "accounts blocked from signing in")}
            </div>
          </div>
        )}
      </div>

      {req.error && <ApiErrorView error={req.error} lang={lang} />}

      {!req.error && (
        <>
          <div className="ptable-toolbar" style={{ marginBottom: 0, paddingBottom: 12 }}>
            <label className="search-input">
              <Icon name="search" size={14} />
              <input
                placeholder={tr(lang, "Пошук за імʼям або email…", "Search name or email…")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button style={{ marginLeft: 4, opacity: .6 }} onClick={() => setSearch("")}>✕</button>
              )}
            </label>
          </div>

          {tabs.length > 1 && (
            <div className="tabs" style={{ marginBottom: 14 }}>
              {tabs.map((r) => (
                <button
                  key={r || "all"}
                  type="button"
                  className={`tab${roleTab === r ? " on" : ""}`}
                  onClick={() => setRoleTab(r)}
                >
                  {r || tr(lang, "Всі", "All")}
                  <span className="tab-count">{r ? stats.byRole[r] : stats.total}</span>
                </button>
              ))}
            </div>
          )}

          <section className="card admin-card">
            <header className="admin-card-h">
              <Icon name="users" size={14} />
              <h2>{tr(lang, "Учасники", "Members")}</h2>
              <small className="muted">
                {visible.length} / {stats.total}
              </small>
            </header>

            {req.loading ? <Loading lang={lang} /> : visible.length === 0 ? (
              <div style={{ padding: "24px 0" }}>
                <Empty
                  icon="users"
                  title={members.length === 0
                    ? tr(lang, "Немає учасників", "No members yet")
                    : tr(lang, "Нічого не знайдено", "No matches")}
                  body={members.length === 0
                    ? tr(lang, "Додайте колег, щоб вони отримали доступ до клініки.", "Add colleagues to give them access to this clinic.")
                    : tr(lang, "Змініть пошук або фільтр ролі.", "Try a different search or role filter.")}
                />
              </div>
            ) : (
              <table className="admin-table tenant-members-table">
                <thead>
                  <tr>
                    <th>{tr(lang, "Учасник", "Member")}</th>
                    <th>Email</th>
                    <th>{tr(lang, "Роль", "Role")}</th>
                    <th>{tr(lang, "Членство", "Membership")}</th>
                    {accounts && <th>{tr(lang, "Обліковий запис", "Account")}</th>}
                    <th>{tr(lang, "Платформна роль", "Platform role")}</th>
                    {canManage && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((m) => (
                    <React.Fragment key={m.user_sub}>
                      <tr className={rowBusy === m.user_sub ? "row-busy" : ""}>
                        <td>
                          <div className="tm-person">
                            <span className="person-avatar">{initials(m)}</span>
                            <span className="person-text">
                              <span className="person-name">
                                {m.display_name || m.email || "—"}
                                {mySub && m.user_sub === mySub && (
                                  <span className="chip tm-you">{tr(lang, "це ви", "you")}</span>
                                )}
                              </span>
                              <code className="tm-sub">{(m.user_sub || "").slice(0, 8)}…</code>
                            </span>
                          </div>
                        </td>
                        <td>{m.email || "—"}</td>
                        <td>
                          {canManage ? (
                            <MenuSelect
                              value={m.role}
                              options={ROLE_OPTIONS}
                              onChange={(v) => onChangeRole(m, v)}
                              disabled={rowBusy === m.user_sub}
                              ariaLabel={tr(lang, "Роль", "Role")}
                            />
                          ) : roleChip(m.role)}
                        </td>
                        <td><span className={"chip " + (m.status === "active" ? "chip-ok" : "chip-warn")}>{m.status}</span></td>
                        {accounts && <td>{accountChip(accountOf(m), lang)}</td>}
                        <td><span className="chip">{m.platform_role || "—"}</span></td>
                        {canManage && (
                          <td className="tm-actions">
                            <RowActions
                              member={m}
                              lang={lang}
                              isSelf={!!mySub && m.user_sub === mySub}
                              accountStatus={accountStatus(m)}
                              knowsAccount={!!accounts}
                              busy={rowBusy === m.user_sub}
                              onAction={(kind) => setAction({ kind, member: m })}
                            />
                          </td>
                        )}
                      </tr>
                      {rowError && rowError.sub === m.user_sub && (
                        <tr className="tenant-row-error">
                          <td colSpan={cols}>
                            <span className="field-error"><Icon name="x" size={12} /> {rowError.msg}</span>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}

      {addOpen && (
        <AddMemberModal
          tenant={tenant}
          lang={lang}
          onClose={() => setAddOpen(false)}
          onAdded={() => { setAddOpen(false); req.reload(); if (onToast) onToast(tr(lang, "Учасника додано", "Member added")); }}
        />
      )}

      {action && (
        <ActionModal
          action={action}
          lang={lang}
          busy={rowBusy === action.member.user_sub}
          onClose={() => setAction(null)}
          onConfirm={() => runAction(action)}
        />
      )}
    </div>
  );
}

// Platform account state, cross-referenced from /admin/users.
function accountChip(user, lang) {
  if (!user) return <span className="chip">—</span>;
  const s = String(user.status || "").toLowerCase();
  const LABELS = {
    active:      { uk: "активний",     en: "active" },
    invited:     { uk: "запрошений",   en: "invited" },
    suspended:   { uk: "призупинений", en: "suspended" },
    deactivated: { uk: "призупинений", en: "suspended" },
  };
  const tone = s === "active" ? "chip-ok" : s === "invited" ? "" : "chip-warn";
  const label = LABELS[s] ? tr(lang, LABELS[s].uk, LABELS[s].en) : (user.status || "—");
  return <span className={"chip " + tone}>{label}</span>;
}

// Row "…" menu — same pattern as the reports list. Membership actions and the
// platform-wide account actions are separated by a rule so nobody suspends a
// login when they meant to drop someone from one clinic.
function RowActions({ member, lang, isSelf, accountStatus, knowsAccount, busy, onAction }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const pick = (kind) => { setOpen(false); onAction(kind); };
  const suspended = accountStatus === "deactivated" || accountStatus === "suspended";

  return (
    <div className="insights-wrap tm-menu-wrap" ref={wrapRef}>
      <button
        type="button"
        className={"btn ghost sm insights-btn" + (open ? " accent" : "")}
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        title={tr(lang, "Дії", "Actions")}
      >
        <Icon name={busy ? "clock" : "moreV"} size={16} />
      </button>
      {open && (
        <div className="row-actions-menu" role="menu">
          <div className="row-action-h">{tr(lang, "Обліковий запис", "Account")}</div>
          {/* No account directory (403 or a fetch failure) → nothing to act on. */}
          {!knowsAccount ? (
            <div className="row-action-note">{tr(lang, "Стан облікового запису недоступний", "Account state unavailable")}</div>
          ) : isSelf ? (
            <div className="row-action-note">{tr(lang, "Не можна призупинити власний запис", "You cannot suspend your own account")}</div>
          ) : suspended ? (
            <button type="button" role="menuitem" className="row-action" onClick={() => pick("reactivate")}>
              <Icon name="check" size={14} />
              <span>{tr(lang, "Відновити доступ", "Reactivate account")}</span>
            </button>
          ) : (
            <button type="button" role="menuitem" className="row-action danger" onClick={() => pick("suspend")}>
              <Icon name="shield" size={14} />
              <span>{tr(lang, "Призупинити обліковий запис", "Suspend account")}</span>
            </button>
          )}

          <div className="row-action-sep" />
          <div className="row-action-h">{tr(lang, "Членство в клініці", "Clinic membership")}</div>
          <button type="button" role="menuitem" className="row-action danger" onClick={() => pick("remove")}>
            <Icon name="x" size={14} />
            <span>{tr(lang, "Вилучити з клініки", "Remove from clinic")}</span>
          </button>
        </div>
      )}
    </div>
  );
}

// Confirmation for every row action. Suspend is deliberately wordy: it is the
// only one that reaches beyond this clinic.
function ActionModal({ action, lang, busy, onClose, onConfirm }) {
  const { kind, member: m } = action;
  const COPY = {
    remove: {
      title: tr(lang, "Вилучити з клініки?", "Remove from clinic?"),
      body: tr(lang,
        "Учасник втратить доступ до цієї клініки. Обліковий запис і доступ до інших клінік залишаються. Можна додати знову будь-коли.",
        "They lose access to this clinic. Their account and any other clinics are untouched. You can add them back at any time."),
      cta: tr(lang, "Вилучити", "Remove"),
      danger: true,
    },
    suspend: {
      title: tr(lang, "Призупинити обліковий запис?", "Suspend account?"),
      body: tr(lang,
        "Вхід буде заблоковано на всій платформі, а всі активні сесії — завершено негайно. Це стосується не лише цієї клініки. Членство зберігається; доступ можна відновити.",
        "Sign-in is blocked across the whole platform and every active session ends immediately. This is not limited to this clinic. Membership is kept, and you can reactivate later."),
      cta: tr(lang, "Призупинити", "Suspend"),
      danger: true,
    },
    reactivate: {
      title: tr(lang, "Відновити доступ?", "Reactivate account?"),
      body: tr(lang,
        "Вхід буде знову дозволено. Користувачу потрібно увійти самостійно — старі сесії не відновлюються.",
        "Sign-in is enabled again. The user has to log in themselves; old sessions are not restored."),
      cta: tr(lang, "Відновити", "Reactivate"),
      danger: false,
    },
  }[kind];

  return (
    <Modal onClose={() => { if (!busy) onClose(); }} className="dialog-modal">
      <div className="modal-h">
        <h2>{COPY.title}</h2>
        <p>{COPY.body}</p>
      </div>
      <div className="modal-body">
        <div className="confirm-person">
          <span className="person-avatar">{initials(m)}</span>
          <span className="person-text">
            <span className="person-name">{m.display_name || m.email || "—"}</span>
            <span className="muted">{m.email || m.user_sub}</span>
          </span>
          {roleChip(m.role)}
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose} disabled={busy}>
          {tr(lang, "Скасувати", "Cancel")}
        </button>
        <button
          className={"btn " + (COPY.danger ? "btn-danger" : "accent")}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? "…" : COPY.cta}
        </button>
      </div>
    </Modal>
  );
}

// POST /tenants/{id}/members — add by user_sub OR email (TENANT.md §2.4).
function AddMemberModal({ tenant, lang, onClose, onAdded }) {
  const [mode, setMode] = useState("email"); // "email" | "user_sub"
  const [value, setValue] = useState("");
  const [role, setRole] = useState("doctor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const body = mode === "email" ? { email: value.trim(), role } : { user_sub: value.trim(), role };
      await addMember(tenant.id, body);
      onAdded();
    } catch (err) {
      if (err.status === 409) setError({ status: 409, problem: { title: tr(lang, "Вже є учасником", "Already a member") } });
      else if (err.status === 404) setError({ status: 404, problem: { title: tr(lang, "Користувача з таким email не знайдено в цій клініці", "No user with that email in this clinic") } });
      else setError(err);
    } finally { setBusy(false); }
  };

  return (
    <Modal onClose={() => { if (!busy) onClose(); }} className="dialog-modal">
      <form onSubmit={submit}>
        <div className="modal-h">
          <h2>{tr(lang, "Додати учасника", "Add member")}</h2>
          <p>{tr(lang, "Користувач одразу отримає доступ до цієї клініки.", "The user gets access to this clinic straight away.")}</p>
        </div>

        <div className="modal-body tenant-form-body">
          {error && <ApiErrorView error={error} lang={lang} />}

          <div className="seg" role="group" aria-label={tr(lang, "Спосіб пошуку", "Lookup method")}>
            <button type="button" className={"seg-btn" + (mode === "email" ? " on" : "")} onClick={() => setMode("email")}>Email</button>
            <button type="button" className={"seg-btn" + (mode === "user_sub" ? " on" : "")} onClick={() => setMode("user_sub")}>user_sub</button>
          </div>

          <label className="admin-field">
            <span>{mode === "email" ? "Email" : "user_sub"}</span>
            <input
              type={mode === "email" ? "email" : "text"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={mode === "email" ? "nurse@tenant-a.example" : "0c000000-0000-0000-0000-00000000000a"}
              required
              disabled={busy}
              autoFocus
            />
          </label>

          <div className="admin-field">
            <span>{tr(lang, "Роль", "Role")}</span>
            <MenuSelect
              block
              value={role}
              options={roleOptions(lang)}
              onChange={setRole}
              disabled={busy}
              ariaLabel={tr(lang, "Роль", "Role")}
            />
          </div>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            {tr(lang, "Скасувати", "Cancel")}
          </button>
          <button type="submit" className="btn accent" disabled={busy || !value.trim()}>
            {busy ? (tr(lang, "Додавання…", "Adding…")) : (tr(lang, "Додати", "Add"))}
          </button>
        </div>
      </form>
    </Modal>
  );
}
