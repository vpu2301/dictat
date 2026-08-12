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
import { MenuSelect } from "../components/MenuSelect.jsx";
import { Row, Section, SettingsNav, Toggle, useSettingsSections } from "../components/SettingsLayout.jsx";
import { LANGS , tr } from "../i18n.js";
import { ACCENTS } from "../theme/accents.js";
import { ChatSettingsSection, CHAT_SETTINGS_SECTION } from "../chat/host/ChatSettingsSection.jsx";
import { ChatConnectorsSection, CHAT_CONNECTORS_SECTION } from "../chat/host/ChatConnectorsSection.jsx";
import { useSettings as useChatSettings } from "../chat/settingsContract.js";
import { AccountSecuritySection, ACCOUNT_SECURITY_SECTION } from "../components/AccountSecuritySection.jsx";
import { useAuth } from "../auth/AuthContext.jsx";

// ── Section registry (drives both the side nav and the rendered order) ────────
const SECTIONS = [
  { id: "appearance",    icon: "sun",      uk: "Вигляд",          en: "Appearance" },
  { id: "language",      icon: "layers",   uk: "Мова та регіон",  en: "Language & region" },
  { id: "dictation",     icon: "mic",      uk: "Диктування",      en: "Dictation" },
  // The evidence-chat module publishes its settings as a contract and this page
  // renders them; the module has no settings screen of its own (src/chat/README.md).
  { id: CHAT_SETTINGS_SECTION.id, icon: CHAT_SETTINGS_SECTION.icon, uk: CHAT_SETTINGS_SECTION.uk, en: CHAT_SETTINGS_SECTION.en },
  { id: CHAT_CONNECTORS_SECTION.id, icon: CHAT_CONNECTORS_SECTION.icon, uk: CHAT_CONNECTORS_SECTION.uk, en: CHAT_CONNECTORS_SECTION.en },
  { id: "notifications", icon: "bell",     uk: "Сповіщення",      en: "Notifications" },
  { id: "privacy",       icon: "shield",   uk: "Дані та приватність", en: "Data & privacy" },
  { id: ACCOUNT_SECURITY_SECTION.id, icon: ACCOUNT_SECURITY_SECTION.icon, uk: ACCOUNT_SECURITY_SECTION.uk, en: ACCOUNT_SECURITY_SECTION.en },
  { id: "about",         icon: "help",     uk: "Про застосунок",  en: "About" },
];

// ── Reusable controls ─────────────────────────────────────────────────────────
// Multi-option pickers are dropdowns (MenuSelect); binary on/off settings stay
// switches.
function Seg({ value, options, onChange }) {
  const opts = options.map((o) => (
    typeof o === "object" ? { value: o.v, label: o.l } : { value: o, label: o }
  ));
  return <MenuSelect value={value} options={opts} onChange={onChange} />;
}

function SoonBtn({ children }) {
  return (
    <button type="button" className="btn ghost sm" disabled>
      {children}
    </button>
  );
}

export function SettingsPage({ lang = "en", tweaks, setTweak, navigate, onToast, section }) {
  const T = (uk, en) => tr(lang, uk, en);
  // The evidence-chat module sits behind the "Show the module" toggle. Its
  // MAIN section always renders — it holds the toggle, and a gate you cannot
  // reach to open is a lock, not a setting. The CONNECTORS section follows
  // the module: configuring connectors for a hidden module is dead UI.
  const { state: auth } = useAuth();
  const chatEnabled = !!useChatSettings(auth?.claims?.tid).settings.moduleEnabled;
  const sections = chatEnabled
    ? SECTIONS
    : SECTIONS.filter((s) => s.id !== CHAT_CONNECTORS_SECTION.id);
  // `section` comes from ?s= on the route — see ProfilePage's security rows.
  const { active, jump } = useSettingsSections(sections, section);

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
        <SettingsNav
          sections={sections.map((s) => ({ id: s.id, icon: s.icon, label: T(s.uk, s.en) }))}
          active={active}
          onJump={jump}
          label={T("Розділи налаштувань", "Settings sections")}
        />

        {/* ── Sections ────────────────────────────────────────────────── */}
        <div className="settings-main">
          <Section id="appearance" icon="sun" title={T("Вигляд", "Appearance")}>
            <Row
              label={T("Тема", "Theme")}
              hint={tweaks.theme === "system"
                ? T("Слідує за темою системи", "Follows your system setting")
                : T("Світла, темна або як у системі", "Light, dark, or match your system")}
            >
              {/* "system" is not a third palette — it is a deferral, resolved in
                  App.jsx against prefers-color-scheme and re-resolved when the
                  OS flips. Last in the list because it is the answer for
                  someone who does not want to answer. */}
              <Seg value={tweaks.theme} onChange={(v) => setTweak("theme", v)}
                options={[
                  { v: "light", l: T("Світла", "Light") },
                  { v: "dark", l: T("Темна", "Dark") },
                  { v: "system", l: T("Як у системі", "System") },
                ]} />
            </Row>
            <Row label={T("Щільність", "Density")} hint={T("Розмір елементів", "Element spacing")}>
              <Seg value={tweaks.density} onChange={(v) => setTweak("density", v)} options={["comfortable", "compact"]} />
            </Row>
            <Row label={T("Акцент", "Accent color")}>
              {/* A dropdown like every other multi-option row on this page —
                  the swatch strip was the one control here that did not look
                  like a setting. The colour still leads each option; the name
                  is what makes it choosable without relying on colour alone. */}
              <MenuSelect
                value={tweaks.accent}
                ariaLabel={T("Акцент", "Accent color")}
                onChange={(v) => setTweak("accent", v)}
                options={ACCENTS.map((a) => ({
                  value: a.value,
                  label: (
                    <span className="accent-opt">
                      <span className="accent-dot" style={{ background: a.value }} />
                      {T(a.uk, a.en)}
                    </span>
                  ),
                }))}
              />
            </Row>
          </Section>

          <Section id="language" icon="layers" title={T("Мова та регіон", "Language & region")}>
            <Row label={T("Мова інтерфейсу", "UI language")}>
              <Seg value={tweaks.lang} onChange={(v) => setTweak("lang", v)}
                options={LANGS.map((l) => ({ v: l.code, l: l.label }))} />
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

          <ChatSettingsSection lang={lang} />

          {chatEnabled && <ChatConnectorsSection lang={lang} />}

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
            <Row
              label={T("Сповіщення за подіями", "Per-event notifications")}
              hint={T("Канали для кожного типу події, тихі години та підсумок", "Channels per event type, quiet hours and digest")}
            >
              <button type="button" className="btn ghost sm" onClick={() => navigate?.("/settings/notifications")}>
                {T("Налаштувати", "Configure")} <Icon name="chevRight" size={13} />
              </button>
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

          <AccountSecuritySection lang={lang} onToast={onToast} />

          <Section id="about" icon="help" title={T("Про застосунок", "About")}>
            <Row label={T("Версія", "Version")}>
              <span className="settings-row-hint" style={{ margin: 0 }}>Klarnote · {__APP_VERSION__}</span>
            </Row>
            <Row label={T("Підтримка", "Support")}>
              <a className="btn ghost sm" href="mailto:support@klarnote.com">support@klarnote.com</a>
            </Row>
          </Section>
        </div>
      </div>
    </div>
  );
}
