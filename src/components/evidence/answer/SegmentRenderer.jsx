// SegmentRenderer.jsx — one segment, drawn (rule FE7), EVA-S04.
//
// EXPORTED FOR REUSE, and that is its point. Every evidence surface after this
// one — the patient-context answer (S06), the drug card (S10), the deep-trace
// report (S07) — renders the same six kinds, and each of them renders them by
// importing this component, not by writing its own. A second implementation of
// "what does an `uncertainty` segment look like" is how a platform ends up
// telling a clinician that a hedge is a finding on one screen and a warning on
// another.
//
// The mapping itself is NOT here: it is data in `segmentKinds.js`, so the
// clipboard formatter and the drawer can read the same labels without
// importing React. This file is the drawing.
//
// ACCESSIBILITY. The kind is announced three ways and carried by colour last:
// an icon, a visible text label, and a `data-kind` attribute the tests assert
// on. A reader who cannot distinguish the tokens loses nothing.

import React from "react";
import { Icon } from "../../UI.jsx";
import { useI18n } from "../../../i18n.js";
import { CitationChip } from "./CitationChip.jsx";
import { EvidenceBadge } from "./EvidenceBadge.jsx";
import { kindClass, kindStyle } from "./segmentKinds.js";
import { resolveCitations } from "./sourceView.js";

export function SegmentRenderer({ segment, sources, onOpenSource }) {
  const { t } = useI18n();
  if (!segment) return null;
  const style = kindStyle(segment.kind);
  const citations = resolveCitations(segment, sources);

  return (
    <li className={kindClass(segment.kind)} data-kind={segment.kind} data-testid="answer-segment">
      <span className="evd-kind-label">
        <Icon name={style.icon} size={13} />
        {/* The label is text, not a title attribute: a tooltip is invisible to
            touch, to print, and to anyone who does not hover. */}
        <span className="evd-kind-name">{t(style.labelKey)}</span>
        {segment.strength && <EvidenceBadge tier={segment.strength} />}
      </span>
      <p className="evd-seg-text">
        {segment.text}
        {citations.length > 0 && (
          <span className="evd-cites">
            {citations.map((c, i) => (
              <CitationChip
                key={`${c.source_id}-${i}`}
                citation={c}
                onOpen={onOpenSource}
              />
            ))}
          </span>
        )}
      </p>
    </li>
  );
}

/**
 * A list of segments. Exported alongside the single renderer because every
 * caller so far wants the list, and the `<ol>` semantics (a numbered sequence
 * of statements, read in order) belong with the thing that knows them.
 */
export function SegmentList({ segments, sources, onOpenSource, testId }) {
  if (!segments || segments.length === 0) return null;
  return (
    <ol className="evd-segments" data-testid={testId}>
      {segments.map((s, i) => (
        <SegmentRenderer
          key={s.id || i}
          segment={s}
          sources={sources}
          onOpenSource={onOpenSource}
        />
      ))}
    </ol>
  );
}
