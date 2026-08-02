// degraded.js — what we say when the recording is not there (sprint 15).
//
// Split out of ReplayStrip.jsx so it is unit-testable under `node --test`: the
// honesty taxonomy is the part of replay most worth pinning down, because every
// one of these codes is a DIFFERENT fact about the world and collapsing them
// into "something went wrong" is exactly the failure this sprint exists to
// avoid. ADR-0037 defines the codes; this file defines what a clinician reads.

import { tr } from "../i18n.js";

export function degradedCopy(err, lang) {
  const { kind, code, retryAfterSec } = err || {};

  if (kind === "rate_limited") {
    const mins = retryAfterSec ? Math.max(1, Math.ceil(retryAfterSec / 60)) : null;
    return mins
      ? tr(lang,
          `Досягнуто ліміт прослуховувань. Спробуйте за ${mins} хв.`,
          `Playback limit reached. Try again in ${mins} min.`)
      : tr(lang,
          "Досягнуто ліміт прослуховувань на цю годину. Спробуйте трохи пізніше.",
          "Playback limit reached for this hour. Try again a little later.");
  }
  if (kind === "expired") {
    return tr(lang,
      "Посилання на фрагмент застаріло — торкніться ще раз, щоб отримати нове.",
      "The clip link expired — tap again for a fresh one.");
  }
  if (kind === "too_long") {
    return tr(lang,
      "Фрагмент задовгий для прослуховування — відтворення призначене для перевірки, не для експорту.",
      "That span is too long to replay — replay is for review, not export.");
  }
  if (kind === "forbidden") {
    return tr(lang,
      "Немає доступу до запису цього звіту.",
      "No access to this report's recording.");
  }
  if (kind === "gone") {
    if (code === "no_audio_source") {
      return tr(lang,
        "До цього звіту не прикріплено запису.",
        "This report has no recording attached.");
    }
    if (code === "audio_not_retained") {
      return tr(lang,
        "Запис більше не зберігається — сплив термін зберігання аудіо.",
        "The recording is no longer retained — the audio retention window has passed.");
    }
    if (code === "audio_partially_retained") {
      return tr(lang,
        "Цю частину сесії не збережено — доступний лише пізніший фрагмент запису.",
        "This part of the session was not retained — only a later part of the recording survives.");
    }
    return tr(lang,
      "Запис видалено (термін зберігання або запит на стирання).",
      "The recording has been deleted (retention or an erasure request).");
  }
  return tr(lang,
    "Не вдалося відтворити запис.",
    "The recording could not be played.");
}
