// ProfilePage.jsx — /profile. The user-facing profile surface.
//
// Today it renders the real identity we already have (display name, email,
// roles, clinic/tenant, MFA, last login from the verified token + DB row).
// Everything that needs a backend we don't have yet — editing fields, photo
// upload, e-signature setup, password/2FA management, sessions, account
// deactivation — is scaffolded here and clearly marked "Coming soon" so the
// layout and wiring are ready when those endpoints land.
//
// The technical token/claims inspector lives separately at /me.
import React, { useEffect, useState } from "react";
import { Icon, Empty } from "../components/UI.jsx";
import { ApiErrorView } from "../components/ApiErrorView.jsx";
import { me as apiMe } from "../api/endpoints.js";
import { useAuth } from "../auth/AuthContext.jsx";

// Friendly, bilingual role labels (roles arrive as raw slugs).
const ROLE_LABELS = {
  clinician:    ["Лікар", "Clinician"],
  tenant_admin: ["Адміністратор клініки", "Clinic admin"],
  auditor:      ["Аудитор", "Auditor"],
  nurse:        ["Медсестра", "Nurse"],
};

function initialsOf(name, email) {
  const src = (name || email || "?").trim();
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  const a = parts[0]?.[0] || src[0] || "?";
  const b = parts.length > 1 ? parts[1][0] : "";
  return (a + b).toUpperCase();
}

