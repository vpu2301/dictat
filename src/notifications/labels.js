// labels.js — human names for the closed vocabularies in constants.js.
//
// Lives outside the components because three surfaces need the same
// wording: the preferences matrix, the history page's category filter,
// and (eventually) the tenant-defaults screen. A category the client does
// not know yet falls through to its wire value rather than rendering
// blank — a newer backend category should look unfamiliar, not invisible.

import { tr } from "../i18n.js";
import { CATEGORY, EMAIL_MODE, SEVERITY } from "./constants.js";

export function categoryLabel(category, lang) {
  switch (category) {
    case CATEGORY.REPORT_FINALIZED:
      return tr(lang, "Звіт завершено", "Report finalized");
    case CATEGORY.REPORT_SIGNED:
      return tr(lang, "Звіт підписано", "Report signed");
    case CATEGORY.REPORT_SIGNING_FAILED:
      return tr(lang, "Помилка підписання", "Signing failed");
    case CATEGORY.REPORT_AMENDED:
      return tr(lang, "Звіт доповнено", "Report amended");
    case CATEGORY.REPORT_CHAIN_FAILURE:
      return tr(lang, "Порушення цілісності журналу", "Audit chain failure");
    case CATEGORY.REPORT_SHARED_WITH_YOU:
      return tr(lang, "Вам надано доступ", "Shared with you");
    case CATEGORY.DICTATION_COMPLETED:
      return tr(lang, "Диктування завершено", "Dictation completed");
    case CATEGORY.TRANSCRIPTION_COMPLETED:
      return tr(lang, "Розшифровку завершено", "Transcription completed");
    case CATEGORY.TRANSCRIPTION_FAILED:
      return tr(lang, "Помилка розшифровки", "Transcription failed");
    case CATEGORY.SYSTEM_DIGEST:
      return tr(lang, "Щоденний підсумок", "Daily digest");
    default:
      return category;
  }
}

export function emailModeLabel(mode, lang) {
  switch (mode) {
    case EMAIL_MODE.IMMEDIATE:
      return tr(lang, "Одразу", "Immediately");
    case EMAIL_MODE.DIGEST:
      return tr(lang, "У підсумку", "In the digest");
    default:
      return tr(lang, "Вимкнено", "Off");
  }
}

export function severityLabel(severity, lang) {
  switch (severity) {
    case SEVERITY.CRITICAL:
      return tr(lang, "Критичні", "Critical");
    case SEVERITY.WARNING:
      return tr(lang, "Попередження", "Warnings");
    case SEVERITY.INFO:
      return tr(lang, "Інформаційні", "Info");
    default:
      return severity;
  }
}
