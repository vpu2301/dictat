// TenantSettingsPage.jsx — /tenant/settings. Reads the active tenant via
// GET /tenants/current and saves profile / contact / address / registration
// through PATCH /tenants/{id} (TENANT.md §2.2). Logo upload (§2.3) and an
// on-screen letterhead branding preview (§2.6) live here too.
//
// Management controls are gated: only owner/admin with tenant_admin in the JWT
// may edit (canManageTenant). Everyone else sees the same data read-only.
//
// Chrome is the shared settings surface (SettingsLayout): sticky scroll-spy
// side menu + stacked Section/Row cards, same as /settings and /profile.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../components/UI.jsx";
import { Row, Section, SettingsNav, Toggle, useSettingsSections } from "../components/SettingsLayout.jsx";
import { ApiErrorView } from "../components/ApiErrorView.jsx";
import { Loading } from "../components/DataStates.jsx";
import { useAsync } from "../api/useAsync.js";
import { useClaims } from "../auth/AuthContext.jsx";
import {
  getCurrentTenant, updateTenant, uploadLogo, fetchLogoObjectUrl,
  canManageTenant, isValidSlug,
} from "../api/tenants.js";
import { tr } from "../i18n.js";

// Editable fields grouped into the four form sections. `key` doubles as the DOM
// id the side menu scrolls to. `slug` is validated client-side; `is_active` is a
// toggle handled separately.
const SECTIONS = [
  { key: "profile", icon: "settings", labels: { en: "Profile", uk: "Профіль" }, fields: [
    { k: "display_name", en: "Display name", uk: "Назва для показу",
      hintEn: "Shown across the app and on report letterheads", hintUk: "Показується в застосунку та на бланках звітів" },
    { k: "legal_name",   en: "Legal name",   uk: "Юридична назва",
      hintEn: "Used on signed documents", hintUk: "Використовується на підписаних документах" },
    { k: "slug",         en: "Slug",          uk: "Slug",
      hintEn: "Lowercase letters, digits and hyphens", hintUk: "Малі літери, цифри та дефіси" },
  ]},
  { key: "contact", icon: "inbox", labels: { en: "Contact", uk: "Контакти" }, fields: [
    { k: "contact_email", en: "Email",   uk: "Email", type: "email" },
    { k: "phone_number",  en: "Phone",   uk: "Телефон" },
    { k: "website",       en: "Website", uk: "Вебсайт" },
  ]},
  { key: "address", icon: "home", labels: { en: "Address", uk: "Адреса" }, fields: [
    { k: "address_line1",   en: "Address line 1", uk: "Адреса, рядок 1" },
    { k: "address_line2",   en: "Address line 2", uk: "Адреса, рядок 2" },
    { k: "postal_code",     en: "Postal code",    uk: "Індекс" },
    { k: "city",            en: "City",           uk: "Місто" },
    { k: "state_or_region", en: "State / region", uk: "Область / регіон" },
    { k: "country",         en: "Country",        uk: "Країна" },
  ]},
  { key: "registration", icon: "tag", labels: { en: "Registration", uk: "Реєстрація" }, fields: [
    { k: "tax_id",              en: "Tax ID",              uk: "Податковий номер" },
    { k: "registration_number", en: "Registration number", uk: "Реєстраційний номер" },
  ]},
];

// Side-menu entries: the form sections plus the two non-form ones.
const NAV = [
  ...SECTIONS.map((s) => ({ id: s.key, icon: s.icon, uk: s.labels.uk, en: s.labels.en })),
  { id: "branding", icon: "scan", uk: "Бренд", en: "Branding" },
  { id: "meta",     icon: "help", uk: "Технічні дані", en: "Technical details" },
];

const EDITABLE_KEYS = SECTIONS.flatMap((s) => s.fields.map((f) => f.k));

function seedForm(t) {
  const f = {};
  for (const k of EDITABLE_KEYS) f[k] = t[k] ?? "";
  f.is_active = !!t.is_active;
  return f;
}

export function TenantSettingsPage({ lang = "en", onToast }) {
  const claims = useClaims();
  const req = useAsync(() => getCurrentTenant(), [claims?.tid]);
  const tenant = req.data;
  const canManage = tenant ? canManageTenant(claims, tenant.my_role) : false;

  if (req.loading) return <div className="page"><Loading lang={lang} /></div>;
  if (req.error)   return <div className="page"><ApiErrorView error={req.error} lang={lang} /></div>;
  if (!tenant)     return <div className="page"><ApiErrorView error={{ status: 404, problem: { title: "No active clinic" } }} lang={lang} /></div>;

  return (
    <TenantSettingsForm
      key={tenant.id}
      tenant={tenant}
      canManage={canManage}
      lang={lang}
      onToast={onToast}
      onSaved={(updated) => req.setData(updated)}
    />
  );
}

