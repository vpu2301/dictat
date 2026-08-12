// PeopleTab.jsx — the seat roster as something you can act on, not just count.
//
// The console has always been able to say "31 seats, 4 admins". It could not
// say who has no second factor, who stopped signing in three months ago, or
// fix either. Those are the two questions an owner actually gets asked in a
// security review, and both were already served by auth-service — the answers
// just live on GET /admin/users/{sub}, one request per person, which is why
// nothing had assembled them before (see fetchPeopleDirectory's cap).
//
// Nothing here is mocked. Every write is a real, audited, MFA-gated admin
// action against the ACTIVE tenant:
//
//   invite      POST   /admin/users/invite
//   deactivate  POST   /admin/users/{sub}/deactivate   (also kills sessions)
//   reactivate  POST   /admin/users/{sub}/reactivate
//   roles       PUT    /admin/users/{sub}/roles        (replaces the whole set)
//   reset MFA   DELETE /auth/mfa/{sub}                 (also kills sessions)
//
// The role editor is deliberately blunt about being a blind write: the backend
// collapses a user's role SET to one `role` on read, so the console can show
// you what it collapsed to and nothing more. See the `role-set-write-only` gap.

import React, { useMemo, useState } from "react";
import { useAsync } from "../../api/useAsync.js";
import { Panel, PanelState } from "../../components/dashboard/Panel.jsx";
import { StatCard } from "../../components/dashboard/StatCard.jsx";
import { StatusBadge } from "../../components/dashboard/StatusBadge.jsx";
import { StatusBreakdown } from "../../components/dashboard/StatusBreakdown.jsx";
import { Icon } from "../../components/UI.jsx";
import { ApiErrorView } from "../../components/ApiErrorView.jsx";
import { tr } from "../../i18n.js";
import { Provenance } from "../provenance.jsx";
import { fetchPeopleDirectory } from "../../api/company.js";
import {
  inviteUser, deactivateUser, reactivateUser, setUserRoles, ASSIGNABLE_ROLES,
} from "../../api/endpoints.js";
import { resetMfa } from "../../api/mfa.js";

const FILTERS = [
  { id: "all",      uk: "Усі",              en: "Everyone" },
  { id: "nomfa",    uk: "Без MFA",          en: "No MFA" },
  { id: "dormant",  uk: "Сплячі",           en: "Dormant" },
  { id: "never",    uk: "Жодного входу",    en: "Never signed in" },
  { id: "disabled", uk: "Деактивовані",     en: "Deactivated" },
];

