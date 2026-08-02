// chat/features/chat/EvidenceInfoDialog.jsx — what the badges actually mean.
//
// The meta line says "Evidence Ia · Confidence 0.86" and the reference cards
// say "Level Ib". A clinician who grades papers daily reads those instantly;
// everyone else gets a memo one click away. Clicking either badge opens this
// dialog with the clicked topic in focus and the reader's own value
// highlighted in its scale — an abstract legend is harder to trust than
// "here is YOUR answer's row".
//
// Deliberately explanation-only: no settings, no links out, one Close button.
// The numbers are the same vocabulary the pills use (LEVEL_MEANING in
// ui/Bits.jsx and the band cut-offs in AnswerDocument) — imported, not
// copied, so the memo can never drift from the badges it explains.

import React, { useEffect } from "react";
import { Icon } from "../../ui/Icon.jsx";
import { ModalLayer } from "../../ui/ModalLayer.jsx";
import { useEmbed } from "../../EmbedContext.jsx";
import { LEVEL_MEANING } from "../../ui/Bits.jsx";
import { confidenceBandOf } from "../../citations.js";
import { t } from "../../i18n.js";

const LEVEL_ORDER = ["Ia", "Ib", "IIa", "IIb", "III", "IV"];

const BANDS = [
  {
    key: "high",
    range: "≥ 0.85",
    uk: "Висока — джерела узгоджено підтримують відповідь.",
    en: "High — the sources consistently support the answer.",
  },
  {
    key: "mid",
    range: "0.70 – 0.84",
    uk: "Помірна — підтримка суттєва, але з прогалинами чи розбіжностями.",
    en: "Moderate — solid support, with gaps or some disagreement.",
  },
  {
    key: "low",
    range: "< 0.70",
    uk: "Низька — доказів мало або вони суперечливі; перевірте джерела.",
    en: "Low — evidence is thin or conflicting; check the sources yourself.",
  },
];