function TenantSettingsForm({ tenant, canManage, lang, onToast, onSaved }) {
  const [form, setForm] = useState(() => seedForm(tenant));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [slugErr, setSlugErr] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const { active, jump } = useSettingsSections(NAV);

  // Only send fields whose value actually changed (PATCH is partial).
  const patch = useMemo(() => {
    const out = {};
    for (const k of EDITABLE_KEYS) if ((form[k] ?? "") !== (tenant[k] ?? "")) out[k] = form[k];
    if (!!form.is_active !== !!tenant.is_active) out.is_active = form.is_active;
    return out;
  }, [form, tenant]);
  const dirty = Object.keys(patch).length > 0;

  const onSave = async (e) => {
    e.preventDefault();
    setError(null); setSlugErr(null);
    if (form.slug && !isValidSlug(form.slug)) {
      setSlugErr(tr(lang, "Лише малі літери, цифри та дефіси", "Lowercase letters, digits and hyphens only"));
      return;
    }
    setSaving(true);
    try {
      const updated = await updateTenant(tenant.id, patch);
      onSaved(updated);
      if (onToast) onToast(tr(lang, "Зміни збережено", "Changes saved"));
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  const L = (uk, en) => tr(lang, uk, en);

  return (
    <div className="page settings-page tenant-settings">
      <div className="page-h">
        <div>
          <h1>{L("Налаштування клініки", "Clinic settings")}</h1>
          <p className="muted">
            {tenant.display_name}
            {tenant.status && <span className={"chip " + (tenant.is_active ? "chip-ok" : "chip-warn")} style={{ marginLeft: 8 }}>{tenant.status}</span>}
          </p>
        </div>
      </div>

      {!canManage && (
        <div className="tenant-readonly-note">
          <Icon name="eye" size={14} />
          <span>{L("Лише для перегляду. Керувати клінікою можуть власник або адміністратор.", "Read-only. Only an owner or admin can manage this clinic.")}</span>
        </div>
      )}
      {error && <ApiErrorView error={error} lang={lang} />}

      <div className="settings-layout">
        <SettingsNav
          sections={NAV.map((s) => ({ id: s.id, icon: s.icon, label: L(s.uk, s.en) }))}
          active={active}
          onJump={jump}
          label={L("Розділи налаштувань", "Settings sections")}
        />

        <div className="settings-main">
          <form onSubmit={onSave}>
            {SECTIONS.map((section) => (
              <Section
                key={section.key}
                id={section.key}
                icon={section.icon}
                title={L(section.labels.uk, section.labels.en)}
              >
                {section.fields.map((f) => (
                  <Row
                    key={f.k}
                    label={L(f.uk, f.en)}
                    hint={f.k === "slug" && slugErr
                      ? <span className="field-error">{slugErr}</span>
                      : (f.hintEn ? L(f.hintUk, f.hintEn) : undefined)}
                  >
                    <input
                      type={f.type || "text"}
                      value={form[f.k]}
                      onChange={(e) => set(f.k, e.target.value)}
                      disabled={!canManage || saving}
                      placeholder={canManage ? "—" : ""}
                    />
                  </Row>
                ))}
                {section.key === "profile" && (
                  <Row
                    label={L("Активна", "Active")}
                    hint={L("Вимкнення переводить клініку у стан «suspended».", "Turning off suspends the clinic.")}
                  >
                    <Toggle
                      on={form.is_active}
                      onChange={(v) => set("is_active", v)}
                      disabled={!canManage || saving}
                      label={L("Активна", "Active")}
                    />
                  </Row>
                )}
              </Section>
            ))}

            <Section id="branding" icon="scan" title={L("Бренд", "Branding")}>
              <LogoCard tenant={tenant} canManage={canManage} lang={lang} onToast={onToast} onSaved={onSaved} />
              <BrandingPreview form={form} tenant={tenant} lang={lang} />
            </Section>

            <Section id="meta" icon="help" title={L("Технічні дані", "Technical details")}>
              <Row label="name"><code className="tenant-meta-code">{tenant.name}</code></Row>
              <Row label={L("Створено", "Created")}><code className="tenant-meta-code">{tenant.created_at || "—"}</code></Row>
              <Row label={L("Оновлено", "Updated")}><code className="tenant-meta-code">{tenant.updated_at || "—"}</code></Row>
            </Section>

            {canManage && (
              <div className="tenant-save-bar">
                {dirty && !saving && <span className="muted">{L("Незбережені зміни", "Unsaved changes")}</span>}
                <button type="submit" className="btn accent" disabled={saving || !dirty}>
                  {saving ? L("Збереження…", "Saving…") : L("Зберегти зміни", "Save changes")}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Logo upload + preview (TENANT.md §2.3) ───────────────────────────────────
function LogoCard({ tenant, canManage, lang, onToast, onSaved }) {
  const [objUrl, setObjUrl] = useState(null);
  const [urlInput, setUrlInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  // Prefer the stored bytes (authed fetch → object URL) when has_logo; otherwise
  // fall back to an external logo_url. Revoke the object URL on cleanup.
  useEffect(() => {
    let url = null, cancelled = false;
    (async () => {
      if (tenant.has_logo) {
        url = await fetchLogoObjectUrl(tenant.id);
        if (!cancelled) setObjUrl(url);
      } else {
        setObjUrl(null);
      }
    })();
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [tenant.id, tenant.has_logo, tenant.updated_at]);

  const preview = objUrl || tenant.logo_url || null;

  const doUpload = async (payload, okMsg) => {
    setBusy(true); setError(null);
    try {
      const updated = await uploadLogo(tenant.id, payload);
      onSaved(updated);
      if (onToast) onToast(okMsg);
    } catch (err) {
      if (err.status === 413) setError({ status: 413, problem: { title: tr(lang, "Файл завеликий (макс. 2 МБ)", "File too large (max 2 MB)") } });
      else if (err.status === 422) setError({ status: 422, problem: { title: tr(lang, "Потрібне зображення або URL", "Provide an image file or a URL") } });
      else setError(err);
    } finally { setBusy(false); }
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError({ status: 413, problem: { title: tr(lang, "Файл завеликий (макс. 2 МБ)", "File too large (max 2 MB)") } });
      e.target.value = "";
      return;
    }
    doUpload({ file }, tr(lang, "Логотип оновлено", "Logo updated"));
    e.target.value = "";
  };

  const onUseUrl = () => {
    const u = urlInput.trim();
    if (!u) return;
    doUpload({ logo_url: u }, tr(lang, "Логотип оновлено", "Logo updated")).then(() => setUrlInput(""));
  };

  // Rendered as rows inside the Branding section, not as its own card.
  return (
    <>
      <div className="settings-row tenant-logo-row">
        <div>
          <div className="settings-row-label">{tr(lang, "Логотип", "Logo")}</div>
          <div className="settings-row-hint">{tr(lang, "PNG/JPG, до 2 МБ. Друкується на бланку звітів.", "PNG/JPG, up to 2 MB. Printed on report letterheads.")}</div>
        </div>
        <div className="settings-row-control tenant-logo-control">
          <div className="tenant-logo-preview">
            {preview
              ? <img src={preview} alt={tenant.display_name} />
              : <span className="tsw-logo-fallback tenant-logo-fallback">{(tenant.display_name || "?").charAt(0).toUpperCase()}</span>}
          </div>
          {canManage && (
            <div className="tenant-logo-actions">
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
              <button type="button" className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>
                <Icon name="download" size={13} /> {tr(lang, "Завантажити файл", "Upload file")}
              </button>
              <div className="tenant-logo-url">
                <input
                  type="url"
                  placeholder="https://cdn.example/logo.png"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  disabled={busy}
                />
                <button type="button" className="btn btn-ghost" onClick={onUseUrl} disabled={busy || !urlInput.trim()}>
                  {tr(lang, "URL", "Use URL")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {error && <div className="tenant-logo-error"><ApiErrorView error={error} lang={lang} /></div>}
    </>
  );
}

// ── On-screen letterhead (TENANT.md §2.6) — live from the current form ───────
function BrandingPreview({ form, tenant, lang }) {
  const addr = [form.address_line1, form.address_line2, form.postal_code, form.city, form.state_or_region, form.country]
    .map((s) => (s || "").trim()).filter(Boolean).join(", ");
  const contact = [form.phone_number, form.contact_email, form.website].map((s) => (s || "").trim()).filter(Boolean).join(" · ");
  return (
    <div className="settings-row tenant-letterhead-row">
      <div>
        <div className="settings-row-label">{tr(lang, "Бланк (превʼю)", "Letterhead preview")}</div>
        <div className="settings-row-hint">
          {tr(lang, "Оновлюється з полів вище. PDF-звіти друкують ці дані автоматично.", "Follows the fields above. Report PDFs print these details automatically.")}
        </div>
      </div>
      <div className="settings-row-control">
        <div className="tenant-letterhead">
          <div className="tenant-letterhead-name">{form.legal_name || form.display_name || tenant.name}</div>
          {form.display_name && form.legal_name && form.display_name !== form.legal_name && (
            <div className="tenant-letterhead-sub">{form.display_name}</div>
          )}
          {addr && <div className="tenant-letterhead-line">{addr}</div>}
          {contact && <div className="tenant-letterhead-line">{contact}</div>}
        </div>
      </div>
    </div>
  );
}
