// legalBasis.js — sprint 11 step 06: the retained-item basis → text map for
// the erasure execution report.
//
// MUST stay in lockstep with the backend's basis strings
// (services/core-service/src/core_service/erasure/fanout.py BASIS_*).
// The honesty fallback: an UNKNOWN basis renders the raw string — a
// retained item is never hidden or prettified away. The unit test
// enumerates the known set so drift fails loudly.

export const LEGAL_BASIS_TEXT = {
  "retention:clinical_record_signed": {
    uk: "Підписаний медичний звіт — обов'язковий строк зберігання клінічної документації",
    en: "Signed clinical report — statutory clinical-record retention period",
  },
  "retention:consent_record": {
    uk: "Запис про згоду — доказ правової підстави обробки зберігається",
    en: "Consent record — evidence of the lawful basis of processing is retained",
  },
  "retention:qualified_signature": {
    uk: "Кваліфікований електронний підпис — конверт підпису зберігається як юридичний доказ",
    en: "Qualified electronic signature — the signature envelope is retained as legal evidence",
  },
  "retention:erasure_paper_trail": {
    uk: "Слід виконання видалення — сам запит і звіт про виконання зберігаються",
    en: "Erasure paper trail — the request and its execution report are retained",
  },
};

export function legalBasisText(basis, lang = "uk") {
  const row = LEGAL_BASIS_TEXT[basis];
  if (!row) return String(basis || ""); // unknown → raw, NEVER hidden
  return row[lang] || row.uk;
}
