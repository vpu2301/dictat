// AnswerView.jsx — the answer, in three areas (EVA-S04).
//
//   summary   what the answer is, in a few segments, read first
//   detail    the working, read when the summary is not enough
//   sources   who says so — a strip that opens the drawer
//
// ONE RENDER PATH FOR TWO ORIGINS. A streaming answer and a reopened one both
// arrive here as an `AnswerEnvelope` (answerEnvelope.js assembles the first,
// `GET /answers/:id` returns the second) and this component cannot tell them
// apart. That is what makes AC-S04-F-3's "reopen equality" a property of the
// code rather than a coincidence the test happens to catch: `streaming` only
// governs shimmer and the live region, never structure.
//
// ── The live region ───────────────────────────────────────────────────────
// `aria-live="polite"` on a streaming answer, announcing COMPLETED SEGMENTS,
// not tokens. A region that re-announces on every token turns a screen reader
// into an unusable stutter; announcing per segment means a reader hears
// "Evidence: metformin remains first line" once, when it is true and whole.

import React, { useState } from "react";
import { Empty } from "../../UI.jsx";
import { ApiErrorView } from "../../ApiErrorView.jsx";
import { useI18n } from "../../../i18n.js";
import { AnswerActions } from "./AnswerActions.jsx";
import { DeflectionCard } from "./DeflectionCard.jsx";
import { SegmentList } from "./SegmentRenderer.jsx";
import { SourceListDrawer } from "./SourceListDrawer.jsx";
import { UnverifiedBanner } from "./UnverifiedBanner.jsx";
import { WebSourceBadge } from "./WebSourceBadge.jsx";
import { groupSources, sourceLabel } from "./sourceView.js";

/** The shimmer that stands where the summary will be. Three lines, no spinner. */
function SummaryShimmer() {
  return (
    <div className="evd-shimmer" aria-hidden="true" data-testid="summary-shimmer">
      <span /><span /><span />
    </div>
  );
}

/**
 * A drop, an overload, or a stream error. All three are recoverable and the
 * recovery differs, so the card says which one it is offering.
 */