export function EvidenceInfoDialog({
  topic = "evidence", // "evidence" | "confidence" — which badge was clicked
  level = null, // the answer's (or source's) grade, e.g. "Ia"
  confidence = null, // the answer's score, 0..1, or null
  locale = "en",
  onClose,
}) {
  const { modal } = useEmbed();

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const band = confidence != null ? confidenceBandOf(confidence) : null;

  return (
    <ModalLayer {...modal}>
    <div className="ec-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ec-dialog" role="dialog" aria-modal="true" aria-labelledby="ec-evinfo-title">
        <div className="ec-modal-h">
          <h2 id="ec-evinfo-title">{t(locale, "Як читати позначки", "How to read the badges")}</h2>
          <p>{t(locale,
            "Дві шкали біля кожної відповіді: якою є доказова база і наскільки джерела її підтримують.",
            "Two scales next to every answer: what the evidence base is, and how well the sources back it.")}</p>
        </div>

        <div className="ec-modal-b">
          <section className="ec-memo-sec" data-focus={topic === "evidence" || undefined}>
            <h3 className="ec-memo-t">
              <Icon name="book" size={13} />
              {t(locale, "Рівень доказовості (Ia–IV)", "Evidence level (Ia–IV)")}
            </h3>
            <p className="ec-memo-p">{t(locale,
              "Каже, ЗВІДКИ висновок: який дизайн досліджень стоїть за твердженням. Ia — найсильніший, IV — найслабший. Це властивість джерел, а не впевненість системи.",
              "Says WHERE a claim comes from: the study design behind it. Ia is the strongest tier, IV the weakest. It is a property of the sources, not of the system's certainty.")}</p>
            <div className="ec-memo-rows">
              {LEVEL_ORDER.map((lv) => (
                <div key={lv} className={`ec-memo-row${level === lv ? " on" : ""}`}>
                  <span className="ec-pill ec-level" data-strength={lv === "Ia" || lv === "Ib" ? "high" : "low"}>
                    {lv}
                  </span>
                  <span>{t(locale, LEVEL_MEANING[lv].uk, LEVEL_MEANING[lv].en)}</span>
                  {level === lv && (
                    <span className="ec-memo-you">{t(locale, "ця відповідь", "this answer")}</span>
                  )}
                </div>
              ))}
            </div>
            <p className="ec-memo-p ec-memo-fine">{t(locale,
              "Рівень належить самій публікації — це стандартна класифікація дизайну дослідження, а не оцінка, яку вигадала система.",
              "The level belongs to the cited publication itself — the standard grading of its study design, not a score the system invents.")}</p>
          </section>

          <section className="ec-memo-sec" data-focus={topic === "confidence" || undefined}>
            <h3 className="ec-memo-t">
              <Icon name="sparkle" size={13} />
              {t(locale, "Впевненість (0–1)", "Confidence (0–1)")}
            </h3>
            <p className="ec-memo-p">{t(locale,
              "Каже, НАСКІЛЬКИ знайдені джерела підтримують саме цю відповідь на саме це запитання. Це не клінічна певність і не заміна вашого судження — рішення завжди за лікарем.",
              "Says HOW WELL the retrieved sources support this specific answer to this specific question. It is not clinical certainty and not a substitute for your judgement — the decision stays with the clinician.")}</p>
            <div className="ec-memo-rows">
              {BANDS.map((b) => (
                <div key={b.key} className={`ec-memo-row${band === b.key ? " on" : ""}`}>
                  <span className="ec-pill ec-conf" data-band={b.key}>{b.range}</span>
                  <span>{t(locale, b.uk, b.en)}</span>
                  {band === b.key && (
                    <span className="ec-memo-you">
                      {t(locale, "ця відповідь", "this answer")}
                      {confidence != null ? ` · ${confidence.toFixed(2)}` : ""}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <p className="ec-memo-p ec-memo-fine">{t(locale,
              "Оцінка складається з кількості незалежних джерел, їхнього рівня та узгодженості між ними. У цій демо-збірці значення — фіксовані приклади.",
              "The score reflects how many independent sources were found, their level, and how much they agree. In this demo build the values are fixtures.")}</p>
          </section>

          <section className="ec-memo-sec">
            <h3 className="ec-memo-t">
              <Icon name="check" size={13} />
              {t(locale, "Як перевірити самому", "How to verify it yourself")}
            </h3>
            <ul className="ec-memo-list">
              <li>{t(locale,
                "Кожне твердження має позначку [n] — клік веде на картку джерела з PMID/DOI, за якими публікацію можна знайти й прочитати.",
                "Every claim carries an [n] marker — clicking it lands on the source card with the PMID/DOI, so you can find and read the publication itself.")}</li>
              <li>{t(locale,
                "Розділ «Обмеження» під відповіддю каже, чого доказова база НЕ покриває — його відсутність підозріліша за його наявність.",
                "The Limitations note under the answer says what the evidence does NOT cover — its absence is more suspicious than its presence.")}</li>
              <li>{t(locale,
                "Коли доказів немає, система відмовляється відповідати замість вгадувати — відмова означає, що позначкам можна вірити, коли вони є.",
                "When evidence is missing the system abstains instead of guessing — the refusal is what makes the badges worth believing when they do appear.")}</li>
            </ul>
          </section>
        </div>

        <div className="ec-modal-f">
          <span className="ec-note ec-note-sm">{t(locale,
            "Низька впевненість — привід відкрити вкладку «Джерела», а не відхилити відповідь.",
            "Low confidence is a reason to open the Sources tab, not to dismiss the answer.")}</span>
          <button type="button" className="ec-btn ec-btn-primary" onClick={onClose}>
            {t(locale, "Зрозуміло", "Got it")}
          </button>
        </div>
      </div>
    </div>
    </ModalLayer>
  );
}
