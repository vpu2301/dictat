// chat/host/ChatSettingsSection.jsx — the module's settings, rendered by the host.
//
// Second file in the host adapter, and the second place this module is allowed
// to know which host it is in. It reads the module's settings contract and
// draws it with Klarnote's own settings primitives, so the evidence-chat rows
// sit in /settings looking exactly like Appearance or Dictation — because they
// are built from the same components.
//
// The module keeps ownership of what the settings MEAN and where they persist
// (localStorage, scoped per workspace). The host owns only placement.

import React from "react";
import { Row, Section, Toggle } from "../../components/SettingsLayout.jsx";
import { MenuSelect } from "../../components/MenuSelect.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";
import { tr } from "../../i18n.js";
import {
  useSettings, EVIDENCE_DETAIL_OPTIONS, ANSWER_LANGUAGE_OPTIONS, SETTINGS_LABELS,
} from "../settingsContract.js";

export const CHAT_SETTINGS_SECTION = {
  id: "evidence-chat",
  icon: "sparkle",
  uk: "Доказовий чат",
  en: "Evidence chat",
};

const toOptions = (options, lang) => options.map((o) => ({
  value: o.value,
  label: lang === "uk" ? o.uk : o.en,
}));

export function ChatSettingsSection({ lang = "en" }) {
  const { state } = useAuth();
  // Same scope the module uses when it reads these back: per workspace, so two
  // clinics in one browser don't share an answer language.
  const { settings, update } = useSettings(state?.claims?.tid);

  const label = (key) => (lang === "uk" ? SETTINGS_LABELS[key].uk : SETTINGS_LABELS[key].en);

  return (
    <Section
      id={CHAT_SETTINGS_SECTION.id}
      icon={CHAT_SETTINGS_SECTION.icon}
      title={tr(lang, CHAT_SETTINGS_SECTION.uk, CHAT_SETTINGS_SECTION.en)}
    >
      {/* The demo gate first: everything below only matters once the module
          is visible at all. This row must stay reachable while the module is
          OFF — it is the only way to turn it back on. */}
      <Row label={label("moduleEnabled")[0]} hint={label("moduleEnabled")[1]}>
        <Toggle
          on={!!settings.moduleEnabled}
          onChange={(v) => update({ moduleEnabled: v })}
          label={settings.moduleEnabled ? tr(lang, "Увімкнено", "On") : tr(lang, "Вимкнено", "Off")}
        />
      </Row>

      <Row label={label("evidenceDetail")[0]} hint={label("evidenceDetail")[1]}>
        <MenuSelect
          value={settings.evidenceDetail}
          options={toOptions(EVIDENCE_DETAIL_OPTIONS, lang)}
          onChange={(v) => update({ evidenceDetail: v })}
        />
      </Row>

      <Row label={label("answerLanguage")[0]} hint={label("answerLanguage")[1]}>
        <MenuSelect
          value={settings.answerLanguage}
          options={toOptions(ANSWER_LANGUAGE_OPTIONS, lang)}
          onChange={(v) => update({ answerLanguage: v })}
        />
      </Row>
    </Section>
  );
}
