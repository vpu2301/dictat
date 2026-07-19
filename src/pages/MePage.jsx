// MePage.jsx — /me. Renders verified claims + DB user row.
import React, { useEffect, useState } from "react";
import { Icon, Empty } from "../components/UI.jsx";
import { ApiErrorView } from "../components/ApiErrorView.jsx";
import { JsonViewer } from "../components/JsonViewer.jsx";
import { me as apiMe } from "../api/endpoints.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { tr } from "../i18n.js";

function Field({ label, value, mono, copyable }) {
  const copy = () => { try { navigator.clipboard.writeText(String(value)); } catch {} };
  return (
    <div className="me-field">
      <div className="me-field-label">{label}</div>
      <div className="me-field-value" style={{ fontFamily: mono ? "var(--mono)" : "inherit" }}>
        {value || <span className="muted">—</span>}
        {copyable && value && (
          <button className="icon-btn" onClick={copy} title="Copy" style={{ marginLeft: 6 }}>
            <Icon name="download" size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

export function MePage({ lang = "en" }) {
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
        {error ? <ApiErrorView error={error} lang={lang} /> : <Empty icon="user" title={tr(lang, "Завантаження…", "Loading…")} />}
      </div>
    );
  }

  const c = state.claims;
  const u = state.dbUser;

  return (
    <div className="page me-page">
      <div className="page-h">
        <div>
          <h1>{tr(lang, "Профіль", "My profile")}</h1>
          <p className="muted">{tr(lang, "Дані з підписаного токена.", "What the verified token says.")}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={refresh} disabled={loading}>
            <Icon name="refresh" size={13} />
            <span>{tr(lang, "Оновити", "Refresh")}</span>
          </button>
        </div>
      </div>

      {error && <ApiErrorView error={error} lang={lang} />}

      <section className="card me-section">
        <header className="me-section-h">
          <Icon name="shield" size={14} />
          <h2>{tr(lang, "Токен", "Token claims")}</h2>
          <span className={"chip " + (c.mfa ? "chip-ok" : "chip-warn")}>
            MFA {c.mfa ? "on" : "off"}
          </span>
        </header>
        <div className="me-grid">
          <Field label="sub" value={c.sub} mono copyable />
          <Field label="tid" value={c.tid} mono copyable />
          <Field label="scope" value={c.scope} mono />
          <Field label="iss" value={c.iss} mono />
        </div>
        <div className="me-roles">
          <span className="me-field-label">{tr(lang, "Ролі", "Roles")}</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(c.roles || []).map((r) => <span key={r} className="chip">{r}</span>)}
          </div>
        </div>
      </section>

      <section className="card me-section">
        <header className="me-section-h">
          <Icon name="user" size={14} />
          <h2>{tr(lang, "Профіль у БД", "DB profile")}</h2>
        </header>
        {u ? (
          <div className="me-grid">
            <Field label={tr(lang, "Email", "Email")} value={u.email} copyable />
            <Field label={tr(lang, "Імʼя", "Display name")} value={u.display_name} />
            <Field label={tr(lang, "Роль", "Role")} value={u.role} />
            <Field label={tr(lang, "Статус", "Status")} value={u.status} />
            <Field label="MFA enrolled" value={u.mfa_enrolled_at} mono />
            <Field label="Last login" value={u.last_login_at} mono />
          </div>
        ) : (
          <div className="me-empty">
            <Icon name="help" size={20} />
            <div>
              <strong>{tr(lang, "Профіль ще не синхронізовано", "Profile not synced yet")}</strong>
              <p className="muted">
                {tr(lang, "Цей користувач існує тільки в Keycloak. Запис у локальній БД зʼявиться після першого входу.", "This user exists in Keycloak only. The local DB row appears after the first sync.")}
              </p>
            </div>
          </div>
        )}
      </section>

      <details className="card me-section">
        <summary style={{ cursor: "pointer", padding: "12px 16px", fontWeight: 500 }}>
          {tr(lang, "Сирий JSON", "Raw JSON")}
        </summary>
        <div style={{ padding: "0 16px 16px" }}>
          <JsonViewer value={state} />
        </div>
      </details>
    </div>
  );
}
