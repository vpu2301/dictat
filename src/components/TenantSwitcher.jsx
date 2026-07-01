// TenantSwitcher.jsx — clinic (tenant) controls. Previously a standalone
// "CLINIC" chip + popover in the sidebar footer; now folded into the account
// drop-up as a "Clinic" section (TENANT.md §2.1) so there is a single menu.
// Lists the tenants the user belongs to (GET /tenants), marks the active one
// (claims.tid), switches via POST /tenants/{id}/switch, and offers clinic
// settings / members / create-clinic.
//
// Pilot limitation: the access token is single-tenant. Switching to a different
// clinic returns a `note` asking the user to re-authenticate before that
// clinic's data (patients/reports) becomes visible — we surface it inline and
// offer a "log in again" action instead of silently pretending the switch took
// effect.
import React, { useState } from "react";
import { Icon, Modal } from "./UI.jsx";
import { useClaims, hasAnyRole } from "../auth/AuthContext.jsx";
import { useAsync } from "../api/useAsync.js";
import { asList } from "./DataStates.jsx";
import { ApiErrorView } from "./ApiErrorView.jsx";
import { listTenants, switchTenant, createTenant, isValidSlug } from "../api/tenants.js";

function LogoTile({ tenant, size = 18 }) {
  const label = tenant.display_name || tenant.name || "?";
  if (tenant.logo_url) {
    return <img className="tsw-logo" src={tenant.logo_url} alt="" width={size} height={size} />;
  }
  return (
    <span className="tsw-logo tsw-logo-fallback" style={{ width: size, height: size }}>
      {label.trim().charAt(0).toUpperCase()}
    </span>
  );
}

// Clinic section for the account drop-up. Renders the clinic switcher list plus
// the settings / members / create actions using the account-menu item styling.
// - onNavigate(path): close the account menu and route (Sidebar wires this).
// - onCreateClinic():  open the create-clinic modal at the Sidebar level so it
//   survives the account menu closing.
export function ClinicMenuSection({ lang = "en", navigate, onToast, onNavigate, onCreateClinic }) {
  const claims = useClaims();
  const [switching, setSwitching] = useState(null); // tenant id in-flight
  const [note, setNote] = useState(null);           // { tenant, note }

  const tenantsReq = useAsync(() => listTenants(), [], { enabled: !!claims });
  const items = asList(tenantsReq.data);
  const activeId = claims?.tid;
  const canCreate = hasAnyRole(claims, ["tenant_admin"]);

  if (!claims) return null;

  const go = (path) => { if (onNavigate) onNavigate(path); else navigate?.(path); };

  const onSelect = async (t) => {
    if (t.id === activeId) return;
    setSwitching(t.id);
    setNote(null);
    try {
      const res = await switchTenant(t.id);
      setNote({ tenant: t, note: res?.note });
    } catch (err) {
      if (onToast) onToast(err?.message || (lang === "uk" ? "Не вдалося перемкнути" : "Switch failed"));
    } finally {
      setSwitching(null);
    }
  };

  return (
    <div className="sb-more-section">
      <div className="sb-more-head">{lang === "uk" ? "Клініка" : "Clinic"}</div>

      {tenantsReq.loading && (
        <div className="muted" style={{ padding: "6px 10px", fontSize: 12 }}>
          {lang === "uk" ? "Завантаження…" : "Loading…"}
        </div>
      )}
      {tenantsReq.error && (
        <div style={{ padding: "4px 8px" }}><ApiErrorView error={tenantsReq.error} lang={lang} /></div>
      )}

      {items.map((t) => {
        const isActive = t.id === activeId;
        return (
          <button
            key={t.id}
            className={"sb-user-menu-item" + (isActive ? " on" : "")}
            role="menuitemradio"
            aria-checked={isActive}
            disabled={switching === t.id}
            onClick={() => onSelect(t)}
            title={t.display_name || t.name}
          >
            <LogoTile tenant={t} />
            <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {t.display_name || t.name}
            </span>
            {switching === t.id
              ? <span className="muted">…</span>
              : isActive && <Icon name="check" size={14} />}
          </button>
        );
      })}

      {note && (
        <div className="tsw-note" role="status">
          <div className="tsw-note-title">
            {lang === "uk"
              ? `Перемкнено на «${note.tenant.display_name || note.tenant.name}»`
              : `Switched to “${note.tenant.display_name || note.tenant.name}”`}
          </div>
          <div className="tsw-note-body">
            {note.note || (lang === "uk"
              ? "Увійдіть знову, щоб отримати токен для цієї клініки перед доступом до її даних."
              : "Re-authenticate to obtain a token scoped to this clinic before accessing its data.")}
          </div>
          <button className="btn btn-primary" onClick={() => go("/login")}>
            {lang === "uk" ? "Увійти знову" : "Log in again"}
          </button>
        </div>
      )}

      <button type="button" className="sb-user-menu-item" role="menuitem" onClick={() => go("/tenant/settings")}>
        <Icon name="settings" size={14} />
        <span>{lang === "uk" ? "Налаштування клініки" : "Clinic settings"}</span>
      </button>
      <button type="button" className="sb-user-menu-item" role="menuitem" onClick={() => go("/tenant/members")}>
        <Icon name="users" size={14} />
        <span>{lang === "uk" ? "Учасники" : "Members"}</span>
      </button>
      {canCreate && (
        <button type="button" className="sb-user-menu-item" role="menuitem" onClick={() => onCreateClinic && onCreateClinic()}>
          <Icon name="plus" size={14} />
          <span>{lang === "uk" ? "Створити клініку" : "Create clinic"}</span>
        </button>
      )}
    </div>
  );
}

