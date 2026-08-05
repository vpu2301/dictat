// dictation/languages.js — which language you can dictate in, and where.
//
// "The language" is three different questions in this product, and they have
// three different answers. Hard-coding `uk`/`en` in a dozen selects hid that;
// adding German is what made it impossible to keep hiding.
//
//   DICTATION  — live speech: the browser recogniser, the dictation-service
//                WebSocket (protocol/messages.py: LANGUAGE_PATTERN
//                ^(uk|en|de)$) and the NLP pipeline that punctuates it
//                (nlp-service: Literal["uk","en","de"], with _UNITS_DE).
//                → uk, en, de
//
//   UPLOAD     — a finished audio file handed to asr-service
//                (routers/jobs.py: Form(pattern="^(uk|en)$"), and the same
//                pattern on /asr/prompts). German audio is REFUSED there today;
//                offering it in the picker would only produce a 422.
//                → uk, en
//
//   TEMPLATES  — report-service content: templates, search tips, synonyms,
//                synthesis, PDF rendering are all enum ["uk","en"].
//                → uk, en
//
// The UI language is a fourth, separate thing (i18n.js LANGS — eight of them).
// A clinician reading the interface in Polish still dictates in one of the
// three above, which is why `asDictationLang` exists rather than passing the UI
// locale to the socket and hoping.

export const DICTATION_LANGS = [
  { code: "uk", short: "UK", speech: "uk-UA", label: { uk: "Українська", en: "Ukrainian", de: "Ukrainisch" } },
  { code: "en", short: "EN", speech: "en-US", label: { uk: "Англійська", en: "English", de: "Englisch" } },
  { code: "de", short: "DE", speech: "de-DE", label: { uk: "Німецька", en: "German", de: "Deutsch" } },
];

export const DICTATION_CODES = DICTATION_LANGS.map((l) => l.code);
// asr-service and report-service, as of the committed contracts. Keep these
// named — a bare ["uk","en"] in a component is a limitation nobody can see.
export const UPLOAD_CODES = ["uk", "en"];
export const TEMPLATE_CODES = ["uk", "en"];

export function dictationLang(code) {
  return DICTATION_LANGS.find((l) => l.code === code) || DICTATION_LANGS[0];
}

// The recogniser wants a full BCP-47 tag; everything else in the app speaks the
// two-letter code.
export function speechLocale(code) {
  return dictationLang(code).speech;
}

export function langLabel(code, uiLang = "uk") {
  const l = dictationLang(code);
  return l.label[uiLang] || l.label.en;
}

// A UI locale → the language to dictate in. German UI dictates German; the
// other five interface languages have no recogniser here yet, and English is
// the honest fallback (the alternative is sending "pl" to a socket whose
// contract is ^(uk|en|de)$ and calling the rejection a mystery).
export function asDictationLang(code) {
  return DICTATION_CODES.includes(code) ? code : (code === "uk" ? "uk" : "en");
}

// Same coercion for the two services that stop at uk|en.
export function asUploadLang(code) {
  return UPLOAD_CODES.includes(code) ? code : (code === "uk" ? "uk" : "en");
}
export function asTemplateLang(code) {
  return TEMPLATE_CODES.includes(code) ? code : (code === "uk" ? "uk" : "en");
}

// Can a finished file in this language be transcribed by asr-service today?
// Used to say so out loud in the upload form rather than offering a choice the
// server rejects.
export function supportsUpload(code) {
  return UPLOAD_CODES.includes(code);
}

// Options for a MenuSelect: [{ value, label }] in the reader's own language.
export function dictationOptions(uiLang = "uk", { short = false } = {}) {
  return DICTATION_LANGS.map((l) => ({
    value: l.code,
    label: short ? l.short : langLabel(l.code, uiLang),
    sub: short ? langLabel(l.code, uiLang) : undefined,
  }));
}
