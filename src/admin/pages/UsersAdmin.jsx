// UsersAdmin.jsx — /admin/users. The real roster, at last.
//
// Replaces AdminUsersPage, whose "roster" was a localStorage log of the
// admin's own recent invites. This one reads GET /admin/users (offset-paged,
// bare array) and wires every user-management endpoint the backend has:
// invite, deactivate, reactivate, role replacement, MFA reset.
//
// Two truths this screen states rather than hides:
//   · `role` is the COLLAPSED PRIMARY (tenant_admin > clinician > nurse >
//     auditor > service) — there is no endpoint reading the full role set
//     back, so the role editor writes a set it can only partially observe.
//   · every mutation here is MFA-gated server-side. A non-enrolled admin's
//     click 403s with the grace code; the fetch client has already routed
//     them to enrolment by the time our catch runs, so that error renders
//     NOTHING — a scary red box under a redirect would be noise.
import React, { useState } from "react";
import { Icon, Empty } from "../../components/UI.jsx";
import { MenuSelect } from "../../components/MenuSelect.jsx";
import { ApiErrorView } from "../../components/ApiErrorView.jsx";
import { Pagination } from "../../components/Pagination.jsx";
import { Loading } from "../../components/DataStates.jsx";
import { ConfirmDialog } from "../ConfirmDialog.jsx";
import { useLimitedList } from "../useLimitedList.js";
import {
  ASSIGNABLE_ROLES, deactivateUser, getUser, inviteUser, listUsers,
  reactivateUser, setUserRoles,
} from "../../api/endpoints.js";
import { resetMfa } from "../../api/mfa.js";
import { isMfaEnrolmentRequired } from "../../auth/mfaGrace.js";
import { usePermission } from "../../auth/permissions.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { tr } from "../../i18n.js";

const PAGE = 50;
const INVITABLE_ROLES = ["tenant_admin", "clinician", "nurse", "auditor"];

const ROLE_SUBS = {
  tenant_admin:    { uk: "Керує користувачами й клінікою", en: "Manages users and the clinic" },
  clinician:       { uk: "Диктує та підписує звіти", en: "Dictates and signs reports" },
  nurse:           { uk: "Готує звіти без підпису", en: "Prepares reports, cannot sign" },
  auditor:         { uk: "Лише читання та аудит-журнал", en: "Read-only plus the audit log" },
  knowledge_admin: { uk: "Керує базою доказової інформації", en: "Manages the evidence corpus" },
};

const STATUS_CHIP = {
  active:      { cls: "chip-ok",   uk: "активний",      en: "active" },
  invited:     { cls: "",          uk: "запрошений",     en: "invited" },
  deactivated: { cls: "chip-warn", uk: "деактивований", en: "deactivated" },
};

function StatusChip({ status, lang }) {
  const s = STATUS_CHIP[status] || { cls: "", uk: status, en: status };
  return <span className={"chip " + s.cls}>{tr(lang, s.uk, s.en)}</span>;
}

// The MFA-grace silencer: the client already redirected to enrolment; render
// nothing for that error, surface everything else through `set`.
function surfaceError(err, set) {
  if (isMfaEnrolmentRequired(err)) return;
  set(err);
}

