// chat/features/chat/AnswerDocument.jsx — the answer, as something to read.
//
// The layout is the argument, so it carries as little furniture as possible:
//
//   question            the heading — what was asked
//   meta                who it was about, how many sources, grade, confidence
//   ── tabs ──          Answer · Sources (n)
//   lead                the recommendation, set larger. No "RECOMMENDATION"
//                       label: a heading over one paragraph tells the reader
//                       nothing the paragraph doesn't.
//   body                what the evidence says, at reading size
//   limits              what it does not cover — recessive, never removed
//   follow-ups          three chips, at the end
//
// What was taken out and why:
//  · the sources strip — the Sources tab already holds them, and two source
//    surfaces on one screen means neither is *the* one;
//  · the section headings over each paragraph — four uppercase labels competing
//    with four paragraphs;
//  · the extracted-entity chips — pipeline detail, visible while it runs, noise
//    once the answer is here;
//  · the actions — lifted to a bar above the ask box, where they stay reachable
//    after a long answer (see AnswerActions).

import React, { useMemo, useState } from "react";
import { Icon } from "../../ui/Icon.jsx";
import { CitationChip } from "./CitationChip.jsx";
import { ReferenceCard } from "./ReferenceCard.jsx";
import { StageProgress } from "./StageProgress.jsx";
import { segmentAnswer, citedSources } from "../../citations.js";
import { t } from "../../i18n.js";

// Prose with [n] markers → text runs and citation chips.
function Prose({ text, citations, onCite, activeId, locale, answerLanguage, className = "" }) {
  const paragraphs = String(text || "").split(/\n{2,}/).filter(Boolean);
  return (
    <>
      {paragraphs.map((para, pi) => (
        <p className={`ec-prose ${className}`} key={pi}>
          {segmentAnswer(para, citations).map((part, i) => (
            part.type === "text"
              ? <span key={i}>{part.value}</span>
              : (
                <CitationChip
                  key={i}
                  index={part.index}
                  evidence={part.evidence}
                  active={activeId === part.evidence.id}
                  onSelect={onCite}
                  locale={locale}
                  answerLanguage={answerLanguage}
                />
              )
          ))}
        </p>
      ))}
    </>
  );
}

export function AnswerDocument({
  question,
  message,
  patientName,
  onCiteFollowUp,
  locale = "en",
  answerLanguage = "en",
  evidenceDetail = "full",
}) {
  const [tab, setTab] = useState("answer");
  const [highlighted, setHighlighted] = useState(null);

  const answer = message?.answer || null;
  const streaming = message?.status === "streaming";
  const sources = useMemo(() => citedSources(answer?.citations), [answer]);

  const openSource = (evidence) => {
    setTab("sources");
    setHighlighted(evidence.id);
  };

  const tabs = [
    { key: "answer", icon: "sparkle", uk: "Відповідь", en: "Answer" },
    ...(sources.length
      ? [{ key: "sources", icon: "book", uk: "Джерела", en: "Sources", count: sources.length }]
      : []),
  ];

  const confidenceBand = answer && (answer.confidence >= 0.85 ? "high" : answer.confidence >= 0.7 ? "mid" : "low");

  return (
    <article className="ec-doc">
      <header className="ec-doc-h">
        <h1 className="ec-doc-q">{question}</h1>
        {answer && !answer.abstained && (
          <div className="ec-doc-meta">
            {patientName && (
              <span className="ec-ctxchip ec-ctxchip-sm">
                <Icon name="patient" size={11} />
                <span>{patientName}</span>
              </span>
            )}
            <span>{t(locale, `${sources.length} джерел`, `${sources.length} sources`)}</span>
            {answer.grade && (
              <>
                <span className="ec-dot">·</span>
                <span className="ec-pill ec-level"
                      data-strength={answer.grade.startsWith("I") && answer.grade !== "IV" ? "high" : "low"}>
                  {t(locale, "Доказовість", "Evidence")} {answer.grade}
                </span>
              </>
            )}
            {/* Confidence sits in the meta line, not in a chip row under the
                recommendation: it qualifies the whole answer, and one row of
                metadata reads faster than two. */}
            <span className="ec-pill ec-conf" data-band={confidenceBand}
                  title={t(locale, "Впевненість у відповіді", "Answer confidence")}>
              {t(locale, "Впевненість", "Confidence")} {answer.confidence.toFixed(2)}
            </span>
          </div>
        )}
      </header>

      {streaming && !message.text && (
        <StageProgress stage={message.stage} entities={message.entities} locale={locale} />
      )}

      {!!answer && !answer.abstained && (
        <div className="ec-tabs" role="tablist">
          {tabs.map((x) => (
            <button
              key={x.key}
              type="button"
              role="tab"
              aria-selected={tab === x.key}
              className={`ec-tab${tab === x.key ? " on" : ""}`}
              onClick={() => setTab(x.key)}
            >
              <Icon name={x.icon} size={13} />
              <span>{t(locale, x.uk, x.en)}</span>
              {x.count != null && <span className="ec-count">{x.count}</span>}
            </button>
          ))}
        </div>
      )}

      {tab === "answer" && (
        <div className="ec-doc-body">
          {/* Abstention is styled as information, not as an error: refusing to
              answer from an evidence gap is the system being honest. */}
          {answer?.abstained && (
            <div className="ec-abstain" role="status">
              <Icon name="info" size={14} />
              <div>
                <p className="ec-abstain-t">{answer.recommendation}</p>
                <p className="ec-abstain-b">{answer.summary}</p>
              </div>
            </div>
          )}

          {streaming && message.text && (
            <>
              <Prose text={message.text} citations={[]} locale={locale}
                     answerLanguage={answerLanguage} className="ec-lead-p" />
              <span className="ec-caret" aria-hidden="true" />
            </>
          )}

          {message?.status === "stopped" && (
            <div className="ec-turn-note" data-tone="warn">
              <Icon name="alert" size={12} />
              <span>{t(locale, "Відповідь зупинено — вона неповна.", "Stopped — this answer is incomplete.")}</span>
            </div>
          )}

          {answer && !answer.abstained && (
            <>
              <Prose
                text={answer.recommendation}
                citations={answer.citations}
                onCite={openSource}
                activeId={highlighted}
                locale={locale}
                answerLanguage={answerLanguage}
                className="ec-lead-p"
              />

              <Prose
                text={answer.summary}
                citations={answer.citations}
                onCite={openSource}
                activeId={highlighted}
                locale={locale}
                answerLanguage={answerLanguage}
              />

              {answer.limitations && (
                <aside className="ec-limits">
                  <Icon name="alert" size={13} />
                  <div>
                    <span className="ec-limits-l">{t(locale, "Обмеження", "Limitations")}</span>
                    <Prose
                      text={answer.limitations}
                      citations={answer.citations}
                      onCite={openSource}
                      activeId={highlighted}
                      locale={locale}
                      answerLanguage={answerLanguage}
                    />
                  </div>
                </aside>
              )}

              {answer.followUps?.length > 0 && (
                <div className="ec-followups">
                  {answer.followUps.map((q) => (
                    <button key={q} type="button" className="ec-followup" onClick={() => onCiteFollowUp?.(q)}>
                      <span>{q}</span>
                      <Icon name="chevRight" size={12} />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === "sources" && (
        <ol className="ec-refs">
          {sources.map((s) => (
            <ReferenceCard
              key={s.id}
              source={s}
              index={s.index}
              highlighted={highlighted === s.id}
              locale={locale}
              answerLanguage={answerLanguage}
              detail={evidenceDetail}
            />
          ))}
        </ol>
      )}
    </article>
  );
}
