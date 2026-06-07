// SettingsPage.jsx — Real /settings page. The Tweaks panel stays as a dev tool;
// this is the user-facing settings surface that mirrors many of the same knobs.
import React from "react";
import { Icon } from "../components/UI.jsx";

function Section({ icon, title, children }) {
  return (
    <section className="card settings-card">
      <header className="settings-card-h">
        <Icon name={icon} size={14} />
        <h2>{title}</h2>
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

export function SettingsPage({ lang = "en", tweaks, setTweak }) {
  return (
    <div className="page settings-page">
      <div className="page-h">
        <div>
          <h1>{lang === "uk" ? "Налаштування" : "Settings"}</h1>
          <p className="muted">{lang === "uk" ? "Інтерфейс, мова, диктування." : "Display, language, dictation."}</p>
        </div>
      </div>

      <Section icon="sun" title={lang === "uk" ? "Вигляд" : "Appearance"}>
        <Row label={lang === "uk" ? "Тема" : "Theme"} hint={lang === "uk" ? "Світла або темна" : "Light or dark"}>
          <div className="seg">
            {["light", "dark"].map((v) => (
              <button key={v} className={"seg-btn " + (tweaks.theme === v ? "on" : "")} onClick={() => setTweak("theme", v)}>
                <Icon name={v === "dark" ? "moon" : "sun"} size={12} /> {v}
              </button>
            ))}
          </div>
        </Row>
        <Row label={lang === "uk" ? "Щільність" : "Density"} hint={lang === "uk" ? "Розмір елементів" : "Element spacing"}>
          <div className="seg">
            {["comfortable", "compact"].map((v) => (
              <button key={v} className={"seg-btn " + (tweaks.density === v ? "on" : "")} onClick={() => setTweak("density", v)}>{v}</button>
            ))}
          </div>
        </Row>
        <Row label={lang === "uk" ? "Акцент" : "Accent color"}>
          <div className="seg">
            {["#0a8a7a", "#2563eb", "#7c3aed", "#0f172a", "#dc2626"].map((v) => (
              <button key={v} className={"swatch " + (tweaks.accent === v ? "on" : "")} style={{ background: v }} onClick={() => setTweak("accent", v)} title={v} />
            ))}
          </div>
        </Row>
      </Section>

      <Section icon="layers" title={lang === "uk" ? "Мова" : "Language"}>
        <Row label={lang === "uk" ? "Мова інтерфейсу" : "UI language"}>
          <div className="seg">
            {[{ v: "uk", l: "Українська" }, { v: "en", l: "English" }].map((o) => (
              <button key={o.v} className={"seg-btn " + (tweaks.lang === o.v ? "on" : "")} onClick={() => setTweak("lang", o.v)}>{o.l}</button>
            ))}
          </div>
        </Row>
      </Section>
    </div>
  );
}
