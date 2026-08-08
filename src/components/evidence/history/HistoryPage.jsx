// HistoryPage.jsx — #/evidence/history (EVA-S04).
//
// The asker's own questions, newest first, cursor-paged through the shared
// `useCursorPages` hook. Scoped by the server to the caller: this is not an
// audit surface and shows nobody else's questions — a clinician's question
// list is a record of what they were unsure about, and that is theirs.
//
// Rows open the answer they produced. A question whose answer never completed
// has nothing to open and says so rather than linking into a 404.

import React from "react";
import { Empty } from "../../UI.jsx";
import { Loading } from "../../DataStates.jsx";
import { ApiErrorView } from "../../ApiErrorView.jsx";
import { useI18n } from "../../../i18n.js";
import { useCursorPages } from "../../../api/useCursorPages.js";
import { listQuestions } from "../../../api/evidenceAnswers.js";
import { askedAtLabel, historyPage } from "./historyView.js";
import { rememberQuestion } from "../answerTitles.js";
import "../evidence.css";

export function HistoryPage({ navigate }) {
  const { t, lang } = useI18n();
  const pg = useCursorPages((cursor) => listQuestions(cursor).then(historyPage), []);

  return (
    <div className="page evd-page" data-testid="evidence-history">
      <header className="evd-head">
        <h1>{t("history.title")}</h1>
        <p className="evd-sub">{t("history.subtitle")}</p>
      </header>

      {pg.loading && pg.items.length === 0 && <Loading lang={lang} />}
      {pg.error && <ApiErrorView error={pg.error} lang={lang} />}

      {!pg.loading && !pg.error && pg.items.length === 0 && (
        <div data-testid="history-empty">
          <Empty
            icon="clock"
            title={t("history.empty")}
            body={t("history.empty_body")}
            action={
              <button type="button" className="btn accent" onClick={() => navigate("/evidence")}
                      data-testid="history-empty-cta">
                {t("history.try_example")}
              </button>
            }
          />
        </div>
      )}

      {pg.items.length > 0 && (
        <ul className="evd-history" data-testid="history-list">
          {pg.items.map((row) => (
            <li key={row.id} className="evd-history-row" data-testid="history-row"
                data-openable={String(row.openable)}>
              {row.openable ? (
                <button type="button" className="evd-history-open"
                        onClick={() => {
                          // The row is holding the question the destination
                          // needs for its breadcrumb and its echo; hand it
                          // over rather than making that screen re-fetch it.
                          rememberQuestion(row.answerId, row.question);
                          navigate(`/evidence/answers/${row.answerId}`);
                        }}
                        data-testid="history-open">
                  {row.excerpt}
                </button>
              ) : (
                <span className="evd-history-open evd-history-dead">{row.excerpt}</span>
              )}
              <span className="evd-history-meta">
                <span className="evd-badge evd-mode-badge" data-mode={row.mode}>
                  {t(`mode.${row.mode}`)}
                </span>
                {row.status && (
                  <span className={`evd-badge evd-tone-${row.tone}`} data-status={row.status}>
                    {t(`answer_status.${row.status}`)}
                  </span>
                )}
                <time className="evd-hint" dateTime={row.askedAt || undefined}>
                  {askedAtLabel(row.askedAt, lang === "uk" ? "uk-UA" : "en-GB")}
                </time>
              </span>
            </li>
          ))}
        </ul>
      )}

      {(pg.hasPrev || pg.hasNext) && (
        <div className="evd-actions" data-testid="history-pager">
          <button type="button" className="btn" disabled={!pg.hasPrev} onClick={pg.prev}
                  data-testid="history-prev">{t("common.prev")}</button>
          <span className="evd-hint">{t("history.page", { n: pg.page })}</span>
          <button type="button" className="btn" disabled={!pg.hasNext} onClick={pg.next}
                  data-testid="history-next">{t("common.next")}</button>
        </div>
      )}
    </div>
  );
}
