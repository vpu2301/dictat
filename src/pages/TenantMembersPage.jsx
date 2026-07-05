// TenantMembersPage.jsx — /tenant/members. Lists the active tenant's members
// and (for owner/admin) adds, re-roles and removes them (TENANT.md §2.4).
//
// The backend refuses to demote/remove the LAST owner (409) — we surface that
// inline against the row and leave it unchanged rather than crashing.
import React, { useState } from "react";
import { Icon, Modal } from "../components/UI.jsx";
import { ApiErrorView } from "../components/ApiErrorView.jsx";
import { Loading, asList } from "../components/DataStates.jsx";
import { useAsync } from "../api/useAsync.js";
import { useClaims } from "../auth/AuthContext.jsx";
import {
  getCurrentTenant, listMembers, addMember, updateMember, removeMember,
  canManageTenant, MANAGEMENT_ROLES,
} from "../api/tenants.js";

export function TenantMembersPage({ lang = "en", onToast }) {
  const claims = useClaims();
  const tenantReq = useAsync(() => getCurrentTenant(), [claims?.tid]);
  const tenant = tenantReq.data;

  if (tenantReq.loading) return <div className="page"><Loading lang={lang} /></div>;
  if (tenantReq.error)   return <div className="page"><ApiErrorView error={tenantReq.error} lang={lang} /></div>;
  if (!tenant)           return <div className="page"><ApiErrorView error={{ status: 404, problem: { title: "No active clinic" } }} lang={lang} /></div>;

  return <MembersTable tenant={tenant} canManage={canManageTenant(claims, tenant.my_role)} lang={lang} onToast={onToast} />;
}

function roleChip(role) {
  const manages = role === "owner" || role === "admin";
  return <span className={"chip " + (manages ? "chip-ok" : "")}>{role}</span>;
}

