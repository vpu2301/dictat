// TenantAdmin.jsx — the write half of tenant management.
//
// The constraint that shapes this whole file: auth-service gates every tenant
// mutation except creation behind `_require_active_tenant`, which 403s unless
// the target is the tenant in your JWT. So:
//
//   POST   /tenants                        → works for any (creates a new one)
//   PATCH  /tenants/{id}                   → ACTIVE tenant only
//   POST   /tenants/{id}/members           → ACTIVE tenant only
//   PATCH  /tenants/{id}/members/{sub}     → ACTIVE tenant only
//   DELETE /tenants/{id}/members/{sub}     → ACTIVE tenant only
//
// Rather than render buttons that 403, a non-active tenant gets a read-only
// panel that says exactly why and what would change it. Showing a disabled
// control with an honest reason is a better product than a live control that
// fails, and far better than hiding the capability and leaving the owner to
// wonder whether it exists.
import React, { useState } from "react";
import { Icon } from "../../components/UI.jsx";
import { ApiErrorView } from "../../components/ApiErrorView.jsx";
import { StatusBadge } from "../../components/dashboard/StatusBadge.jsx";
import { tr } from "../../i18n.js";
import {
  updateTenant, addMember, updateMember, removeMember, MANAGEMENT_ROLES, isValidSlug,
} from "../../api/tenants.js";

// Editable slice of TenantOut. Kept small on purpose — the backend's TenantUpdate
// is `extra="forbid"`, so sending a field it does not accept 422s the whole PATCH.
const PROFILE_FIELDS = [
  { key: "display_name",   uk: "Відображувана назва", en: "Display name" },
  { key: "legal_name",     uk: "Юридична назва",      en: "Legal name" },
  { key: "slug",           uk: "Slug",                en: "Slug" },
  { key: "contact_email",  uk: "Контактний email",    en: "Contact email" },
  { key: "phone_number",   uk: "Телефон",             en: "Phone" },
  { key: "website",        uk: "Сайт",                en: "Website" },
  { key: "address_line1",  uk: "Адреса",              en: "Address" },
  { key: "city",           uk: "Місто",               en: "City" },
  { key: "country",        uk: "Країна",              en: "Country" },
  { key: "tax_id",         uk: "Податковий номер",    en: "Tax id" },
];