function StreamError({ stream }) {
  const { t } = useI18n();
  const { error, resumable, overloaded, retryAfterS } = stream;
  const [waiting, setWaiting] = useState(overloaded ? retryAfterS : 0);

  React.useEffect(() => {
    if (!overloaded) return undefined;
    setWaiting(retryAfterS);
    const id = setInterval(() => setWaiting((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [overloaded, retryAfterS]);

  const isDrop = error?.code === "stream_dropped" || error?.code === "stream_dropped_no_id";

  return (
    <div className="evd-answer-error" role="alert" data-testid="stream-error"
         data-code={error?.code || "unknown"}>
      {isDrop ? (
        <>
          <p className="evd-answer-error-title">{t("answer.connection_lost")}</p>
          <p className="evd-note">
            {resumable ? t("answer.resume_hint") : t("answer.resume_unavailable")}
          </p>
          <button type="button" className="btn accent" onClick={stream.resume}
                  data-testid="resume">
            {resumable ? t("answer.resume") : t("answer.ask_again")}
          </button>
        </>
      ) : overloaded ? (
        <>
          <p className="evd-answer-error-title">{t("answer.overloaded")}</p>
          <p className="evd-note">{t("answer.overloaded_body")}</p>
          <button type="button" className="btn accent" onClick={stream.retry}
                  disabled={waiting > 0} data-testid="retry-countdown">
            {waiting > 0 ? t("answer.retry_in", { n: waiting }) : t("answer.retry")}
          </button>
        </>
      ) : (
        <>
          {/* An ApiError renders through the shared view so the correlation id
              is copyable here exactly as it is everywhere else in dictat. */}
          {error?.status !== undefined
            ? <ApiErrorView error={error} lang="en" />
            : <p className="evd-answer-error-title">{error?.message || t("answer.failed")}</p>}
          <button type="button" className="btn" onClick={stream.retry} data-testid="retry">
            {t("answer.retry")}
          </button>
        </>
      )}
    </div>
  );
}

export function AnswerView({ stream }) {
  const { t } = useI18n();
  const [drawerFor, setDrawerFor] = useState(null);   // source id, or null

  const { state, envelope, streaming, resuming, lateSourcesPending, hasContent, error } = stream;
  const summary = envelope.summary_segments;
  const detail = envelope.detail_segments;
  const groups = groupSources(envelope.sources);
  const webUnavailable = state.notices.some((n) => n.code === "web_unavailable");

  // Nothing asked yet.
  if (!state.question && !state.answer_id) return null;

  return (
    <section className="evd-answer" aria-label={t("answer.region")} data-testid="answer-view"
             data-streaming={String(streaming)}>
      {/* The question echoes INSTANTLY, before any request resolves: the first
          thing a person needs to see after pressing ask is that the thing they
          asked was heard, verbatim. */}
      {state.question && (
        <p className="evd-question" data-testid="question-echo">{state.question}</p>
      )}

      <UnverifiedBanner />

      {state.deflection ? (
        <DeflectionCard deflection={state.deflection} />
      ) : (
        <>
          <div
            className="evd-answer-body"
            // Live only WHILE streaming: a static answer re-announcing itself
            // on an unrelated re-render is noise a reader cannot mute.
            aria-live={streaming ? "polite" : "off"}
            aria-busy={streaming || resuming}
            data-testid="answer-body"
          >
            {resuming && (
              <p className="evd-updating" role="status" data-testid="resuming">{t("answer.resuming")}</p>
            )}

            {summary.length === 0 && streaming && !hasContent && <SummaryShimmer />}

            <SegmentList segments={summary} sources={envelope.sources}
                         onOpenSource={setDrawerFor} testId="summary-segments" />

            {detail.length > 0 && (
              <details className="evd-detail" open>
                <summary className="evd-detail-toggle">{t("answer.detail")}</summary>
                <SegmentList segments={detail} sources={envelope.sources}
                             onOpenSource={setDrawerFor} testId="detail-segments" />
              </details>
            )}
          </div>

          {/* ── sources strip ── */}
          {(groups.length > 0 || lateSourcesPending || webUnavailable) && (
            <div className="evd-sources-strip" data-testid="sources-strip">
              <span className="evd-sources-label">{t("answer.sources")}</span>
              {groups.flatMap((g) =>
                g.items.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="evd-source-chip"
                    data-kind={s.kind}
                    data-source-id={s.id}
                    data-testid="source-chip"
                    aria-label={t("answer.citation_label", { n: s.number, title: sourceLabel(s) })}
                    onClick={() => setDrawerFor(s.id)}
                  >
                    <span aria-hidden="true">[{s.number}]</span>
                    <span className="evd-source-chip-title">{sourceLabel(s)}</span>
                    {s.kind === "web" && <WebSourceBadge source={s} />}
                  </button>
                )),
              )}
              {lateSourcesPending && (
                <span className="evd-late-chip" role="status" data-testid="late-sources">
                  {t("answer.checking_web")}
                </span>
              )}
              {/* Corpus-only is INFORMATION, not a failure: the answer stands,
                  it just has no web sources behind it and the reader should
                  know that rather than assume none were looked for. */}
              {webUnavailable && (
                <span className="evd-notice-chip" data-testid="web-unavailable">
                  {t("answer.web_unavailable")}
                </span>
              )}
            </div>
          )}

          {/* Nothing at all, and the stream is over: the service answered and
              had nothing. Distinct from an error, and distinct from a
              deflection — this is `insufficient_basis`. */}
          {!streaming && !resuming && !error && state.done && !hasContent && (
            <div data-testid="insufficient-basis">
              <Empty icon="search" title={t("answer.insufficient_title")} body={t("answer.insufficient_body")} />
            </div>
          )}
        </>
      )}

      {error && <StreamError stream={stream} />}

      {!streaming && !resuming && (hasContent || state.deflection) && (
        <AnswerActions question={state.question} envelope={envelope} deflection={state.deflection} />
      )}

      {drawerFor && (
        <SourceListDrawer
          sources={envelope.sources}
          focusSourceId={drawerFor}
          onClose={() => setDrawerFor(null)}
        />
      )}
    </section>
  );
}