// POST /tenants — only `name` + `display_name` are required; the rest default
// to "". Caller becomes owner. Gated to tenant_admin by the parent.
export function CreateClinicModal({ lang = "en", onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", display_name: "", slug: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [slugErr, setSlugErr] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null); setSlugErr(null);
    const slug = form.slug.trim();
    if (slug && !isValidSlug(slug)) {
      setSlugErr(lang === "uk" ? "Лише малі літери, цифри та дефіси" : "Lowercase letters, digits and hyphens only");
      return;
    }
    setSubmitting(true);
    try {
      const body = { name: form.name.trim(), display_name: form.display_name.trim() };
      if (slug) body.slug = slug;
      const t = await createTenant(body);
      onCreated(t);
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={() => { if (!submitting) onClose(); }}>
      <form className="admin-form" onSubmit={submit} style={{ minWidth: 320 }}>
        <h3 style={{ margin: "0 0 4px" }}>{lang === "uk" ? "Нова клініка" : "New clinic"}</h3>
        {error && <ApiErrorView error={error} lang={lang} />}
        <label className="admin-field">
          <span>{lang === "uk" ? "Код (name)" : "Name (identifier)"}</span>
          <input value={form.name} onChange={(e) => set("name", e.target.value)}
                 placeholder="kyiv-clinic" required disabled={submitting} />
        </label>
        <label className="admin-field">
          <span>{lang === "uk" ? "Назва для показу" : "Display name"}</span>
          <input value={form.display_name} onChange={(e) => set("display_name", e.target.value)}
                 placeholder="Kyiv Family Clinic" required disabled={submitting} />
        </label>
        <label className="admin-field">
          <span>Slug <span className="muted">({lang === "uk" ? "необовʼязково" : "optional"})</span></span>
          <input value={form.slug} onChange={(e) => set("slug", e.target.value)}
                 placeholder="kyiv-clinic" disabled={submitting} />
          {slugErr && <small className="field-error">{slugErr}</small>}
        </label>
        <div className="admin-form-actions" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            {lang === "uk" ? "Скасувати" : "Cancel"}
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? (lang === "uk" ? "Створення…" : "Creating…") : (lang === "uk" ? "Створити" : "Create")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
