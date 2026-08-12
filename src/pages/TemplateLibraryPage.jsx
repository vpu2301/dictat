// TemplateLibraryPage.jsx — one page for both template libraries.
//
// Report templates (the structured schemas the Studio dictates into) and note
// structures (the section layouts the note editor offers) were two sidebar
// rows and two pages. They are two tabs here, on the same contract as the
// Documents page: this page owns the frame and the title, each library renders
// `embedded` and keeps its own search, filters and cards.
//
// It does NOT live at /templates — that path belongs to the public marketing
// site (TemplatesMarketPage), and a signed-in doctor clicking "Templates"
// must not land on the sales page.
import React from "react";
import { Icon } from "../components/UI.jsx";
import { TemplatesPage } from "../components/TemplatesPage.jsx";
import { NoteStructuresPage } from "../components/NoteStructuresPage.jsx";
import { tr } from "../i18n.js";

// Forms are report templates too — they come from the same service and the
// same list endpoint — but they are a different job (a standalone document
// rather than a visit note), so they get a tab beside the other two rather
// than a filter buried inside the reports tab.
export const LIB_TABS = ["reports", "forms", "notes"];

export const libPath = (tab) => `/library/${tab}`;
export function libTabFromRoute(route) {
  const seg = route.replace(/^\/library\/?/, "").split(/[/?]/)[0];
  return LIB_TABS.includes(seg) ? seg : "reports";
}

export function TemplateLibraryPage({ tab = "reports", navigate, lang }) {
  const tabs = [
    { key: "reports", icon: "book", label: tr(lang, "Шаблони звітів", "Report templates") },
    { key: "forms", icon: "fileText", label: tr(lang, "Форми", "Forms") },
    { key: "notes", icon: "layers", label: tr(lang, "Шаблони нотаток", "Note templates") },
  ];
  const sub = {
    reports: tr(lang, "Структуровані шаблони, у які диктує Студія.",
                      "Structured templates the Studio dictates into."),
    forms: tr(lang, "Виписки, скерування, протоколи та анкети.",
                    "Discharge summaries, referrals, operative notes and intake sheets."),
    notes: tr(lang, "Структури розділів для редактора нотаток.",
                    "Section structures for the note editor."),
  }[tab];

  return (
    <div className="page">
      <div className="page-h">
        <div style={{ flex: 1 }}>
          <h1>{tr(lang, "Шаблони", "Templates")}</h1>
          <p className="sub">{sub}</p>
        </div>
      </div>

      <div className="tabs doc-tabs">
        {tabs.map((t) => (
          <button key={t.key} type="button"
                  className={"tab" + (tab === t.key ? " on" : "")}
                  onClick={() => navigate(libPath(t.key))}>
            <Icon name={t.icon} size={13} /> {t.label}
          </button>
        ))}
      </div>

      {/* Same list, two disjoint slices — the tab is the category. Keyed so a
          tab switch remounts instead of carrying the other tab's search and
          filter chips across. */}
      {(tab === "reports" || tab === "forms") && (
        <TemplatesPage key={tab} lang={lang} navigate={navigate} category={tab} embedded />
      )}
      {tab === "notes" && <NoteStructuresPage key={tab} lang={lang} embedded />}
    </div>
  );
}
