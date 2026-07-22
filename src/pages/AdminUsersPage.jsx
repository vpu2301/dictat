// AdminUsersPage.jsx — /admin/users. Invite + recent actions + deactivate.
import React, { useEffect, useState } from "react";
import { Icon, Modal } from "../components/UI.jsx";
import { MenuSelect } from "../components/MenuSelect.jsx";
import { ApiErrorView } from "../components/ApiErrorView.jsx";
import { inviteUser, deactivateUser } from "../api/endpoints.js";
import { tr } from "../i18n.js";

const STORAGE_KEY = "mdx_recent_invites_v1";
const ROLES = ["tenant_admin", "clinician", "nurse", "auditor"];

// Platform RBAC roles (distinct from the clinic management roles on
// /tenant/members). The sub line spells out what each one unlocks.
function roleOptions(lang) {
  const SUBS = {
    tenant_admin: { uk: "Керує користувачами й клінікою", en: "Manages users and the clinic" },
    clinician:    { uk: "Диктує та підписує звіти",       en: "Dictates and signs reports" },
    nurse:        { uk: "Готує звіти без підпису",        en: "Prepares reports, cannot sign" },
    auditor:      { uk: "Лише читання та аудит-журнал",   en: "Read-only plus the audit log" },
  };
  return ROLES.map((r) => ({
    value: r,
    label: r,
    sub: SUBS[r] ? tr(lang, SUBS[r].uk, SUBS[r].en) : undefined,
  }));
}

function loadRecent() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}
function saveRecent(list) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
}

// Two-letter monogram for the confirmation avatar.
function initialsOf(u) {
  const src = (u.display_name || u.email || "?").trim();
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0] || "?").charAt(0) + (parts.length > 1 ? parts[1].charAt(0) : "")).toUpperCase();
}

