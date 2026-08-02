// chat/ui/Bits.jsx — the small repeated pieces: avatars, source-type and
// evidence-level markers, the disclaimer banner.

import React from "react";
import { Icon } from "./Icon.jsx";
import { t } from "../i18n.js";

export function Avatar({ name, size = 26, tone = "user" }) {
  const initials = String(name || "?")
    .replace(/^(Dr\.?|Prof\.?)\s+/i, "")
    .split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className="ec-avatar" data-tone={tone} style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}>
      {initials}
    </span>
  );
}

// ── source type ───────────────────────────────────────────────────────────
// Each type gets an icon AND a word. A reader deciding how much weight to give
// a source should never have to decode a colour to learn it is a review rather
// than an RCT.
const SOURCE_TYPE = {
  guideline: { icon: "book", uk: "Настанова", en: "Guideline", de: "Leitlinie" },
  rct: { icon: "flask", uk: "РКД", en: "RCT", de: "RCT" },
  "meta-analysis": { icon: "layers", uk: "Метааналіз", en: "Meta-analysis", de: "Metaanalyse" },
  review: { icon: "eye", uk: "Огляд", en: "Review", de: "Übersicht" },
};

export function sourceTypeLabel(type, locale, answerLanguage) {
  const s = SOURCE_TYPE[type];
  if (!s) return String(type || "—");
  if (answerLanguage === "de") return s.de;
  return t(locale, s.uk, s.en);
}

export function SourceTypePill({ type, locale = "en", answerLanguage = "en" }) {
  const s = SOURCE_TYPE[type];
  return (
    <span className="ec-pill" data-kind={type}>
      <Icon name={s?.icon || "book"} size={11} />
      <span>{sourceTypeLabel(type, locale, answerLanguage)}</span>
    </span>
  );
}

// ── evidence level ────────────────────────────────────────────────────────
// Ia/Ib are the strong tiers, IV the weakest. The tone is a supporting signal;
// the level itself is always spelled out, and the title attribute says what the
// roman numeral means for anyone who does not read them daily. Exported for
// the explanation memo (EvidenceInfoDialog), which must use the same words.
export const LEVEL_MEANING = {
  Ia: { uk: "метааналіз РКД", en: "meta-analysis of RCTs" },
  Ib: { uk: "щонайменше одне РКД", en: "at least one RCT" },
  IIa: { uk: "контрольоване дослідження без рандомізації", en: "controlled study without randomisation" },
  IIb: { uk: "квазіекспериментальне дослідження", en: "quasi-experimental study" },
  III: { uk: "описове дослідження", en: "descriptive study" },
  IV: { uk: "думка експертів", en: "expert opinion" },
};

export function EvidenceLevelPill({ level, locale = "en", onInfo }) {
  const strong = level === "Ia" || level === "Ib";
  const meaning = LEVEL_MEANING[level];
  const title = meaning
    ? `${t(locale, "Рівень", "Level")} ${level} — ${t(locale, meaning.uk, meaning.en)}`
    : undefined;
  const body = <>{t(locale, "Рівень", "Level")} {level}</>;
  // With an onInfo handler the pill opens the explanation memo; without one
  // it stays inert text — a pill that looks clickable but does nothing
  // teaches the reader to stop clicking. A role="button" span rather than a
  // <button>: the pill sits inside ReferenceCard's expand/collapse button,
  // and a button nested in a button is invalid HTML.
  if (!onInfo) {
    return (
      <span className="ec-pill ec-level" data-strength={strong ? "high" : "low"} title={title}>
        {body}
      </span>
    );
  }
  const open = (e) => { e.stopPropagation(); onInfo(level); };
  const clickHint = t(locale, "Натисніть для пояснення.", "Click for the explanation.");
  return (
    <span
      role="button"
      tabIndex={0}
      className="ec-pill ec-pill-btn ec-level"
      data-strength={strong ? "high" : "low"}
      title={title ? `${title}. ${clickHint}` : clickHint}
      onClick={open}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(e); } }}
    >
      {body}
      <Icon name="info" size={10} />
    </span>
  );
}

// ── disclaimer ────────────────────────────────────────────────────────────
// Permanent, not dismissible. This module answers clinical questions from a
// fixture set with no model and no retrieval behind it; anyone reading it needs
// to know that at the moment they read the answer, not in a changelog.
export function DisclaimerBanner({ locale = "en" }) {
  return (
    <div className="ec-disclaimer" role="note">
      <Icon name="info" size={13} />
      <span>
        {t(
          locale,
          "Демо-збірка: відповіді — це фіксовані приклади, не згенеровані та не клінічна порада. Рішення приймає лікар.",
          "Demo build: answers are fixtures — not generated, not clinical advice. Clinical judgement stays with the clinician.",
        )}
      </span>
    </div>
  );
}
