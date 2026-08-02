// chat/features/chat/StageProgress.jsx — what the pipeline is doing right now.
//
// A spinner says "wait". This says what it is waiting FOR: classify the
// question, search the corpus, check the guidelines, synthesise, verify the
// citations. For an evidence tool that distinction is the product — a clinician
// deciding whether to trust an answer wants to know it went through guidelines
// and not only a literature index.
//
// Entities appear as soon as the classifier has run, because they are how the
// reader sees whether the question was understood at all.

import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../../ui/Icon.jsx";
import { t } from "../../i18n.js";

export const STAGE_ORDER = ["classifying", "searching", "guidelines", "synthesizing", "verifying"];

const STAGE_TEXT = {
  classifying: {
    uk: ["Аналіз запитання", "Виділяємо клінічні сутності"],
    en: ["Understanding the question", "Extracting clinical entities"],
  },
  searching: {
    uk: ["Пошук доказів", "Індекс літератури та оглядів"],
    en: ["Searching the evidence", "Literature and review index"],
  },
  guidelines: {
    uk: ["Звірка з настановами", "AWMF · ESC · Cochrane"],
    en: ["Checking guidelines", "AWMF · ESC · Cochrane"],
  },
  synthesizing: {
    uk: ["Формування відповіді", "Прив’язка тверджень до джерел"],
    en: ["Writing the answer", "Binding claims to sources"],
  },
  verifying: {
    uk: ["Перевірка цитат", "Кожне [n] має вести до джерела"],
    en: ["Verifying citations", "Every [n] must resolve to a source"],
  },
};

export function StageProgress({ stage, entities = [], locale = "en", running = true }) {
  const currentIndex = STAGE_ORDER.indexOf(stage);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(null);

  useEffect(() => {
    if (!running) return undefined;
    if (startRef.current == null) startRef.current = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 200);
    return () => clearInterval(id);
  }, [running]);

  return (
    <div className="ec-stages" role="status" aria-live="polite">
      <div className="ec-stages-h">
        <span className="ec-stages-label">{t(locale, "Обробка…", "Processing…")}</span>
        <span className="ec-mono ec-stages-time">{(elapsed / 1000).toFixed(1)}s</span>
      </div>

      {entities.length > 0 && (
        <div className="ec-entities">
          {entities.map((e) => <span className="ec-entity" key={e}>{e}</span>)}
        </div>
      )}

      <ol className="ec-stagelist">
        {STAGE_ORDER.map((s, i) => {
          const state = currentIndex < 0 ? "pending"
            : i < currentIndex ? "done"
              : i === currentIndex ? "active" : "pending";
          const [label, hint] = locale === "uk" ? STAGE_TEXT[s].uk : STAGE_TEXT[s].en;
          return (
            <li className="ec-stage" data-state={state} key={s}>
              <span className="ec-stage-dot">
                {state === "done" ? <Icon name="check" size={10} /> : <span className="ec-stage-pip" />}
              </span>
              <span className="ec-stage-body">
                <span className="ec-stage-label">{label}</span>
                {state === "active" && <span className="ec-stage-hint">{hint}</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
