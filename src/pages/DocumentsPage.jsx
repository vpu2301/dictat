// DocumentsPage.jsx — one page for everything the workspace writes down.
//
// Reports, notes and transcription jobs used to be three sidebar entries and
// three pages that looked almost identical: a title, a filter row, a table.
// They are three tabs here instead. Each tab still renders its own list
// component in `embedded` mode — the lists keep their filters, search and
// paging; this page owns the frame, the title and the create button, so the
// three stop competing for the same nav space.
import React from "react";
import { Icon, SplitButton } from "../components/UI.jsx";
import { ReportsList } from "../components/Reports.jsx";
import { ScribeNotes } from "../components/Scribe.jsx";
import { AsrJobsListPage } from "./AsrJobsListPage.jsx";
import { tr } from "../i18n.js";

export const DOC_TABS = ["reports", "notes", "transcripts"];

// Path ⇄ tab. The tab lives in the path rather than a query string because the
// app routes on the hash, where `?tab=` would not reach `location.search`.
export const docPath = (tab) => `/documents/${tab}`;
export function docTabFromRoute(route) {
  const seg = route.replace(/^\/documents\/?/, "").split(/[/?]/)[0];
  return DOC_TABS.includes(seg) ? seg : "reports";
}

export function DocumentsPage({ tab = "reports", navigate, lang }) {
  const tabs = [
    { key: "reports", icon: "fileText", label: tr(lang, "Звіти", "Reports") },
    { key: "notes", icon: "edit", label: tr(lang, "Нотатки", "Notes") },
    { key: "transcripts", icon: "bot", label: tr(lang, "Транскрипції", "Transcriptions") },
  ];
  const sub = {
    reports: tr(lang, "Диктовані звіти — чернетки, підписані та з правками.",
                      "Dictated reports — drafts, signed and amended."),
    notes: tr(lang, "Нотатки з редактора та консультацій.",
                    "Notes from the editor and from consultations."),
    transcripts: tr(lang, "Завантажені записи в обробці ASR.",
                          "Uploaded recordings going through ASR."),
  }[tab];

  // The create button follows the tab: what you make here depends on which
  // kind of document you are looking at. The caret keeps the other two one
  // click away, so no tab is a dead end.
  const make = {
    reports: { icon: "mic", label: tr(lang, "Новий звіт", "New report"), onClick: () => navigate("/dictate/studio") },
    notes: { icon: "edit", label: tr(lang, "Написати нотатку", "Take a note"), onClick: () => navigate("/scribe/notes/new") },
    transcripts: { icon: "bot", label: tr(lang, "Нове завдання", "New job"), onClick: () => navigate("/asr/new") },
  };
  const others = DOC_TABS.filter((k) => k !== tab).map((k) => make[k]);

  return (
    <div className="page">
      <div className="page-h">
        <div style={{ flex: 1 }}>
          <h1>{tr(lang, "Документи", "Documents")}</h1>
          <p className="sub">{sub}</p>
        </div>
        <SplitButton lang={lang} primary={make[tab]} actions={others} />
      </div>

      <div className="tabs doc-tabs">
        {tabs.map((t) => (
          <button key={t.key} type="button"
                  className={"tab" + (tab === t.key ? " on" : "")}
                  onClick={() => navigate(docPath(t.key))}>
            <Icon name={t.icon} size={13} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "reports" && <ReportsList navigate={navigate} lang={lang} embedded />}
      {tab === "notes" && <ScribeNotes navigate={navigate} lang={lang} embedded />}
      {tab === "transcripts" && <AsrJobsListPage navigate={navigate} lang={lang} embedded />}
    </div>
  );
}
