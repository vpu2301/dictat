// TenantsTab.jsx — the cross-tenant portfolio: every tenant this owner belongs
// to, with its full profile and member roster.
//
// This is the one genuinely cross-tenant surface the backend offers: auth-service
// serves GET /tenants, /tenants/{id} and /tenants/{id}/members off its writer
// pool behind an explicit membership check, so they resolve for tenants other
// than the token's. Anything the token cannot reach is labelled, not faked.
import React, { useMemo, useState } from "react";
import { useAsync } from "../../api/useAsync.js";
import { Panel, PanelState } from "../../components/dashboard/Panel.jsx";
import { StatusBadge } from "../../components/dashboard/StatusBadge.jsx";
import { Icon, Modal } from "../../components/UI.jsx";
import { ApiErrorView } from "../../components/ApiErrorView.jsx";
import { tr } from "../../i18n.js";
import { fetchTenantPortfolio, portfolioSummary } from "../../api/company.js";
import { createTenant, isValidSlug } from "../../api/tenants.js";
import { TenantAdmin } from "./TenantAdmin.jsx";

export function TenantsTab({ lang, activeTid }) {
  const T = (uk, en) => tr(lang, uk, en);
  const req = useAsync(() => fetchTenantPortfolio(activeTid), [activeTid]);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  const summary = useMemo(() => (req.data ? portfolioSummary(req.data) : null), [req.data]);

  const rows = useMemo(() => {
    const all = req.data?.tenants || [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((t) =>
      [t.name, t.display_name, t.slug, t.detail?.city, t.detail?.country,
       t.detail?.contact_email, t.detail?.legal_name, t.detail?.tax_id]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
      || t.members.some((m) => String(m.email || "").toLowerCase().includes(q)),
    );
  }, [req.data, query]);

  return (
    <div className="co-stack">
      <Panel
        title={T("Тенанти", "Tenants")}
        icon="building"
        sub={summary ? `${summary.tenants} · ${summary.people} ${T("осіб", "people")}` : undefined}
        gapNote={req.data?.capped
          ? T(`Показано перші ${req.data.cap} із ${req.data.total} — деталі не завантажувалися для решти.`,
              `Showing the first ${req.data.cap} of ${req.data.total} — details were not fetched for the rest.`)
          : undefined}
      >
        {(req.loading || req.error) ? (
          <PanelState loading={req.loading} error={req.error} onRetry={req.reload} lang={lang} />
        ) : !req.data.tenants.length ? (
          <div className="co-empty">
            {T("Цей акаунт не є учасником жодного тенанта. GET /tenants повернув порожній список.",
               "This account is a member of no tenant. GET /tenants returned an empty list.")}
          </div>
        ) : (
          <>
            <div className="co-toolbar">
              <label className="co-search">
                <Icon name="search" size={14} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={T("Пошук за назвою, містом, ЄДРПОУ, email учасника…",
                                 "Search name, city, tax id, member email…")}
                  aria-label={T("Пошук тенантів", "Search tenants")}
                />
                {query && (
                  <button className="co-search-x" onClick={() => setQuery("")}
                          aria-label={T("Очистити", "Clear")}><Icon name="x" size={12} /></button>
                )}
              </label>
              <span className="co-count">{rows.length} / {req.data.tenants.length}</span>
              <button className="colog-btn primary co-btn-sm" onClick={() => setCreateOpen(true)}>
                <Icon name="plus" size={13} /> {T("Нова клініка", "New clinic")}
              </button>
            </div>

            <div className="co-tablewrap">
              <table className="co-table">
                <thead>
                  <tr>
                    <th />
                    <th>{T("Тенант", "Tenant")}</th>
                    <th>{T("Ваша роль", "Your role")}</th>
                    <th>{T("Учасники", "Members")}</th>
                    <th>{T("Локація", "Location")}</th>
                    <th>{T("Створено", "Created")}</th>
                    <th>{T("Статус", "Status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => {
                    const open = openId === t.id;
                    return (
                      <React.Fragment key={t.id}>
                        <tr className={"co-row" + (t.isActive ? " is-active" : "")}
                            onClick={() => setOpenId(open ? null : t.id)}>
                          <td className="co-row-toggle">
                            <Icon name={open ? "chevDown" : "chevRight"} size={13} />
                          </td>
                          <td>
                            <div className="co-cell-title">{t.display_name || t.name}</div>
                            <div className="co-cell-sub">
                              {t.slug ? <code>{t.slug}</code> : <code className="muted">{String(t.id).slice(0, 8)}</code>}
                              {t.isActive && <em className="co-tenant-you">{T("активний", "active")}</em>}
                            </div>
                          </td>
                          <td><span className="co-rolepill">{t.my_role || "—"}</span></td>
                          <td>
                            {t.membersUnavailable
                              ? <span className="co-na">{T("немає доступу", "no access")}</span>
                              : t.members.length}
                          </td>
                          <td className="co-cell-sub">
                            {[t.detail?.city, t.detail?.country].filter(Boolean).join(", ") || "—"}
                          </td>
                          <td className="co-cell-sub">{fmtDate(t.createdAt)}</td>
                          <td>
                            <StatusBadge status={t.is_active === false ? "deactivated" : (t.status || "active")} />
                          </td>
                        </tr>
                        {open && (
                          <tr className="co-detailrow">
                            <td colSpan={7}>
                              <TenantDetail t={t} lang={lang} onChanged={req.reload} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>

      {summary && (
        <Panel title={T("Ролі по портфелю", "Roles across the portfolio")} icon="users">
          <div className="co-kindrow">
            {Object.entries(summary.roleCounts).sort((a, b) => b[1] - a[1]).map(([role, n]) => (
              <span className="co-kindchip" key={role}><code>{role}</code><b>{n}</b></span>
            ))}
            {!Object.keys(summary.roleCounts).length && (
              <span className="co-na">{T("Немає даних про учасників.", "No member data.")}</span>
            )}
          </div>
        </Panel>
      )}

      {createOpen && (
        <CreateTenantDialog
          lang={lang}
          onClose={() => setCreateOpen(false)}
          onDone={async () => { setCreateOpen(false); await req.reload(); }}
        />
      )}
    </div>
  );
}

function TenantDetail({ t, lang, onChanged }) {
  const T = (uk, en) => tr(lang, uk, en);
  const [tab, setTab] = useState("overview");   // overview | manage
  const d = t.detail;

  if (t.error) {
    return (
      <div className="co-detail">
        <div className="co-detail-err">
          {T("Профіль не завантажився:", "Profile failed to load:")} {t.error.message || String(t.error)}
        </div>
      </div>
    );
  }

  const facts = d ? [
    [T("Юридична назва", "Legal name"), d.legal_name],
    [T("Контактний email", "Contact email"), d.contact_email],
    [T("Телефон", "Phone"), d.phone_number],
    [T("Сайт", "Website"), d.website],
    [T("Адреса", "Address"), [d.address_line1, d.address_line2, d.postal_code, d.city, d.state_or_region, d.country].filter(Boolean).join(", ")],
    [T("Податковий номер", "Tax id"), d.tax_id],
    [T("Реєстраційний номер", "Registration no."), d.registration_number],
    [T("Локаль / часовий пояс", "Locale / timezone"), [d.locale, d.timezone].filter(Boolean).join(" · ")],
    [T("Оновлено", "Updated"), fmtDate(d.updated_at)],
    ["ID", String(t.id)],
  ].filter(([, v]) => v) : [];

  return (
    <div className="co-detail">
      <div className="co-segmented co-detail-tabs" role="tablist">
        <button className={tab === "overview" ? "on" : ""} onClick={() => setTab("overview")}>
          {T("Огляд", "Overview")}
        </button>
        <button className={tab === "manage" ? "on" : ""} onClick={() => setTab("manage")}>
          <Icon name="sliders" size={12} /> {T("Керування", "Manage")}
          {!t.isActive && <Icon name="info" size={11} />}
        </button>
      </div>

      {tab === "manage" ? (
        <TenantAdmin tenant={t} lang={lang} onChanged={onChanged} />
      ) : (
      <>
      <div className="co-detail-grid">
        <div>
          <h4>{T("Профіль", "Profile")}</h4>
          <dl className="co-facts">
            {facts.map(([k, v]) => (
              <React.Fragment key={k}>
                <dt>{k}</dt><dd>{v}</dd>
              </React.Fragment>
            ))}
            {!facts.length && <dd className="co-na">{T("Профіль порожній.", "Profile is empty.")}</dd>}
          </dl>
        </div>
        <div>
          <h4>
            {T("Учасники", "Members")} <span className="co-count">{t.members.length}</span>
          </h4>
          {t.membersUnavailable ? (
            <div className="co-na">
              {T("Реєстр учасників недоступний для цього тенанта.",
                 "The member roster is not readable for this tenant.")}
            </div>
          ) : !t.members.length ? (
            <div className="co-na">{T("Учасників немає.", "No members.")}</div>
          ) : (
            <ul className="co-members">
              {t.members.map((m) => (
                <li key={m.user_sub}>
                  <span className="co-member-name">
                    {m.display_name || m.email || String(m.user_sub).slice(0, 8)}
                  </span>
                  <span className="co-member-mail">{m.email || "—"}</span>
                  <span className="co-rolepill">{m.role}</span>
                  {m.platform_role && <span className="co-rolepill alt">{m.platform_role}</span>}
                  <StatusBadge status={m.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {!t.isActive && (
        <div className="co-detail-note">
          <Icon name="info" size={13} />
          {T("Використання, звіти й аудит цього тенанта недоступні: токен прив'язаний до іншого tid, а перемикання потребує повторної автентифікації.",
             "This tenant's usage, reports and audit are unreachable: the token is bound to a different tid, and switching requires re-authentication.")}
        </div>
      )}
      </>
      )}
    </div>
  );
}

// POST /tenants is the one tenant write NOT gated to the active tenant — the
// caller becomes its owner. Kept minimal: name + display_name are the only
// required fields, and everything else is editable afterwards from Manage.
function CreateTenantDialog({ lang, onClose, onDone }) {
  const T = (uk, en) => tr(lang, uk, en);
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const slugBad = slug !== "" && !isValidSlug(slug);
  const canSubmit = !busy && name.trim().length >= 2 && displayName.trim() && !slugBad;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true); setError(null);
    try {
      const body = { name: name.trim(), display_name: displayName.trim() };
      if (slug) body.slug = slug;
      if (contactEmail) body.contact_email = contactEmail;
      if (city) body.city = city;
      if (country) body.country = country;
      await createTenant(body);
      await onDone();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} className="co-modal">
      <form onSubmit={submit}>
        <header className="co-modal-h">
          <h2>{T("Нова клініка", "New clinic")}</h2>
          <button type="button" className="co-search-x" onClick={onClose} aria-label={T("Закрити", "Close")}>
            <Icon name="x" size={16} />
          </button>
        </header>
        <div className="co-modal-b">
          <p className="co-cell-sub" style={{ marginBottom: 16 }}>
            {T("Ви станете власником нової клініки. Решту профілю можна заповнити згодом у «Керуванні» — але лише коли ваш токен указує саме на неї.",
               "You become the new clinic's owner. The rest of the profile can be filled in later under Manage — but only while your token points at it.")}
          </p>

          <div className="co-formgrid">
            <label className="colog-field">
              <span>{T("Внутрішня назва", "Internal name")}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus
                     disabled={busy} placeholder="kyiv-cardio" minLength={2} />
            </label>
            <label className="colog-field">
              <span>{T("Відображувана назва", "Display name")}</span>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required
                     disabled={busy} placeholder="Kyiv Cardiology Centre" />
            </label>
            <label className="colog-field">
              <span>{T("Slug (необов'язково)", "Slug (optional)")}</span>
              <input value={slug} onChange={(e) => setSlug(e.target.value)} disabled={busy}
                     placeholder="kyiv-cardio" aria-invalid={slugBad || undefined} />
              {slugBad && (
                <em className="co-field-err">
                  {T("Малі літери й цифри через дефіс", "Lowercase alphanumeric with single hyphens")}
                </em>
              )}
            </label>
            <label className="colog-field">
              <span>{T("Контактний email", "Contact email")}</span>
              <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} disabled={busy} />
            </label>
            <label className="colog-field">
              <span>{T("Місто", "City")}</span>
              <input value={city} onChange={(e) => setCity(e.target.value)} disabled={busy} />
            </label>
            <label className="colog-field">
              <span>{T("Країна", "Country")}</span>
              <input value={country} onChange={(e) => setCountry(e.target.value)} disabled={busy} />
            </label>
          </div>

          {error && <ApiErrorView error={error} lang={lang} />}
        </div>

        <footer className="co-modal-f">
          <button type="button" className="colog-btn ghost" onClick={onClose} disabled={busy}>
            {T("Скасувати", "Cancel")}
          </button>
          <button type="submit" className="colog-btn primary" disabled={!canSubmit}>
            {busy ? T("Створення…", "Creating…") : T("Створити клініку", "Create clinic")}
          </button>
        </footer>
      </form>
    </Modal>
  );
}

function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d) ? "—" : d.toLocaleDateString();
}