function MembersTable({ tenant, canManage, lang, onToast }) {
  const req = useAsync(() => listMembers(tenant.id), [tenant.id]);
  const members = asList(req.data);
  const [addOpen, setAddOpen] = useState(false);
  const [rowBusy, setRowBusy] = useState(null);   // user_sub in-flight
  const [rowError, setRowError] = useState(null);  // { sub, msg }
  const [confirm, setConfirm] = useState(null);    // member pending removal

  const errMsg = (err, fallback) => (err?.problem?.detail || err?.problem?.title || err?.message || fallback);

  const onChangeRole = async (m, role) => {
    if (role === m.role) return;
    setRowBusy(m.user_sub); setRowError(null);
    try {
      await updateMember(tenant.id, m.user_sub, role);
      if (onToast) onToast(lang === "uk" ? "Роль оновлено" : "Role updated");
      req.reload();
    } catch (err) {
      const msg = err.status === 409
        ? (lang === "uk" ? "Клініка має мати щонайменше одного власника" : "A clinic must keep at least one owner")
        : errMsg(err, lang === "uk" ? "Не вдалося змінити роль" : "Could not change role");
      setRowError({ sub: m.user_sub, msg });
    } finally { setRowBusy(null); }
  };

  const doRemove = async (m) => {
    setRowBusy(m.user_sub); setRowError(null);
    try {
      await removeMember(tenant.id, m.user_sub);
      if (onToast) onToast(lang === "uk" ? "Учасника вилучено" : "Member removed");
      setConfirm(null);
      req.reload();
    } catch (err) {
      const msg = err.status === 409
        ? (lang === "uk" ? "Клініка має мати щонайменше одного власника" : "A clinic must keep at least one owner")
        : errMsg(err, lang === "uk" ? "Не вдалося вилучити" : "Could not remove member");
      setRowError({ sub: m.user_sub, msg });
      setConfirm(null);
    } finally { setRowBusy(null); }
  };

  return (
    <div className="page tenant-members">
      <div className="page-h">
        <div style={{ flex: 1 }}>
          <h1>{lang === "uk" ? "Учасники клініки" : "Clinic members"}</h1>
          <p className="sub">{tenant.display_name} · {members.length} {lang === "uk" ? "учасників" : "members"}</p>
        </div>
        {canManage && (
          <button className="btn accent" onClick={() => setAddOpen(true)}>
            <Icon name="plus" size={13} /> {lang === "uk" ? "Додати учасника" : "Add member"}
          </button>
        )}
      </div>

      {req.loading && <Loading lang={lang} />}
      {req.error && <ApiErrorView error={req.error} lang={lang} />}

      {!req.loading && !req.error && (
        <table className="admin-table tenant-members-table">
          <thead>
            <tr>
              <th>{lang === "uk" ? "Імʼя" : "Name"}</th>
              <th>Email</th>
              <th>{lang === "uk" ? "Роль" : "Role"}</th>
              <th>{lang === "uk" ? "Статус" : "Status"}</th>
              <th>{lang === "uk" ? "Платформна роль" : "Platform role"}</th>
              {canManage && <th></th>}
            </tr>
          </thead>
          <tbody>
            {members.length === 0 && (
              <tr><td colSpan={canManage ? 6 : 5} className="admin-empty">{lang === "uk" ? "Немає учасників." : "No members yet."}</td></tr>
            )}
            {members.map((m) => (
              <React.Fragment key={m.user_sub}>
                <tr className={rowBusy === m.user_sub ? "row-busy" : ""}>
                  <td>{m.display_name || "—"}</td>
                  <td>{m.email || "—"}</td>
                  <td>
                    {canManage ? (
                      <select
                        value={m.role}
                        disabled={rowBusy === m.user_sub}
                        onChange={(e) => onChangeRole(m, e.target.value)}
                      >
                        {MANAGEMENT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    ) : roleChip(m.role)}
                  </td>
                  <td><span className={"chip " + (m.status === "active" ? "chip-ok" : "chip-warn")}>{m.status}</span></td>
                  <td><span className="chip">{m.platform_role || "—"}</span></td>
                  {canManage && (
                    <td>
                      <button className="btn btn-ghost" disabled={rowBusy === m.user_sub} onClick={() => setConfirm(m)}>
                        {lang === "uk" ? "Вилучити" : "Remove"}
                      </button>
                    </td>
                  )}
                </tr>
                {rowError && rowError.sub === m.user_sub && (
                  <tr className="tenant-row-error">
                    <td colSpan={canManage ? 6 : 5}>
                      <span className="field-error"><Icon name="x" size={12} /> {rowError.msg}</span>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}

      {addOpen && (
        <AddMemberModal
          tenant={tenant}
          lang={lang}
          onClose={() => setAddOpen(false)}
          onAdded={() => { setAddOpen(false); req.reload(); if (onToast) onToast(lang === "uk" ? "Учасника додано" : "Member added"); }}
        />
      )}

      {confirm && (
        <Modal onClose={() => setConfirm(null)}>
          <h3 style={{ margin: 0 }}>{lang === "uk" ? "Вилучити учасника?" : "Remove member?"}</h3>
          <p style={{ color: "var(--muted)" }}>
            {(confirm.display_name || confirm.email || confirm.user_sub)} — {lang === "uk" ? "втратить доступ до цієї клініки." : "will lose access to this clinic."}
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
            <button className="btn" onClick={() => setConfirm(null)} disabled={rowBusy === confirm.user_sub}>
              {lang === "uk" ? "Скасувати" : "Cancel"}
            </button>
            <button className="btn btn-danger" onClick={() => doRemove(confirm)} disabled={rowBusy === confirm.user_sub}>
              {rowBusy === confirm.user_sub ? "…" : (lang === "uk" ? "Вилучити" : "Remove")}
            </button>
          </div>
        </Modal>
      )}
    </div>
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
      if (err.status === 409) setError({ status: 409, problem: { title: lang === "uk" ? "Вже є учасником" : "Already a member" } });
      else if (err.status === 404) setError({ status: 404, problem: { title: lang === "uk" ? "Користувача з таким email не знайдено в цій клініці" : "No user with that email in this clinic" } });
      else setError(err);
    } finally { setBusy(false); }
  };

  return (
    <Modal onClose={() => { if (!busy) onClose(); }}>
      <form className="admin-form" onSubmit={submit} style={{ minWidth: 340 }}>
        <h3 style={{ margin: "0 0 4px" }}>{lang === "uk" ? "Додати учасника" : "Add member"}</h3>
        {error && <ApiErrorView error={error} lang={lang} />}
        <div className="seg" style={{ display: "flex", gap: 6, marginBottom: 4 }}>
          <button type="button" className={"btn " + (mode === "email" ? "btn-primary" : "btn-ghost")} onClick={() => setMode("email")}>Email</button>
          <button type="button" className={"btn " + (mode === "user_sub" ? "btn-primary" : "btn-ghost")} onClick={() => setMode("user_sub")}>user_sub</button>
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
          />
        </label>
        <label className="admin-field">
          <span>{lang === "uk" ? "Роль" : "Role"}</span>
          <select value={role} onChange={(e) => setRole(e.target.value)} disabled={busy}>
            {MANAGEMENT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <div className="admin-form-actions" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            {lang === "uk" ? "Скасувати" : "Cancel"}
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !value.trim()}>
            {busy ? (lang === "uk" ? "Додавання…" : "Adding…") : (lang === "uk" ? "Додати" : "Add")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