export function TenantAdmin({ tenant, lang, onChanged }) {
  const T = (uk, en) => tr(lang, uk, en);

  if (!tenant.isActive) {
    return (
      <div className="co-admin co-admin-locked">
        <Icon name="info" size={14} />
        <div>
          <strong>{T("Редагування недоступне для цього тенанта", "Editing is unavailable for this tenant")}</strong>
          <p>
            {T("auth-service дозволяє зміни лише для тенанта з вашого токена (_require_active_tenant). Ваш токен вказує на інший, тому профіль і склад учасників тут лише для читання.",
               "auth-service only allows writes against the tenant in your token (_require_active_tenant). Yours points elsewhere, so this tenant's profile and roster are read-only here.")}
          </p>
          <p className="co-cell-sub">
            {T("Що це змінить: платформна роль із крос-тенантним записом, або токен, перевиданий на цей тенант. Див. «Дорожня карта».",
               "What would change it: a platform role with cross-tenant write, or a token re-scoped to this tenant. See the Roadmap tab.")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="co-admin">
      <ProfileEditor tenant={tenant} lang={lang} onChanged={onChanged} />
      <MembersEditor tenant={tenant} lang={lang} onChanged={onChanged} />
    </div>
  );
}

function ProfileEditor({ tenant, lang, onChanged }) {
  const T = (uk, en) => tr(lang, uk, en);
  const d = tenant.detail || {};
  const [draft, setDraft] = useState(() =>
    Object.fromEntries(PROFILE_FIELDS.map((f) => [f.key, d[f.key] ?? ""])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  // Send only what changed — a full-object PATCH would clobber fields the form
  // does not expose, and TenantUpdate forbids unknown keys anyway.
  const patch = Object.fromEntries(
    PROFILE_FIELDS.map((f) => [f.key, draft[f.key]])
      .filter(([k, v]) => v !== (d[k] ?? "")),
  );
  const dirty = Object.keys(patch).length > 0;
  const slugBad = draft.slug !== "" && !isValidSlug(draft.slug);

  const save = async (e) => {
    e.preventDefault();
    if (!dirty || slugBad) return;
    setBusy(true); setError(null); setSaved(false);
    try {
      await updateTenant(tenant.id, patch);
      setSaved(true);
      await onChanged();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="co-admin-block" onSubmit={save}>
      <h4>
        {T("Профіль клініки", "Clinic profile")}
        {dirty && <span className="co-dirty">{T("незбережено", "unsaved")}</span>}
      </h4>
      <div className="co-formgrid">
        {PROFILE_FIELDS.map((f) => (
          <label className="colog-field" key={f.key}>
            <span>{T(f.uk, f.en)}</span>
            <input
              value={draft[f.key]}
              onChange={(e) => { setDraft((p) => ({ ...p, [f.key]: e.target.value })); setSaved(false); }}
              disabled={busy}
              aria-invalid={f.key === "slug" && slugBad ? true : undefined}
            />
            {f.key === "slug" && slugBad && (
              <em className="co-field-err">
                {T("Малі літери й цифри через дефіс, напр. kyiv-clinic", "Lowercase alphanumeric with single hyphens, e.g. kyiv-clinic")}
              </em>
            )}
          </label>
        ))}
      </div>
      {error && <ApiErrorView error={error} lang={lang} />}
      <div className="co-admin-actions">
        {saved && !dirty && <span className="co-saved"><Icon name="check" size={12} /> {T("Збережено", "Saved")}</span>}
        <button type="submit" className="colog-btn primary co-btn-sm" disabled={!dirty || busy || slugBad}>
          {busy ? T("Збереження…", "Saving…") : T("Зберегти зміни", "Save changes")}
        </button>
      </div>
    </form>
  );
}

function MembersEditor({ tenant, lang, onChanged }) {
  const T = (uk, en) => tr(lang, uk, en);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [busy, setBusy] = useState(null);   // null | "add" | sub
  const [error, setError] = useState(null);

  const act = async (key, fn) => {
    setBusy(key); setError(null);
    try { await fn(); await onChanged(); }
    catch (e) { setError(e); }
    finally { setBusy(null); }
  };

  return (
    <div className="co-admin-block">
      <h4>{T("Учасники", "Members")} <span className="co-count">{tenant.members.length}</span></h4>

      <form
        className="co-addmember"
        onSubmit={(e) => { e.preventDefault(); if (email) act("add", async () => { await addMember(tenant.id, { email, role }); setEmail(""); }); }}
      >
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
               placeholder={T("email нового учасника", "new member's email")}
               aria-label={T("Email учасника", "Member email")} disabled={busy === "add"} />
        <select value={role} onChange={(e) => setRole(e.target.value)} disabled={busy === "add"}
                aria-label={T("Роль", "Role")}>
          {MANAGEMENT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <button type="submit" className="colog-btn co-btn-sm" disabled={!email || busy === "add"}>
          <Icon name="plus" size={12} /> {busy === "add" ? T("Додавання…", "Adding…") : T("Додати", "Add")}
        </button>
      </form>
      <p className="co-cell-sub">
        {T("Email має належати наявному користувачу платформи — це прив'язує людину до клініки, а не створює акаунт.",
           "The email must belong to an existing platform user — this links a person to the clinic, it does not create an account.")}
      </p>

      {error && <ApiErrorView error={error} lang={lang} />}

      <ul className="co-members co-members-edit">
        {tenant.members.map((m) => (
          <li key={m.user_sub}>
            <span className="co-member-name">{m.display_name || String(m.user_sub).slice(0, 8)}</span>
            <span className="co-member-mail">{m.email || "—"}</span>
            <select
              value={m.role}
              disabled={busy === m.user_sub}
              aria-label={T("Роль учасника", "Member role")}
              onChange={(e) => act(m.user_sub, () => updateMember(tenant.id, m.user_sub, e.target.value))}
            >
              {MANAGEMENT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <StatusBadge status={m.status} />
            <button
              className="co-search-x"
              disabled={busy === m.user_sub}
              title={T("Прибрати з клініки", "Remove from clinic")}
              aria-label={T("Прибрати учасника", "Remove member")}
              onClick={() => act(m.user_sub, () => removeMember(tenant.id, m.user_sub))}
            >
              <Icon name="x" size={13} />
            </button>
          </li>
        ))}
      </ul>
      <p className="co-cell-sub">
        {T("Останнього власника не можна понизити або прибрати — сервер поверне 409. Це навмисно: клініка без власника некерована.",
           "The last owner cannot be demoted or removed — the server returns 409. That is deliberate: a clinic with no owner is unmanageable.")}
      </p>
    </div>
  );
}
