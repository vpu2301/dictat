// SettingsPage.jsx — Real /settings page. The Tweaks panel stays as a dev tool;
// this is the user-facing settings surface that mirrors many of the same knobs.
//
// Layout: a sticky scroll-spy side menu (left) + stacked setting sections
// (right). The menu highlights the section currently in view and jumps to a
// section on click. New sections beyond Appearance/Language are scaffolding for
// functionality we'll wire to the backend later — the toggles/selects persist
// to the same client-side `tweaks` store today; the actions marked "Soon" are
// placeholders awaiting their API.
import React from "react";
import { Icon } from "../components/UI.jsx";

// ── Section registry (drives both the side nav and the rendered order) ────────
const SECTIONS = [
  { id: "appearance",    icon: "sun",      uk: "Вигляд",          en: "Appearance" },
  { id: "language",      icon: "layers",   uk: "Мова та регіон",  en: "Language & region" },
  { id: "dictation",     icon: "mic",      uk: "Диктування",      en: "Dictation" },
  { id: "notifications", icon: "bell",     uk: "Сповіщення",      en: "Notifications" },
  { id: "privacy",       icon: "shield",   uk: "Дані та приватність", en: "Data & privacy" },
  { id: "account",       icon: "user",     uk: "Акаунт і безпека", en: "Account & security" },
  { id: "about",         icon: "help",     uk: "Про застосунок",  en: "About" },
];

// ── Scroll-spy: report which section is currently in view ─────────────────────
function useScrollSpy(ids) {
  const [active, setActive] = React.useState(ids[0]);
  React.useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean);
    if (!els.length) return undefined;
    const obs = new IntersectionObserver(
      (entries) => {
        // The topmost section intersecting the upper band of the viewport wins.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      // Top inset clears the sticky topbar; bottom inset makes a section "active"
      // once its heading reaches roughly the top third of the viewport.
      { rootMargin: "-72px 0px -55% 0px", threshold: 0 },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [ids.join(",")]);
  return [active, setActive];
}

