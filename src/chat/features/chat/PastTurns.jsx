// chat/features/chat/PastTurns.jsx — the conversation above the current answer.
//
// Earlier exchanges are context, not the thing being read: they collapse to the
// question and the recommendation, with the source count still visible so the
// reader can tell a well-supported earlier answer from a thin one. Expanding
// restores the full text.
//
// Each card keeps the patient it was asked under. In a thread where context was
// attached halfway through, "which of these answers knew about the patient" is
// the question a reader will actually have.

import React, { useState } from "react";
import { Icon } from "../../ui/Icon.jsx";
import { citedSources } from "../../citations.js";
import { t } from "../../i18n.js";

// Collapsed turns drop the [n] markers. Rendering them as chips here would give
// the reader citations that lead nowhere (the sources tab belongs to the
// current answer), and leaving them as bare "[1]" reads as broken markup — the
// source count below the card is the honest summary.
const withoutMarkers = (text) => String(text || "").replace(/\s*\[\d{1,2}\]/g, "");

function Turn({ question, message, locale }) {
  const [open, setOpen] = useState(false);
  const answer = message?.answer;
  const sources = citedSources(answer?.citations);
  const body = answer
    ? (open ? [answer.recommendation, answer.summary].filter(Boolean).join("\n\n") : answer.recommendation)
    : message?.text;

  return (
    <li className="ec-past">
      <div className="ec-past-q">
        <span className="ec-past-mark">Q</span>
        <span>{question}</span>
      </div>
      {body && (
        <div className="ec-past-a">
          {withoutMarkers(body).split(/\n{2,}/).map((p, i) => <p className="ec-prose" key={i}>{p}</p>)}
        </div>
      )}
      <div className="ec-past-foot">
        {sources.length > 0 && (
          <span className="ec-note ec-note-sm">
            {t(locale, `${sources.length} джерел`, `${sources.length} sources`)}
          </span>
        )}
        {message?.status === "stopped" && (
          <span className="ec-note ec-note-sm">{t(locale, "зупинено", "stopped")}</span>
        )}
        {answer?.summary && (
          <button type="button" className="ec-linkbtn" onClick={() => setOpen((v) => !v)}>
            <Icon name={open ? "chevUp" : "chevDown"} size={12} />
            <span>{open ? t(locale, "Згорнути", "Show less") : t(locale, "Показати повністю", "Show full answer")}</span>
          </button>
        )}
      </div>
    </li>
  );
}

// Pairs the thread into (question, answer) turns. A trailing question with no
// answer yet is the live one and is rendered by the document view, not here.
export function PastTurns({ messages, locale = "en" }) {
  const turns = [];
  for (let i = 0; i < messages.length; i += 1) {
    const m = messages[i];
    if (m.role !== "user") continue;
    const next = messages[i + 1];
    if (next && next.role === "assistant") turns.push({ question: m.text, message: next });
  }
  if (turns.length === 0) return null;

  return (
    <ol className="ec-pasts">
      {turns.map((turn, i) => (
        <Turn key={turn.message.id || i} question={turn.question} message={turn.message} locale={locale} />
      ))}
    </ol>
  );
}
