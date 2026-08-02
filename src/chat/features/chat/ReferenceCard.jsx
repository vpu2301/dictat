// chat/features/chat/ReferenceCard.jsx — one source, collapsed to what decides
// its weight and expandable to the rest.
//
// Collapsed shows: number, title, publisher, study type, year, evidence level,
// recommendation grade. That is the set a clinician uses to decide how much a
// claim is worth before reading anything. The expansion carries the summary and
// the identifiers (PMID, DOI, registry number) that make it findable.
//
// Highlighted state exists because clicking a [n] chip in the answer must land
// visibly on the matching card — an evidence link that "works" but leaves the
// reader hunting has not worked.

import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../../ui/Icon.jsx";
import { SourceTypePill, EvidenceLevelPill } from "../../ui/Bits.jsx";
import { t } from "../../i18n.js";

export function ReferenceCard({ source, index, highlighted, locale = "en", answerLanguage = "en", detail = "full", onEvidenceInfo }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (highlighted) {
      setOpen(true);
      ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [highlighted]);

  const identifiers = [
    source.pmid ? `PMID ${source.pmid}` : null,
    source.doi ? `DOI ${source.doi}` : null,
    source.registry ? `${t(locale, "Реєстр", "Registry")} ${source.registry}` : null,
    source.journal || null,
  ].filter(Boolean);

  return (
    <li className={`ec-ref${highlighted ? " on" : ""}`} ref={ref}>
      <button type="button" className="ec-ref-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="ec-ref-n">{index}</span>
        <span className="ec-ref-main">
          <span className="ec-ref-title">{source.title}</span>
          <span className="ec-ref-meta">
            <span className="ec-ref-pub">{source.source}</span>
            <SourceTypePill type={source.sourceType} locale={locale} answerLanguage={answerLanguage} />
            <span className="ec-ref-year">{source.year}</span>
            <EvidenceLevelPill level={source.evidenceLevel} locale={locale} onInfo={onEvidenceInfo} />
            {source.recommendationGrade && (
              <span className="ec-pill" title={t(locale, "Ступінь рекомендації", "Recommendation grade")}>
                {t(locale, "Рек.", "Rec.")} {source.recommendationGrade}
              </span>
            )}
          </span>
        </span>
        <Icon name={open ? "chevUp" : "chevDown"} size={13} />
      </button>

      {open && detail === "full" && (
        <div className="ec-ref-body">
          <p className="ec-ref-sum">{source.summary}</p>
          {identifiers.length > 0 && (
            <div className="ec-ref-ids">
              {identifiers.map((id) => <span className="ec-mono ec-ref-id" key={id}>{id}</span>)}
            </div>
          )}
          {/* Not an <a href>: opening a real source is the host's call, and a
              "#" href would navigate the host page out from under the module. */}
          <span className="ec-ref-link">
            <Icon name="link" size={11} />
            <span>{t(locale, "Посилання — демо", "Link — demo only")}</span>
          </span>
        </div>
      )}
    </li>
  );
}