export function ProfilePage({ lang = "en", navigate }) {
  const T = (uk, en) => (lang === "uk" ? uk : en);
  const { state, setState } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = async () => {
    setLoading(true); setError(null);
    try {
      const body = await apiMe();
      setState({ claims: body.claims, dbUser: body.db_user });
    } catch (e) { setError(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (!state) refresh(); /* eslint-disable-line */ }, []);

  if (!state) {
    return (
      <div className="page">
        {error ? <ApiErrorView error={error} lang={lang} /> : <Empty icon="user" title={T("Завантаження…", "Loading…")} />}
      </div>
    );
  }

  const c = state.claims || {};
  const u = state.dbUser || {};
  const name = u.display_name || c.sub || T("Без імені", "Unnamed");
  const email = u.email || "";
  const roles = c.roles || (u.role ? [u.role] : []);
  const go = (path) => (navigate ? navigate(path) : (window.location.hash = path));

  return (
    <div className="page profile-page">
      <div className="page-h">
        <div>
          <h1>{T("Профіль", "Profile")}</h1>
          <p className="muted">{T("Ваш обліковий запис та персональні дані.", "Your account and personal details.")}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={refresh} disabled={loading}>
            <Icon name="refresh" size={13} />
            <span>{T("Оновити", "Refresh")}</span>
          </button>
        </div>
      </div>

      {error && <ApiErrorView error={error} lang={lang} />}

      {/* ── Hero: avatar + identity ─────────────────────────────────── */}
      <section className="card profile-hero">
        <div className="profile-avatar-lg">{initialsOf(name, email)}</div>
        <div className="profile-id">
          <div className="profile-id-name">{name}</div>
          {email && <div className="profile-id-email">{email}</div>}
          <div className="profile-id-roles">
            {roles.length
              ? roles.map((r) => (
                  <span key={r} className="chip">{ROLE_LABELS[r] ? T(ROLE_LABELS[r][0], ROLE_LABELS[r][1]) : r}</span>
                ))
              : <span className="muted">{T("Роль не призначено", "No role assigned")}</span>}
            <span className={"chip " + (c.mfa ? "chip-ok" : "chip-warn")}>MFA {c.mfa ? "on" : "off"}</span>
          </div>
        </div>
        <button className="btn ghost sm" disabled>
          <Icon name="user" size={13} /> {T("Змінити фото", "Change photo")} <SoonPill lang={lang} />
        </button>
      </section>

      {/* ── Personal information ────────────────────────────────────── */}
      <Section icon="user" title={T("Особисті дані", "Personal information")}
        action={<button className="btn ghost sm" disabled>{T("Редагувати", "Edit")} <SoonPill lang={lang} /></button>}>
        <InfoRow label={T("Імʼя", "Display name")} value={name} />
        <InfoRow label="Email" value={email} />
        <InfoRow label={T("Телефон", "Phone")} value={u.phone} soon lang={lang} />
        <InfoRow label={T("Посада / спеціальність", "Title / specialty")} value={u.specialty} soon lang={lang} />
        <InfoRow label={T("Номер ліцензії", "License number")} value={u.license_no} soon lang={lang} />
      </Section>

      {/* ── Clinic / organization ──────────────────────────────────── */}
      <Section icon="users" title={T("Клініка та роль", "Clinic & role")}>
        <InfoRow label={T("Клініка (tenant)", "Clinic (tenant)")} value={c.tid} mono />
        <InfoRow label={T("Ролі", "Roles")}
          value={roles.map((r) => (ROLE_LABELS[r] ? T(ROLE_LABELS[r][0], ROLE_LABELS[r][1]) : r)).join(", ")} />
        <InfoRow label={T("Відділення", "Department")} value={u.department} soon lang={lang} />
      </Section>

      {/* ── E-signature (clinician report signing) ─────────────────── */}
      <Section icon="sign" title={T("Електронний підпис", "E-signature")}>
        <Row label={T("Підпис для звітів", "Signature for reports")}
          hint={T("Налаштуйте підпис, який додається до підписаних звітів.", "Set up the signature applied to signed reports.")}>
          <button className="btn ghost sm" disabled>{T("Налаштувати", "Set up")} <SoonPill lang={lang} /></button>
        </Row>
      </Section>

      {/* ── Security ───────────────────────────────────────────────── */}
      <Section icon="shield" title={T("Безпека", "Security")}>
        <InfoRow label={T("Останній вхід", "Last login")} value={u.last_login_at} mono />
        <Row label={T("Пароль", "Password")} hint={T("Змінити пароль облікового запису", "Change your account password")}>
          <button className="btn ghost sm" disabled>{T("Змінити", "Change")} <SoonPill lang={lang} /></button>
        </Row>
        <Row label={T("Двофакторна автентифікація", "Two-factor authentication")}
          hint={c.mfa ? T("Увімкнено", "Enabled") : T("Вимкнено", "Disabled")}>
          <button className="btn ghost sm" disabled>{T("Керувати", "Manage")} <SoonPill lang={lang} /></button>
        </Row>
        <Row label={T("Активні сеанси", "Active sessions")} hint={T("Вийти на всіх пристроях", "Sign out everywhere")}>
          <button className="btn ghost sm" disabled>{T("Переглянути", "Review")} <SoonPill lang={lang} /></button>
        </Row>
      </Section>

      {/* ── Preferences (real links into Settings) ─────────────────── */}
      <Section icon="sliders" title={T("Налаштування", "Preferences")}>
        <Row label={T("Сповіщення", "Notifications")} hint={T("Email та нагадування", "Email and reminders")}>
          <button className="btn ghost sm" onClick={() => go("/settings")}>{T("Відкрити", "Open")} <Icon name="chevRight" size={12} /></button>
        </Row>
        <Row label={T("Мова та вигляд", "Language & appearance")} hint={T("Тема, мова, диктування", "Theme, language, dictation")}>
          <button className="btn ghost sm" onClick={() => go("/settings")}>{T("Відкрити", "Open")} <Icon name="chevRight" size={12} /></button>
        </Row>
        <Row label={T("Технічна ідентичність", "Technical identity")} hint={T("Токен, claims, сирий JSON", "Token, claims, raw JSON")}>
          <button className="btn ghost sm" onClick={() => go("/me")}>{T("Переглянути", "View")} <Icon name="chevRight" size={12} /></button>
        </Row>
      </Section>

      {/* ── Danger zone ────────────────────────────────────────────── */}
      <section className="card settings-card profile-danger">
        <header className="settings-card-h">
          <Icon name="flag" size={14} />
          <h2>{T("Небезпечна зона", "Danger zone")}</h2>
        </header>
        <div className="settings-card-body">
          <Row label={T("Деактивувати акаунт", "Deactivate account")}
            hint={T("Тимчасово вимкнути доступ до облікового запису.", "Temporarily disable access to your account.")}>
            <button className="btn danger sm" disabled>{T("Деактивувати", "Deactivate")} <SoonPill lang={lang} /></button>
          </Row>
        </div>
      </section>
    </div>
  );
}

// ── Primitives ────────────────────────────────────────────────────────────────
function SoonPill({ lang }) {
  return <span className="soon-pill">{lang === "uk" ? "Незабаром" : "Coming soon"}</span>;
}

function Section({ icon, title, action, children }) {
  return (
    <section className="card settings-card">
      <header className="settings-card-h">
        <Icon name={icon} size={14} />
        <h2>{title}</h2>
        {action && <div className="settings-card-h-action">{action}</div>}
      </header>
      <div className="settings-card-body">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }) {
  return (
    <div className="settings-row">
      <div>
        <div className="settings-row-label">{label}</div>
        {hint && <div className="settings-row-hint">{hint}</div>}
      </div>
      <div className="settings-row-control">{children}</div>
    </div>
  );
}

// A read-only field; when `soon` and empty, it shows a Coming-soon affordance.
function InfoRow({ label, value, mono, soon, lang }) {
  return (
    <div className="settings-row">
      <div className="settings-row-label">{label}</div>
      <div className="settings-row-control">
        {value
          ? <span className="profile-value" style={{ fontFamily: mono ? "var(--mono)" : "inherit" }}>{value}</span>
          : soon
            ? <SoonPill lang={lang} />
            : <span className="muted">—</span>}
      </div>
    </div>
  );
}
