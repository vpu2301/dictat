// chat/host/ChatConnectorsSection.jsx — connectors, rendered by the host.
//
// Which sources the evidence module may read is a setting, not a screen: it is
// configured once and then lived with, like retention or notification channels.
// So it sits on the platform's settings page, built from the platform's own
// Section / Row / Toggle, next to everything else configured that way.
//
// The module still owns the catalog and the writes (`data/hooks.js`); the host
// owns placement and the controls — same split as the module's other settings.

import React from "react";
import { Row, Section, Toggle } from "../../components/SettingsLayout.jsx";
import { tr } from "../../i18n.js";
import { useConnectors, setConnectorState } from "../data/hooks.js";

export const CHAT_CONNECTORS_SECTION = {
  id: "evidence-connectors",
  icon: "link",
  uk: "Джерела доказів",
  en: "Evidence sources",
};

const CATEGORIES = [
  { id: "guidelines", uk: "Настанови та стандарти", en: "Guidelines & standards" },
  { id: "literature", uk: "Бази літератури", en: "Literature databases" },
  { id: "clinical", uk: "Клінічні довідники", en: "Clinical references" },
  { id: "hospital", uk: "Лікарняні системи", en: "Hospital systems" },
];

export function ChatConnectorsSection({ lang = "en" }) {
  const connectors = useConnectors();
  const rows = connectors.data || [];
  const connected = rows.filter((c) => c.status === "connected").length;

  const toggle = async (connector, next) => {
    await setConnectorState(connector.id, next);
    connectors.refetch();
  };

  return (
    <Section
      id={CHAT_CONNECTORS_SECTION.id}
      icon={CHAT_CONNECTORS_SECTION.icon}
      title={tr(lang, CHAT_CONNECTORS_SECTION.uk, CHAT_CONNECTORS_SECTION.en)}
      action={!connectors.loading && rows.length > 0 && (
        <span className="chip">
          {tr(lang, `${connected} під’єднано`, `${connected} connected`)}
        </span>
      )}
    >
      {connectors.loading ? (
        <Row label={tr(lang, "Завантаження…", "Loading…")} />
      ) : rows.length === 0 ? (
        <Row
          label={tr(lang, "Джерел немає", "No sources")}
          hint={tr(lang, "З’являться, коли їх увімкне адміністратор.", "They appear once an administrator enables them.")}
        />
      ) : CATEGORIES.map((cat) => {
        const group = rows.filter((c) => c.category === cat.id);
        if (!group.length) return null;
        return (
          <React.Fragment key={cat.id}>
            <div className="settings-subhead">{tr(lang, cat.uk, cat.en)}</div>
            {group.map((c) => {
              const soon = c.status === "coming_soon";
              const hint = [
                lang === "uk" && c.descriptionUk ? c.descriptionUk : c.description,
                c.status === "connected" && c.count != null
                  ? `${c.count.toLocaleString(lang === "uk" ? "uk-UA" : "en-US")} ${c.countUnit}`
                  : null,
              ].filter(Boolean).join(" · ");
              return (
                <Row
                  key={c.id}
                  label={
                    <>
                      {c.name}
                      {c.region && <span className="chip" style={{ marginLeft: 8 }}>{c.region}</span>}
                      {c.enterprise && <span className="chip" style={{ marginLeft: 6 }}>Enterprise</span>}
                    </>
                  }
                  hint={hint}
                >
                  {soon ? (
                    // Not a disabled switch: a control that looks operable and
                    // does nothing is worse than a word that says why.
                    <span className="settings-row-hint" style={{ margin: 0 }}>
                      {tr(lang, "Незабаром", "Coming soon")}
                    </span>
                  ) : (
                    <Toggle
                      on={c.status === "connected"}
                      onChange={(next) => toggle(c, next)}
                      label={c.name}
                    />
                  )}
                </Row>
              );
            })}
          </React.Fragment>
        );
      })}
    </Section>
  );
}