// ── Invite ────────────────────────────────────────────────────────────────
function InviteDialog({ lang, onDone, onCancel }) {
  const [form, setForm] = useState({ email: "", display_name: "", role: "clinician" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [emailTaken, setEmailTaken] = useState(false);
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setEmailTaken(false); };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null); setEmailTaken(false);
    try {
      await inviteUser({
        email: form.email.trim(),
        display_name: form.display_name.trim(),
        role: form.role,
      });
      onDone(form.email.trim());
    } catch (err) {
      if (isMfaEnrolmentRequired(err)) return; // redirected to enrolment
      if (err.status === 409) setEmailTaken(true);
      else setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={() => { if (!busy) onCancel(); }}>
      <div className="modal dialog-modal adm-invite" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <h2>{tr(lang, "Запросити користувача", "Invite a user")}</h2>
          <p>{tr(lang,
            "Користувач отримає обліковий запис у статусі «запрошений» і встановить пароль під час першого входу.",
            "The account is created as “invited”; the user sets a password on first sign-in.")}</p>
        </div>
        <form className="modal-body admin-form" onSubmit={submit}>
          <label className="admin-field">
            <span>Email</span>
            <input type="email" required autoFocus value={form.email} disabled={busy}
                   onChange={(e) => set("email", e.target.value)}
                   placeholder="user@clinic.example" data-testid="invite-email" />
            {emailTaken && (
              <small className="field-error" data-testid="invite-email-taken">
                {tr(lang, "Email вже зареєстровано", "Email already registered")}
              </small>
            )}
          </label>
          <label className="admin-field">
            <span>{tr(lang, "Імʼя для показу", "Display name")}</span>
            <input type="text" required value={form.display_name} disabled={busy}
                   onChange={(e) => set("display_name", e.target.value)}
                   placeholder="Dr. Kovalenko" data-testid="invite-name" />
          </label>
          <div className="admin-field">
            <span>{tr(lang, "Роль", "Role")}</span>
            <MenuSelect
              block
              value={form.role}
              options={INVITABLE_ROLES.map((r) => ({
                value: r, label: r,
                sub: ROLE_SUBS[r] ? tr(lang, ROLE_SUBS[r].uk, ROLE_SUBS[r].en) : undefined,
              }))}
              onChange={(v) => set("role", v)}
              disabled={busy}
              ariaLabel={tr(lang, "Роль", "Role")}
            />
          </div>
          {error && <ApiErrorView error={error} lang={lang} />}
          <div className="modal-foot" style={{ padding: 0, marginTop: 6 }}>
            <button type="button" className="btn" onClick={onCancel} disabled={busy}>
              {tr(lang, "Скасувати", "Cancel")}
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy} data-testid="invite-submit">
              {busy ? tr(lang, "Надсилання…", "Sending…") : tr(lang, "Надіслати запрошення", "Send invite")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Role editor ───────────────────────────────────────────────────────────
function RolesDialog({ user, lang, onDone, onCancel }) {
  // Seed from the collapsed primary — the only role the API lets us observe.
  const [roles, setRoles] = useState(() => new Set([user.role].filter(Boolean)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);      // generic
  const [lastAdmin, setLastAdmin] = useState(false); // the 409 guard

  const toggle = (r) => {
    setLastAdmin(false);
    setRoles((cur) => {
      const nxt = new Set(cur);
      if (nxt.has(r)) nxt.delete(r); else nxt.add(r);
      return nxt;
    });
  };

  const submit = async () => {
    setBusy(true); setError(null); setLastAdmin(false);
    try {
      await setUserRoles(user.sub, [...roles]);
      onDone([...roles]);
    } catch (err) {
      if (isMfaEnrolmentRequired(err)) return;
      // The route's only 409 is the last-admin guard — render it as a
      // blocking explanation, not a toast that evaporates mid-read.
      if (err.status === 409) setLastAdmin(true);
      else setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={() => { if (!busy) onCancel(); }}>
      <div className="modal dialog-modal adm-roles" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <h2>{tr(lang, "Ролі користувача", "User roles")}</h2>
          <p>
            {user.display_name || user.email} · {user.email}
          </p>
        </div>
        <div className="modal-body">
          <div className="adm-roles-list" data-testid="roles-list">
            {ASSIGNABLE_ROLES.map((r) => (
              <label key={r} className="adm-role-row">
                <input
                  type="checkbox"
                  checked={roles.has(r)}
                  onChange={() => toggle(r)}
                  disabled={busy}
                  data-testid={`role-${r}`}
                />
                <span className="adm-role-name">{r}</span>
                {ROLE_SUBS[r] && (
                  <span className="muted">{tr(lang, ROLE_SUBS[r].uk, ROLE_SUBS[r].en)}</span>
                )}
              </label>
            ))}
          </div>
          <p className="adm-roles-caveat muted">
            {tr(lang,
              "Сервер зберігає повний набір ролей, але повертає лише основну (за пріоритетом). Якщо у користувача було кілька ролей, зніміть галочки свідомо — цей запис замінює весь набір.",
              "The server stores the full role set but reads back only the primary (by precedence). If this user held several roles, untick deliberately — this write replaces the whole set.")}
          </p>
          {lastAdmin && (
            <div className="adm-dialog-error" role="alert" data-testid="last-admin-409">
              <Icon name="alert" size={14} />
              <span>
                {tr(lang,
                  "Неможливо зняти роль останнього адміністратора клініки. Спочатку призначте tenant_admin комусь іншому.",
                  "Cannot remove the last tenant administrator of this clinic. Grant tenant_admin to someone else first.")}
              </span>
            </div>
          )}
          {error && <ApiErrorView error={error} lang={lang} />}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onCancel} disabled={busy}>
            {tr(lang, "Скасувати", "Cancel")}
          </button>
          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={busy || roles.size === 0}
            data-testid="roles-save"
          >
            {busy ? "…" : tr(lang, "Зберегти ролі", "Save roles")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Detail (expanded row) ─────────────────────────────────────────────────
function UserDetailRow({ sub, lang, colSpan }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  React.useEffect(() => {
    let dead = false;
    getUser(sub)
      .then((d) => { if (!dead) setDetail(d); })
      .catch((e) => { if (!dead) setError(e); });
    return () => { dead = true; };
  }, [sub]);
  const dash = <span className="muted">—</span>;
  return (
    <tr className="row-expand">
      <td colSpan={colSpan}>
        {error ? (
          <ApiErrorView error={error} lang={lang} />
        ) : !detail ? (
          <Loading lang={lang} />
        ) : (
          <div className="adm-user-detail" data-testid="user-detail">
            <div><span>{tr(lang, "Створено", "Created")}</span><b className="mono">{detail.created_at || dash}</b></div>
            <div><span>{tr(lang, "Останній вхід", "Last sign-in")}</span><b className="mono">{detail.last_login_at || dash}</b></div>
            <div>
              <span>MFA</span>
              {detail.mfa_enrolled_at
                ? <b className="chip chip-ok" data-testid="mfa-enrolled">{tr(lang, "увімкнено", "enrolled")} · <span className="mono">{detail.mfa_enrolled_at}</span></b>
                : <b className="chip">{tr(lang, "не увімкнено", "not enrolled")}</b>}
            </div>
            <div><span>sub</span><b className="mono">{detail.sub}</b></div>
          </div>
        )}
      </td>
    </tr>
  );
}

// ── The page ──────────────────────────────────────────────────────────────
export function UsersAdmin({ lang = "uk", onToast }) {
  const { state: auth } = useAuth();
  const mySub = auth?.claims?.sub;
  // Auditors hold user.read server-side and see the roster read-only; the
  // mutation affordances hang off the two admin.* rows the MATRIX mirrors.
  const canInvite = usePermission("admin.user.invite", "user");
  const canManage = usePermission("admin.user.deactivate", "user");

  const roster = useLimitedList(({ limit, offset }) => listUsers({ limit, offset }), { limit: PAGE });
  const [expanded, setExpanded] = useState(null); // sub | null
  const [dialog, setDialog] = useState(null);     // {kind, user} | {kind:"invite"}
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const COLS = canManage ? 6 : 5;

  const toast = (uk, en) => { if (onToast) onToast(tr(lang, uk, en)); };

  const act = async (fn, doneUk, doneEn) => {
    setBusy(true); setActionError(null);
    try {
      await fn();
      setDialog(null);
      toast(doneUk, doneEn);
      roster.reload();
    } catch (err) {
      surfaceError(err, setActionError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="adm-page adm-users" data-testid="users-admin">
      <div className="page-h">
        <div style={{ flex: 1 }}>
          <h1>{tr(lang, "Користувачі", "Users")}</h1>
          <p className="muted">
            {tr(lang,
              "Облікові записи цієї клініки: запрошення, ролі, деактивація, MFA.",
              "This clinic's accounts: invites, roles, deactivation, MFA.")}
          </p>
        </div>
        {canInvite && (
          <button className="btn btn-primary" onClick={() => setDialog({ kind: "invite" })}
                  data-testid="open-invite">
            <Icon name="plus" size={14} /> {tr(lang, "Запросити", "Invite")}
          </button>
        )}
      </div>

      {roster.error && <ApiErrorView error={roster.error} lang={lang} onRetry={roster.reload} />}
      {actionError && !dialog && <ApiErrorView error={actionError} lang={lang} />}

      <section className="card">
        {roster.loading && roster.items.length === 0 ? (
          <Loading lang={lang} />
        ) : roster.items.length === 0 && !roster.error ? (
          <Empty icon="users"
                 title={tr(lang, "Поки що жодного користувача", "No users yet")}
                 body={tr(lang, "Запросіть першого користувача клініки.", "Invite this clinic's first user.")} />
        ) : (
          <table className="admin-table adm-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>{tr(lang, "Імʼя", "Name")}</th>
                <th>{tr(lang, "Основна роль", "Primary role")}</th>
                <th>{tr(lang, "Статус", "Status")}</th>
                <th style={{ width: 36 }}></th>
                {canManage && <th style={{ width: 320 }}>{tr(lang, "Дії", "Actions")}</th>}
              </tr>
            </thead>
            <tbody>
              {roster.items.map((u) => {
                const isOpen = expanded === u.sub;
                const isSelf = u.sub === mySub;
                return (
                  <React.Fragment key={u.sub}>
                    <tr className={u.status === "deactivated" ? "row-deactivated" : ""}
                        data-testid={`user-row-${u.email}`}>
                      <td>{u.email}</td>
                      <td>{u.display_name || <span className="muted">—</span>}</td>
                      <td><span className="chip">{u.role}</span></td>
                      <td><StatusChip status={u.status} lang={lang} /></td>
                      <td>
                        <button className="icon-btn" title={tr(lang, "Деталі", "Details")}
                                onClick={() => setExpanded(isOpen ? null : u.sub)}
                                data-testid={`user-expand-${u.email}`}>
                          <Icon name={isOpen ? "chevDown" : "chevRight"} size={13} />
                        </button>
                      </td>
                      {canManage && (
                        <td className="adm-row-actions">
                          <button className="btn btn-ghost sm"
                                  onClick={() => setDialog({ kind: "roles", user: u })}
                                  data-testid={`user-roles-${u.email}`}>
                            {tr(lang, "Ролі", "Roles")}
                          </button>
                          <button className="btn btn-ghost sm"
                                  onClick={() => setDialog({ kind: "resetMfa", user: u })}
                                  data-testid={`user-reset-mfa-${u.email}`}>
                            {tr(lang, "Скинути MFA", "Reset MFA")}
                          </button>
                          {u.status === "deactivated" ? (
                            <button className="btn btn-ghost sm"
                                    onClick={() => setDialog({ kind: "reactivate", user: u })}
                                    data-testid={`user-reactivate-${u.email}`}>
                              {tr(lang, "Реактивувати", "Reactivate")}
                            </button>
                          ) : (
                            <button className="btn btn-ghost sm adm-danger-link"
                                    disabled={isSelf}
                                    title={isSelf ? tr(lang, "Не можна деактивувати себе", "You cannot deactivate yourself") : undefined}
                                    onClick={() => setDialog({ kind: "deactivate", user: u })}
                                    data-testid={`user-deactivate-${u.email}`}>
                              {tr(lang, "Деактивувати", "Deactivate")}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                    {isOpen && <UserDetailRow sub={u.sub} lang={lang} colSpan={COLS} />}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
        <div className="adm-table-foot">
          <Pagination
            page={roster.page}
            hasPrev={roster.hasPrev}
            hasNext={roster.hasNext}
            onPrev={roster.prev}
            onNext={roster.next}
            loading={roster.loading}
            lang={lang}
          />
        </div>
      </section>

      {dialog?.kind === "invite" && (
        <InviteDialog
          lang={lang}
          onCancel={() => setDialog(null)}
          onDone={(email) => {
            setDialog(null);
            toast(`Запрошення надіслано до ${email}`, `Invite sent to ${email}`);
            roster.reload();
          }}
        />
      )}

      {dialog?.kind === "roles" && (
        <RolesDialog
          user={dialog.user}
          lang={lang}
          onCancel={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            toast("Ролі оновлено", "Roles updated");
            roster.reload();
          }}
        />
      )}

      {dialog?.kind === "deactivate" && (
        <ConfirmDialog
          lang={lang}
          danger
          busy={busy}
          title={tr(lang, "Деактивувати користувача?", "Deactivate this user?")}
          consequence={tr(lang,
            "Вхід буде заблоковано на всій платформі, а всі активні сеанси завершаться негайно. Доступ можна відновити пізніше кнопкою «Реактивувати».",
            "Sign-in is blocked across the whole platform and every active session ends immediately. Access can be restored later with “Reactivate”.")}
          confirmLabel={tr(lang, "Деактивувати", "Deactivate")}
          error={actionError ? <ApiErrorView error={actionError} lang={lang} /> : null}
          onCancel={() => { setDialog(null); setActionError(null); }}
          onConfirm={() => act(
            () => deactivateUser(dialog.user.sub),
            "Деактивовано", "Deactivated",
          )}
          testId="deactivate-dialog"
        >
          <div className="adm-dialog-person">
            <b>{dialog.user.display_name || dialog.user.email}</b>
            <span className="muted">{dialog.user.email}</span>
          </div>
        </ConfirmDialog>
      )}

      {dialog?.kind === "reactivate" && (
        <ConfirmDialog
          lang={lang}
          busy={busy}
          title={tr(lang, "Реактивувати користувача?", "Reactivate this user?")}
          consequence={tr(lang,
            "Вхід буде знову дозволено. Сеанси не відновлюються — користувач має увійти заново.",
            "Sign-in is allowed again. Sessions are not restored — the user signs in afresh.")}
          confirmLabel={tr(lang, "Реактивувати", "Reactivate")}
          error={actionError ? <ApiErrorView error={actionError} lang={lang} /> : null}
          onCancel={() => { setDialog(null); setActionError(null); }}
          onConfirm={() => act(
            () => reactivateUser(dialog.user.sub),
            "Реактивовано", "Reactivated",
          )}
          testId="reactivate-dialog"
        >
          <div className="adm-dialog-person">
            <b>{dialog.user.display_name || dialog.user.email}</b>
            <span className="muted">{dialog.user.email}</span>
          </div>
        </ConfirmDialog>
      )}

      {dialog?.kind === "resetMfa" && (
        <ConfirmDialog
          lang={lang}
          danger
          busy={busy}
          title={tr(lang, "Скинути MFA?", "Reset MFA?")}
          consequence={tr(lang,
            "Другий фактор буде видалено, і ВСІ активні сеанси користувача завершаться. Користувач зареєструє новий застосунок під час наступного входу.",
            "The second factor is removed and ALL of the user's active sessions end. They enrol a new authenticator on their next sign-in.")}
          confirmLabel={tr(lang, "Скинути MFA", "Reset MFA")}
          error={actionError ? <ApiErrorView error={actionError} lang={lang} /> : null}
          onCancel={() => { setDialog(null); setActionError(null); }}
          onConfirm={() => act(
            () => resetMfa(dialog.user.sub),
            "MFA скинуто", "MFA reset",
          )}
          testId="reset-mfa-dialog"
        >
          <div className="adm-dialog-person">
            <b>{dialog.user.display_name || dialog.user.email}</b>
            <span className="muted">{dialog.user.email}</span>
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}