// ── Layout primitives ─────────────────────────────────────────────────────────
function Section({ id, icon, title, children }) {
  return (
    <section id={id} className="card settings-card settings-section">
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

// ── Reusable controls ─────────────────────────────────────────────────────────
function Seg({ value, options, onChange }) {
  return (
    <div className="seg">
      {options.map((o) => {
        const v = typeof o === "object" ? o.v : o;
        const label = typeof o === "object" ? o.l : o;
        const ic = typeof o === "object" ? o.icon : null;
        return (
          <button key={v} className={"seg-btn " + (value === v ? "on" : "")} onClick={() => onChange(v)}>
            {ic && <Icon name={ic} size={12} />} {label}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({ on, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!on}
      aria-label={label}
      className={"toggle" + (on ? " on" : "")}
      onClick={() => onChange(!on)}
    >
      <span />
    </button>
  );
}

function SoonBtn({ children }) {
  return (
    <button type="button" className="btn ghost sm" disabled>
      {children}
    </button>
  );
}

export function SettingsPage({ lang = "en", tweaks, setTweak }) {
  const T = (uk, en) => (lang === "uk" ? uk : en);
  const ids = SECTIONS.map((s) => s.id);
  const [active, setActive] = useScrollSpy(ids);

  const jump = (id) => () => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Defaults applied inline so the page works before these land in TWEAK_DEFAULTS.
  const g = (key, fallback) => (tweaks[key] === undefined ? fallback : tweaks[key]);

  return (
    <div className="page settings-page">
      <div className="page-h">
        <div>
          <h1>{T("Налаштування", "Settings")}</h1>
          <p className="muted">{T("Інтерфейс, мова, диктування та акаунт.", "Display, language, dictation and account.")}</p>
        </div>
      </div>

      <div className="settings-layout">
        {/* ── Sticky scroll-spy side menu ─────────────────────────────── */}
        <nav className="settings-nav" aria-label={T("Розділи налаштувань", "Settings sections")}>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              className={"settings-nav-item" + (active === s.id ? " on" : "")}
              onClick={jump(s.id)}
              aria-current={active === s.id ? "true" : undefined}
            >
              <Icon name={s.icon} size={14} />
              <span>{T(s.uk, s.en)}</span>
            </button>
          ))}
        </nav>

        {/* ── Sections ────────────────────────────────────────────────── */}
        <div className="settings-main">
          <Section id="appearance" icon="sun" title={T("Вигляд", "Appearance")}>
            <Row label={T("Тема", "Theme")} hint={T("Світла або темна", "Light or dark")}>
              <Seg value={tweaks.theme} onChange={(v) => setTweak("theme", v)}
                options={[{ v: "light", l: "light", icon: "sun" }, { v: "dark", l: "dark", icon: "moon" }]} />
            </Row>
            <Row label={T("Щільність", "Density")} hint={T("Розмір елементів", "Element spacing")}>
              <Seg value={tweaks.density} onChange={(v) => setTweak("density", v)} options={["comfortable", "compact"]} />
            </Row>
            <Row label={T("Акцент", "Accent color")}>
              <div className="seg">
                {["#0a8a7a", "#2563eb", "#7c3aed", "#0f172a", "#dc2626"].map((v) => (
                  <button key={v} className={"swatch " + (tweaks.accent === v ? "on" : "")} style={{ background: v }} onClick={() => setTweak("accent", v)} title={v} />
                ))}
              </div>
            </Row>
          </Section>

          <Section id="language" icon="layers" title={T("Мова та регіон", "Language & region")}>
            <Row label={T("Мова інтерфейсу", "UI language")}>
              <Seg value={tweaks.lang} onChange={(v) => setTweak("lang", v)}
                options={[{ v: "uk", l: "Українська" }, { v: "en", l: "English" }]} />
            </Row>
            <Row label={T("Мова диктування", "Dictation language")} hint={T("Мова за замовчуванням для розпізнавання", "Default language for recognition")}>
              <Seg value={g("dictLang", "auto")} onChange={(v) => setTweak("dictLang", v)}
                options={[{ v: "auto", l: T("Авто", "Auto") }, { v: "uk", l: "UK" }, { v: "en", l: "EN" }]} />
            </Row>
            <Row label={T("Формат дати", "Date format")}>
              <Seg value={g("dateFormat", "dd.mm.yyyy")} onChange={(v) => setTweak("dateFormat", v)}
                options={[{ v: "dd.mm.yyyy", l: "DD.MM.YYYY" }, { v: "yyyy-mm-dd", l: "YYYY-MM-DD" }, { v: "mm/dd/yyyy", l: "MM/DD/YYYY" }]} />
            </Row>
          </Section>

          <Section id="dictation" icon="mic" title={T("Диктування", "Dictation")}>
            <Row label={T("Автопунктуація", "Auto-punctuation")} hint={T("Розставляти розділові знаки автоматично", "Insert punctuation automatically")}>
              <Toggle on={g("autoPunct", true)} onChange={(v) => setTweak("autoPunct", v)} label={T("Автопунктуація", "Auto-punctuation")} />
            </Row>
            <Row label={T("Медичний словник", "Medical vocabulary boost")} hint={T("Підвищити точність медичних термінів", "Improve accuracy on medical terms")}>
              <Toggle on={g("vocabBoost", true)} onChange={(v) => setTweak("vocabBoost", v)} label={T("Медичний словник", "Medical vocabulary boost")} />
            </Row>
            <Row label={T("Автостоп за тишею", "Silence auto-stop")} hint={T("Зупиняти запис після паузи", "Stop recording after a pause")}>
              <Seg value={g("silenceStop", "4")} onChange={(v) => setTweak("silenceStop", v)}
                options={[{ v: "off", l: T("Вимк.", "Off") }, { v: "2", l: "2s" }, { v: "4", l: "4s" }, { v: "6", l: "6s" }]} />
            </Row>
            <Row label={T("Автозбереження чернеток", "Auto-save drafts")}>
              <Toggle on={g("autosave", true)} onChange={(v) => setTweak("autosave", v)} label={T("Автозбереження чернеток", "Auto-save drafts")} />
            </Row>
          </Section>

          <Section id="notifications" icon="bell" title={T("Сповіщення", "Notifications")}>
            <Row label={T("Email-сповіщення", "Email notifications")}>
              <Toggle on={g("notifyEmail", true)} onChange={(v) => setTweak("notifyEmail", v)} label={T("Email-сповіщення", "Email notifications")} />
            </Row>
            <Row label={T("Звіт готовий", "Report ready")} hint={T("Коли синтез завершено", "When synthesis completes")}>
              <Toggle on={g("notifyReportReady", true)} onChange={(v) => setTweak("notifyReportReady", v)} label={T("Звіт готовий", "Report ready")} />
            </Row>
            <Row label={T("Нагадування про підпис", "Signature reminders")} hint={T("Нагадувати про непідписані звіти", "Remind about unsigned reports")}>
              <Toggle on={g("notifySignReminder", false)} onChange={(v) => setTweak("notifySignReminder", v)} label={T("Нагадування про підпис", "Signature reminders")} />
            </Row>
          </Section>

          <Section id="privacy" icon="shield" title={T("Дані та приватність", "Data & privacy")}>
            <Row label={T("Аналітика використання", "Usage analytics")} hint={T("Анонімні дані для покращення продукту", "Anonymous data to improve the product")}>
              <Toggle on={g("analytics", true)} onChange={(v) => setTweak("analytics", v)} label={T("Аналітика використання", "Usage analytics")} />
            </Row>
            <Row label={T("Зберігання аудіо", "Audio retention")} hint={T("Як довго зберігати записи диктувань", "How long to keep dictation recordings")}>
              <Seg value={g("retention", "365")} onChange={(v) => setTweak("retention", v)}
                options={[{ v: "30", l: T("30 днів", "30 days") }, { v: "365", l: T("1 рік", "1 year") }, { v: "0", l: T("Назавжди", "Forever") }]} />
            </Row>
            <Row label={T("Експорт моїх даних", "Export my data")} hint={T("Завантажити архів ваших звітів", "Download an archive of your reports")}>
              <SoonBtn><Icon name="download" size={13} /> {T("Незабаром", "Soon")}</SoonBtn>
            </Row>
          </Section>

          <Section id="account" icon="user" title={T("Акаунт і безпека", "Account & security")}>
            <Row label={T("Змінити пароль", "Change password")}>
              <SoonBtn>{T("Незабаром", "Soon")}</SoonBtn>
            </Row>
            <Row label={T("Двофакторна автентифікація", "Two-factor authentication")} hint={T("Додатковий захист входу", "Extra protection at sign-in")}>
              <SoonBtn>{T("Незабаром", "Soon")}</SoonBtn>
            </Row>
            <Row label={T("Активні сеанси", "Active sessions")} hint={T("Пристрої, де ви увійшли", "Devices where you're signed in")}>
              <SoonBtn>{T("Незабаром", "Soon")}</SoonBtn>
            </Row>
          </Section>

          <Section id="about" icon="help" title={T("Про застосунок", "About")}>
            <Row label={T("Версія", "Version")}>
              <span className="settings-row-hint" style={{ margin: 0 }}>Dictat · {__APP_VERSION__}</span>
            </Row>
            <Row label={T("Підтримка", "Support")}>
              <a className="btn ghost sm" href="mailto:support@dictat.health">support@dictat.health</a>
            </Row>
          </Section>
        </div>
      </div>
    </div>
  );
}
