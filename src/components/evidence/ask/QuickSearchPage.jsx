// QuickSearchPage.jsx — #/evidence and #/evidence/answers/:id (EVA-S04).
//
// The layout, and nothing else: AskBox → (FollowUp slot, reserved) → AnswerView.
// The stream lives in `useAnswerStream`, the envelope assembly in a pure
// reducer, the kind styling in a shared table. This file decides where things
// sit and which of the two modes it is in.
//
// TWO MODES, ONE COMPONENT:
//   ask     the route has no id. The box is live, the answer streams.
//   reopen  the route carries an answer id. The same AnswerView renders it
//           from `GET /answers/:id`, `streaming=false`, and the ask box
//           starts a NEW question rather than editing the old one — an answer
//           is a record of what was asked, and editing it in place would
//           quietly replace the thing history points at.
//
// The FollowUp slot is reserved rather than built: S05 owns the follow-up
// loop, and the envelope already carries `followups[]`. Leaving the seam here,
// empty and documented, is what stops S05 having to re-lay out this page.

import React, { useEffect, useState } from "react";
import { useI18n } from "../../../i18n.js";
import { FEATURES } from "../../../api/services.js";
import { useAnswerStream } from "../answer/useAnswerStream.js";
import { AnswerView } from "../answer/AnswerView.jsx";
import { AskBox } from "./AskBox.jsx";
import { SuggestionChips } from "./SuggestionChips.jsx";
import { recallQuestion, rememberQuestion } from "../answerTitles.js";
import "../evidence.css";

/**
 * The starter questions. Deliberately hard-coded and deliberately generic:
 * they are UI copy, they must exist with the suggestions flag off, and they
 * are the fastest way for someone opening this screen for the first time to
 * find out what kind of question it takes.
 */
const EXAMPLE_KEYS = ["ask.example_1", "ask.example_2", "ask.example_3"];

export function QuickSearchPage({ answerId, navigate }) {
  const { t, lang } = useI18n();
  const [question, setQuestion] = useState("");
  const stream = useAnswerStream({ locale: lang });

  // Reopen: hydrate from the id in the route. Keyed on the id so navigating
  // between two history entries re-fetches rather than showing the first.
  const { open, reset } = stream;
  useEffect(() => {
    if (answerId) open(answerId, recallQuestion(answerId));
    else reset();
  }, [answerId, open, reset]);

  // Once the answer has an id, note which question it belongs to, so that
  // reopening it later shows the question in the breadcrumb instead of a uuid
  // (answerTitles.js). Runs on every id change, including the reopen path,
  // which is what keeps a re-reopened answer titled.
  const { answer_id: streamedId, question: streamedQuestion } = stream.state;
  useEffect(() => {
    if (streamedId && streamedQuestion) rememberQuestion(streamedId, streamedQuestion);
  }, [streamedId, streamedQuestion]);

  const submit = (text) => {
    // Asking from a reopened answer returns to the ask route, so the URL
    // never claims to be an answer it is no longer showing.
    if (answerId) navigate("/evidence");
    setQuestion(text);
    stream.ask(text);
  };

  const examples = EXAMPLE_KEYS.map((k) => t(k));

  return (
    <div className="page evd-page evd-ask-page" data-testid="quick-search">
      <header className="evd-head">
        <h1>{t("evidence.title")}</h1>
        <p className="evd-sub">{t("evidence.subtitle")}</p>
      </header>

      <AskBox
        value={question}
        onChange={setQuestion}
        onSubmit={submit}
        streaming={stream.streaming}
        examples={stream.hasContent || stream.streaming ? [] : examples}
        onPickExample={(ex) => setQuestion(ex)}
      />

      {FEATURES.evidenceSuggestions && !stream.hasContent && !stream.streaming && (
        <SuggestionChips onPick={setQuestion} disabled={stream.streaming} />
      )}

      {/* ── FollowUp slot (S05) ──────────────────────────────────────────
          `stream.envelope.followups` is already populated by the reducer.
          S05 renders the clarifying-question loop here, between the ask box
          and the answer, because that is where a question about the question
          belongs — above the answer it would change. */}

      <AnswerView stream={stream} />
    </div>
  );
}