export function AdminUsersPage({ lang = "en", onToast }) {
  const [form, setForm] = useState({ email: "", display_name: "", role: "clinician", first_name: "", last_name: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [recent, setRecent] = useState(loadRecent);
  const [confirm, setConfirm] = useState(null); // { sub, email }
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => { saveRecent(recent); }, [recent]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onInvite = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      const r = await inviteUser({
        email: form.email.trim(),
        display_name: form.display_name.trim(),
        role: form.role,
        first_name: form.first_name.trim() || undefined,
        last_name: form.last_name.trim() || undefined,
      });
      const row = {
        sub: r.sub, email: r.email, role: r.role, status: r.status,
        display_name: form.display_name.trim(),
        invited_at: new Date().toISOString(),
      };
      setRecent((cur) => [row, ...cur].slice(0, 50));
      setForm({ email: "", display_name: "", role: "clinician", first_name: "", last_name: "" });
      if (onToast) onToast(lang === "uk" ? `Запрошення надіслано до ${row.email}` : `Invite sent to ${row.email}`);
    } catch (err) {
      if (err.status === 409) setFieldErrors({ email: tr(lang, "Email вже зареєстровано", "Email already registered") });
      else if (err.status === 400 || err.status === 422) {
        const d = (err.problem && err.problem.detail) || "";
        setError(err);
      } else setError(err);
    } finally { setSubmitting(false); }
  };

  const doDeactivate = async () => {
    if (!confirm) return;
    setDeactivating(true);
    try {
      await deactivateUser(confirm.sub);
      setRecent((cur) => cur.map((r) => r.sub === confirm.sub ? { ...r, status: "deactivated" } : r));
      if (onToast) onToast(tr(lang, "Деактивовано", "Deactivated"));
      setConfirm(null);
    } catch (err) {
      setError(err);
      setConfirm(null);
    } finally { setDeactivating(false); }
  };

  return (
    <div className="page admin-users">
      <div className="page-h">
        <div>
          <h1>{tr(lang, "Користувачі тенанта", "Tenant users")}</h1>
          <p className="muted">{tr(lang, "Запросити нового користувача або деактивувати наявного.", "Invite new users or deactivate existing ones.")}</p>
        </div>
      </div>

      {error && <ApiErrorView error={error} lang={lang} />}

      <section className="card admin-card">
        <header className="admin-card-h">
          <Icon name="plus" size={14} />
          <h2>{tr(lang, "Запросити", "Invite user")}</h2>
        </header>
        <form className="admin-form" onSubmit={onInvite}>
          <label className="admin-field">
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="user@example.com"
              required
              disabled={submitting}
            />
            {fieldErrors.email && <small className="field-error">{fieldErrors.email}</small>}
          </label>
          <label className="admin-field">
            <span>{tr(lang, "Імʼя для показу", "Display name")}</span>
            <input
              type="text"
              value={form.display_name}
              onChange={(e) => set("display_name", e.target.value)}
              placeholder="Dr. Kovalenko"
              required
              disabled={submitting}
            />
          </label>
          <div className="admin-field">
            <span>{tr(lang, "Роль", "Role")}</span>
            <MenuSelect
              block
              value={form.role}
              options={roleOptions(lang)}
              onChange={(v) => set("role", v)}
              disabled={submitting}
              ariaLabel={tr(lang, "Роль", "Role")}
            />
          </div>
          <label className="admin-field">
            <span>{tr(lang, "Імʼя", "First name")}</span>
            <input
              type="text"
              value={form.first_name}
              onChange={(e) => set("first_name", e.target.value)}
              disabled={submitting}
            />
          </label>
          <label className="admin-field">
            <span>{tr(lang, "Прізвище", "Last name")}</span>
            <input
              type="text"
              value={form.last_name}
              onChange={(e) => set("last_name", e.target.value)}
              disabled={submitting}
            />
          </label>
          <div className="admin-form-actions">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting
                ? (tr(lang, "Надсилання…", "Sending…"))
                : (tr(lang, "Надіслати запрошення", "Send invite"))}
            </button>
          </div>
        </form>
      </section>

      <section className="card admin-card">
        <header className="admin-card-h">
          <Icon name="users" size={14} />
          <h2>{tr(lang, "Останні дії", "Recent actions")}</h2>
          <small className="muted">
            {tr(lang, "Локальний журнал, не повний довідник. Повна історія — в Аудит-журналі.", "Local log, not the full directory. See audit log for the full record.")}
          </small>
        </header>
        {recent.length === 0 ? (
          <div className="admin-empty">{tr(lang, "Поки нічого.", "Nothing here yet.")}</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>{tr(lang, "Імʼя", "Name")}</th>
                <th>{tr(lang, "Роль", "Role")}</th>
                <th>{tr(lang, "Статус", "Status")}</th>
                <th>sub</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.sub} className={r.status === "deactivated" ? "row-deactivated" : ""}>
                  <td>{r.email}</td>
                  <td>{r.display_name || "—"}</td>
                  <td><span className="chip">{r.role}</span></td>
                  <td><span className={"chip " + (r.status === "deactivated" ? "chip-warn" : "chip-ok")}>{r.status}</span></td>
                  <td><code style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{(r.sub || "").slice(0, 8)}…</code></td>
                  <td>
                    {r.status !== "deactivated" && (
                      <button className="btn btn-ghost" onClick={() => setConfirm(r)}>
                        {tr(lang, "Деактивувати", "Deactivate")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {confirm && (
        <Modal onClose={() => { if (!deactivating) setConfirm(null); }} className="dialog-modal">
          <div className="modal-h">
            <h2>{tr(lang, "Деактивувати користувача?", "Deactivate user?")}</h2>
            <p>
              {tr(lang,
                "Вхід буде заблоковано на всій платформі, а всі активні сесії — завершено негайно. Доступ можна відновити пізніше.",
                "Sign-in is blocked across the whole platform and every active session ends immediately. Access can be restored later.")}
            </p>
          </div>
          <div className="modal-body">
            <div className="confirm-person">
              <span className="person-avatar">{initialsOf(confirm)}</span>
              <span className="person-text">
                <span className="person-name">{confirm.display_name || confirm.email || "—"}</span>
                <span className="muted">{confirm.email}</span>
              </span>
              {confirm.role && <span className="chip">{confirm.role}</span>}
            </div>
          </div>
          <div className="modal-foot">
            <button className="btn" onClick={() => setConfirm(null)} disabled={deactivating}>
              {tr(lang, "Скасувати", "Cancel")}
            </button>
            <button className="btn btn-danger" onClick={doDeactivate} disabled={deactivating}>
              {deactivating ? "…" : (tr(lang, "Деактивувати", "Deactivate"))}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
