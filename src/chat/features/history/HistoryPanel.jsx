// chat/features/history/HistoryPanel.jsx — past conversations in this module.
//
// The patient badge is the load-bearing part of each row. "HbA1c target
// discussion" means something different depending on who it was about, and a
// history list that hides that invites resuming the right question against the
// wrong patient.

import React from "react";
import { useEmbed } from "../../EmbedContext.jsx";
import { useSessions } from "../../data/hooks.js";
import { LoadingSkeleton, EmptyState, ErrorState } from "../../ui/States.jsx";
import { Icon } from "../../ui/Icon.jsx";
import { pick, relative, t } from "../../i18n.js";

export function HistoryPanel() {
  const { locale, navigate, emit, settings } = useEmbed();
  const sessions = useSessions();

  const open = (session) => {
    emit({ name: "session_opened", sessionId: session.id });
    navigate({ view: "chat", sessionId: session.id });
  };

  return (
    <div className="ec-screen">
      <header className="ec-screen-h">
        <div>
          <h2 className="ec-h1">{t(locale, "Історія", "History")}</h2>
          <p className="ec-sub">
            {t(locale, "Розмови в цьому модулі. Відновлення повертає тред і контекст пацієнта.",
              "Conversations in this module. Resuming restores the thread and its patient context.")}
          </p>
        </div>
        <button type="button" className="ec-btn" onClick={() => navigate({ view: "chat" })}>
          <Icon name="plus" size={13} />
          <span>{t(locale, "Новий чат", "New chat")}</span>
        </button>
      </header>

      {sessions.loading ? (
        <LoadingSkeleton variant="list" rows={3} />
      ) : sessions.error ? (
        <div className="ec-card">
          <ErrorState error={sessions.error} onRetry={sessions.refetch} locale={locale} />
        </div>
      ) : !sessions.data?.length ? (
        <div className="ec-card">
          <EmptyState
            icon="history"
            title={t(locale, "Розмов ще немає", "No conversations yet")}
            body={t(locale, "Щойно ви поставите перше запитання, воно з’явиться тут.",
              "Ask your first question and it shows up here.")}
            action={
              <button type="button" className="ec-btn" onClick={() => navigate({ view: "chat" })}>
                {t(locale, "Почати чат", "Start a chat")}
              </button>
            }
          />
        </div>
      ) : (
        <ul className="ec-sessions">
          {sessions.data.map((s) => {
            const name = s.patientName;
            const title = pick(s, "title", settings.answerLanguage);
            return (
              <li key={s.id}>
                <button type="button" className="ec-session" onClick={() => open(s)}>
                  <span className="ec-session-mark"><Icon name="message" size={14} /></span>
                  <span className="ec-session-body">
                    <span className="ec-session-title">{title}</span>
                    <span className="ec-session-meta">
                      <span>{relative(s.updatedAt, locale)}</span>
                      {s.messageCount != null && (
                        <span>
                          {" · "}
                          {t(locale, `${s.messageCount} повідомл.`, `${s.messageCount} messages`)}
                        </span>
                      )}
                    </span>
                  </span>
                  {name ? (
                    <span className="ec-ctxchip ec-ctxchip-sm">
                      <Icon name="patient" size={11} />
                      <span>{name}</span>
                    </span>
                  ) : (
                    <span className="ec-note ec-note-sm">{t(locale, "без пацієнта", "no patient")}</span>
                  )}
                  <Icon name="chevRight" size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