export function PeopleTab({ lang }) {
  const T = (uk, en) => tr(lang, uk, en);
  const req = useAsync(() => fetchPeopleDirectory(), []);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(null);        // sub | "invite"
  const [actionError, setActionError] = useState(null);
  const [notice, setNotice] = useState(null);

  const d = req.data;

  const run = async (key, fn, message) => {
    setBusy(key); setActionError(null); setNotice(null);
    try {
      await fn();
      setNotice(message);
      req.reload();
    } catch (e) {
      setActionError(e);
    } finally {
      setBusy(null);
    }
  };

  const rows = useMemo(() => {
    const people = d?.people || [];
    const needle = q.trim().toLowerCase();
    return people.filter((p) => {
      if (filter === "nomfa" && p.mfa !== "off") return false;
      if (filter === "dormant" && !p.dormant) return false;
      if (filter === "never" && !p.neverSignedIn) return false;
      if (filter === "disabled" && String(p.status).toLowerCase() !== "deactivated") return false;
      if (!needle) return true;
      return `${p.email || ""} ${p.display_name || ""} ${p.role || ""}`.toLowerCase().includes(needle);
    });
  }, [d, filter, q]);

  return (
    <div className="co-stack">
      <div className="co-note">
        <Icon name="info" size={13} />
        <span>
          {T("Люди активного тенанта. Кожна дія тут реальна, записується в аудит і потребує підтвердженого MFA у вашій сесії.",
             "The active tenant's people. Every action here is real, audited, and needs a verified MFA session of your own.")}
          {" "}<Provenance source="live" lang={lang} note="GET /admin/users + /admin/users/{sub}" />
        </span>
      </div>

      <div className="co-kpis">
        <StatCard label={T("Місць", "Seats")} icon="users" accent
                  loading={req.loading} error={req.error} value={d?.total ?? "—"}
                  approx={d?.capped}
                  sublabel={d ? `${d.seats.active} ${T("активних", "active")} · ${d.seats.invited} ${T("запрошених", "invited")}` : undefined}>
          <Provenance source="live" lang={lang} note="GET /admin/users" />
        </StatCard>
        <StatCard label={T("Покриття MFA", "MFA coverage")} icon="shield"
                  loading={req.loading} error={req.error}
                  value={d?.mfa.pct == null ? "—" : `${d.mfa.pct}%`}
                  sublabel={d ? `${d.mfa.on}/${d.mfa.of} ${T("активних", "active")}` : undefined}>
          <Provenance source="derived" lang={lang}
                      note="mfa_enrolled_at from GET /admin/users/{sub}, over active users we could read" />
        </StatCard>
        <StatCard label={T("Без другого фактора", "Missing second factor")} icon="alert"
                  loading={req.loading} error={req.error} value={d?.mfa.off ?? "—"}
                  sublabel={d?.mfa.off ? T("кожен — один вкрадений пароль", "each is one stolen password") : T("чисто", "clear")}>
          <Provenance source="derived" lang={lang} note="active users with no mfa_enrolled_at" />
        </StatCard>
        <StatCard label={T(`Сплячі > ${d?.dormantDays ?? 30}д`, `Dormant > ${d?.dormantDays ?? 30}d`)} icon="clock"
                  loading={req.loading} error={req.error} value={d?.dormant.length ?? "—"}
                  sublabel={d ? `+${d.neverSignedIn.length} ${T("жодного входу", "never signed in")}` : undefined}>
          <Provenance source="derived" lang={lang} note="last_login_at from GET /admin/users/{sub}" />
        </StatCard>
      </div>

      {d?.capped && (
        <div className="co-note">
          <Icon name="alert" size={13} />
          <span>
            {T(`Детальні дані прочитано лише для перших ${d.detailCap} осіб — решта показана як «невідомо», а не як «без MFA». Причина: mfa_enrolled_at і last_login_at існують тільки в GET /admin/users/{sub}.`,
               `Detail was read for the first ${d.detailCap} people only — the rest show as "unknown", not as "no MFA". Reason: mfa_enrolled_at and last_login_at exist only on GET /admin/users/{sub}.`)}
          </span>
        </div>
      )}

      <InviteForm lang={lang} busy={busy === "invite"}
                  onInvite={(body) => run("invite", () => inviteUser(body),
                    T("Запрошення надіслано", "Invitation sent"))} />

      {notice && <div className="co-note"><Icon name="check" size={13} /><span>{notice}</span></div>}
      {actionError && (
        <>
          <ApiErrorView error={actionError} lang={lang} />
          <p className="co-cell-sub">
            {T("403 тут майже завжди означає одне з двох: ваша сесія без підтвердженого MFA, або ваш токен вказує на інший тенант.",
               "A 403 here almost always means one of two things: your session has no verified MFA, or your token is scoped to another tenant.")}
          </p>
        </>
      )}

      <Panel title={T("Люди", "People")} icon="users" sub={`${rows.length}`}>
        <div className="co-toolbar">
          <div className="co-segmented" role="tablist" aria-label={T("Фільтр", "Filter")}>
            {FILTERS.map((f) => (
              <button key={f.id} className={filter === f.id ? "on" : ""} aria-pressed={filter === f.id}
                      onClick={() => setFilter(f.id)}>
                {T(f.uk, f.en)}
                {f.id === "nomfa" && d?.mfa.off ? ` (${d.mfa.off})` : ""}
                {f.id === "dormant" && d?.dormant.length ? ` (${d.dormant.length})` : ""}
              </button>
            ))}
          </div>
          <div className="co-search">
            <Icon name="search" size={13} />
            <input value={q} onChange={(e) => setQ(e.target.value)}
                   placeholder={T("email, ім'я або роль", "email, name or role")}
                   aria-label={T("Пошук людей", "Search people")} />
            {q && <button className="co-search-x" onClick={() => setQ("")} aria-label={T("Очистити", "Clear")}>
              <Icon name="x" size={12} />
            </button>}
          </div>
        </div>

        {(req.loading || req.error) ? (
          <PanelState loading={req.loading} error={req.error} onRetry={req.reload} lang={lang} />
        ) : !rows.length ? (
          <div className="co-empty">{T("Нікого за цим фільтром.", "Nobody matches this filter.")}</div>
        ) : (
          <div className="co-tablewrap">
            <table className="co-table">
              <thead>
                <tr>
                  <th>{T("Людина", "Person")}</th>
                  <th>{T("Роль", "Role")}</th>
                  <th>{T("Стан", "Status")}</th>
                  <th>MFA</th>
                  <th>{T("Останній вхід", "Last sign-in")}</th>
                  <th>{T("Дії", "Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <PersonRow key={p.sub} p={p} lang={lang} busy={busy === p.sub}
                             onAction={(kind) => {
                               if (kind === "deactivate") {
                                 return run(p.sub, () => deactivateUser(p.sub),
                                   T("Користувача деактивовано, сесії завершено", "User deactivated and sessions revoked"));
                               }
                               if (kind === "reactivate") {
                                 return run(p.sub, () => reactivateUser(p.sub),
                                   T("Користувача відновлено", "User reactivated"));
                               }
                               if (kind === "resetMfa") {
                                 return run(p.sub, () => resetMfa(p.sub),
                                   T("MFA скинуто, сесії завершено", "MFA reset and sessions revoked"));
                               }
                               return undefined;
                             }}
                             onRoles={(roles) => run(p.sub, () => setUserRoles(p.sub, roles),
                               T("Ролі оновлено", "Roles updated"))} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="co-2col">
        <Panel title={T("Розподіл місць", "Seat mix")} icon="grid">
          {(req.loading || req.error || !d) ? (
            <PanelState loading={req.loading} error={req.error} lang={lang} />
          ) : (
            <>
              <StatusBreakdown
                segments={Object.entries(d.seats.byRole).map(([k, n]) => ({ key: k, label: k, count: n }))}
                total={d.total} />
              <ul className="co-worklist">
                <li>{T("Клінічні місця — це те, за що платять; auditor і tenant_admin не диктують.",
                       "Clinical seats are the ones that get paid for; auditor and tenant_admin do not dictate.")}</li>
                <li>{T("Деактивація вимикає вхід на всій платформі, а не лише в цій клініці.",
                       "Deactivation disables sign-in platform-wide, not just in this clinic.")}</li>
              </ul>
            </>
          )}
        </Panel>

        <Panel title={T("Що варто зробити", "Worth doing")} icon="check">
          <ul className="co-worklist">
            <li>
              <strong>{d?.mfa.off ?? "—"}</strong>{" "}
              {T("активних акаунтів без другого фактора. MFA реалізовано — увімкніть його для них.",
                 "active accounts with no second factor. MFA is implemented — get it on them.")}
            </li>
            <li>
              <strong>{d?.dormant.length ?? "—"}</strong>{" "}
              {T("не входили понад період — місце, за яке платять, і поверхня атаки, якою ніхто не користується.",
                 "have not signed in for the whole window — a paid seat and an unused attack surface.")}
            </li>
            <li>
              <strong>{d?.neverSignedIn.length ?? "—"}</strong>{" "}
              {T("жодного разу не входили. Запрошення, яке не прийняли, — це не користувач.",
                 "have never signed in at all. An unaccepted invitation is not a user.")}
            </li>
            <li>
              {T("Скидання MFA завершує всі сесії людини — це навмисно: інакше старий телефон лишався б чинним.",
                 "Resetting MFA ends every session that person holds — deliberately: otherwise the old phone stays valid.")}
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function PersonRow({ p, lang, busy, onAction, onRoles }) {
  const T = (uk, en) => tr(lang, uk, en);
  const [editing, setEditing] = useState(false);
  const status = String(p.status || "").toLowerCase();
  const disabled = status === "deactivated";

  return (
    <>
      <tr className={busy ? "co-dirty" : ""}>
        <td>
          <div className="co-cell-title">{p.display_name || "—"}</div>
          <div className="co-cell-sub">{p.email || <code>{String(p.sub).slice(0, 8)}</code>}</div>
        </td>
        <td><span className="co-rolepill">{p.role || "—"}</span></td>
        <td><StatusBadge status={p.status} /></td>
        <td>
          {p.mfa === "on" ? <StatusBadge tone="ok" label={T("увімкнено", "enrolled")} />
            : p.mfa === "off" ? <StatusBadge tone="warn" label={T("немає", "none")} />
            : <span className="co-cell-sub" title={p.beyondCap
                ? T("Поза межею детального читання", "Beyond the detail-read cap")
                : T("Детальне читання не вдалося", "The detail read failed")}>—</span>}
        </td>
        <td className="co-cell-sub">
          {p.lastLoginAt ? fmtDate(p.lastLoginAt)
            : p.detail ? T("ніколи", "never")
            : "—"}
          {p.dormant && <span className="co-chip">{T("спить", "dormant")}</span>}
        </td>
        <td className="co-rowactions">
          <button className="colog-btn co-btn-sm" disabled={busy} onClick={() => setEditing((v) => !v)}>
            {T("Ролі", "Roles")}
          </button>
          <button className="colog-btn co-btn-sm" disabled={busy || p.mfa !== "on"}
                  title={p.mfa === "on"
                    ? T("Скинути другий фактор — завершує сесії", "Reset the second factor — ends their sessions")
                    : T("Нічого скидати", "Nothing to reset")}
                  onClick={() => onAction("resetMfa")}>
            {T("Скинути MFA", "Reset MFA")}
          </button>
          {disabled ? (
            <button className="colog-btn co-btn-sm" disabled={busy} onClick={() => onAction("reactivate")}>
              {T("Відновити", "Reactivate")}
            </button>
          ) : (
            <button className="colog-btn co-btn-sm" disabled={busy} onClick={() => onAction("deactivate")}>
              {T("Деактивувати", "Deactivate")}
            </button>
          )}
        </td>
      </tr>
      {editing && (
        <tr className="co-detailrow">
          <td colSpan={6}>
            <RoleEditor p={p} lang={lang} busy={busy}
                        onSave={(roles) => { onRoles(roles); setEditing(false); }}
                        onCancel={() => setEditing(false)} />
          </td>
        </tr>
      )}
    </>
  );
}

// The blind-write warning is the point of this component, not a footnote: the
// PUT replaces the entire role set, and the only thing we can read back is the
// value the backend collapsed that set to. Pre-selecting just the collapsed
// role and saving it would silently strip a clinician who also administers.
function RoleEditor({ p, lang, busy, onSave, onCancel }) {
  const T = (uk, en) => tr(lang, uk, en);
  const [roles, setRoles] = useState(() => (p.role ? [p.role] : []));
  const toggle = (r) =>
    setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  return (
    <div className="co-detail">
      <div className="co-detail-note">
        <Icon name="alert" size={14} />
        <span>
          {T("PUT замінює ВЕСЬ набір ролей. Прочитати поточний набір неможливо — бекенд віддає лише згорнуте значення",
             "The PUT replaces the ENTIRE role set. The current set cannot be read — the backend only returns the collapsed value")}
          {" "}<code>{p.role || "—"}</code>.{" "}
          {T("Тому позначте всі ролі, які людина має мати після збереження, а не лише ту, що змінюється.",
             "So tick every role the person should hold after saving, not only the one you are changing.")}
        </span>
      </div>
      <div className="co-checkrow">
        {ASSIGNABLE_ROLES.map((r) => (
          <label className="co-check" key={r}>
            <input type="checkbox" checked={roles.includes(r)} onChange={() => toggle(r)} disabled={busy} />
            <code>{r}</code>
          </label>
        ))}
      </div>
      <div className="co-admin-actions">
        <button className="colog-btn co-btn-sm" onClick={onCancel} disabled={busy}>
          {T("Скасувати", "Cancel")}
        </button>
        <button className="colog-btn primary co-btn-sm" disabled={busy || !roles.length}
                onClick={() => onSave(roles)}>
          {busy ? T("Збереження…", "Saving…") : T("Замінити ролі", "Replace roles")}
        </button>
      </div>
      <p className="co-cell-sub">
        {T("Порожній набір сервер відхилить (422), а зняття останнього tenant_admin — 409.",
           "An empty set is refused (422), and stripping a tenant's last tenant_admin is a 409.")}
      </p>
    </div>
  );
}

function InviteForm({ lang, busy, onInvite }) {
  const T = (uk, en) => tr(lang, uk, en);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("clinician");

  if (!open) {
    return (
      <div className="co-toolbar">
        <button className="colog-btn primary co-btn-sm" onClick={() => setOpen(true)}>
          <Icon name="plus" size={12} /> {T("Запросити людину", "Invite someone")}
        </button>
        <span className="co-cell-sub">
          {T("Створює акаунт у Keycloak і місце в активному тенанті.",
             "Creates a Keycloak account and a seat in the active tenant.")}
        </span>
      </div>
    );
  }

  return (
    <form
      className="co-addmember"
      onSubmit={(e) => {
        e.preventDefault();
        if (!email || !name) return;
        onInvite({ email, display_name: name, role });
        setEmail(""); setName("");
      }}
    >
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy}
             placeholder={T("email", "email")} aria-label={T("Email", "Email")} required />
      <input value={name} onChange={(e) => setName(e.target.value)} disabled={busy}
             placeholder={T("повне ім'я", "full name")} aria-label={T("Ім'я", "Display name")} required />
      <select value={role} onChange={(e) => setRole(e.target.value)} disabled={busy}
              aria-label={T("Роль", "Role")}>
        {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <button type="submit" className="colog-btn primary co-btn-sm" disabled={busy || !email || !name}>
        {busy ? T("Надсилання…", "Sending…") : T("Запросити", "Invite")}
      </button>
      <button type="button" className="colog-btn co-btn-sm" onClick={() => setOpen(false)} disabled={busy}>
        {T("Скасувати", "Cancel")}
      </button>
    </form>
  );
}

function fmtDate(v) {
  const d = new Date(v);
  return isNaN(d) ? "—" : d.toLocaleDateString();
}
