// chat/data/answerMapping.js — the evidence API's answer, in this module's shape.
//
// Pure functions, no fetch and no React: everything here can be asserted in
// `answerMapping.test.js` without a browser or a running backend, which is the
// only way a wire format stays honest between two repos.
//
// The backend returns ONE markdown document (`answer_md`) plus a flat citation
// list. This module renders a structured answer — a lead recommendation, the
// evidence body, a limitations aside — because that is what a clinician scans.
// The bridge is the synthesis prompt, which pins the document to three headings
// (Recommendation / Evidence / Caveats, and their German equivalents). We parse
// those headings rather than trusting them blindly: a model that ignores the
// structure must still produce a readable answer, so an unheaded document falls
// back to "first paragraph leads, the rest is the body".
//
// Citation markers need no translation. The prompt asks for `[1]`, `[2]` — the
// same 1-based indices into the answer's own citation list that `citations.js`
// already parses. `[citation:n]` is normalised too because the OpenAPI
// description documents that form, and a marker the reader can see but not
// click is worse than no marker.

// ── evidence levels ───────────────────────────────────────────────────────
// The badge decodes a roman numeral (see ui/Bits.jsx LEVEL_MEANING). The API
// field is free text — "GRADE / Oxford / Cochrane evidence level if
// applicable" — so anything outside the scale the UI can explain is dropped
// rather than shown as a badge nobody can read.
const KNOWN_LEVELS = ["Ia", "Ib", "IIa", "IIb", "III", "IV"];

export function normaliseEvidenceLevel(level) {
  if (!level) return null;
  const clean = String(level).trim().replace(/^(level|grad[e]?|evidenzgrad)\s*/i, "");
  return KNOWN_LEVELS.find((k) => k.toLowerCase() === clean.toLowerCase()) || null;
}

// ── markdown → prose ──────────────────────────────────────────────────────
// The answer renders as paragraphs of text with citation chips; it is not a
// markdown surface and should not become one for a syntax the synthesis prompt
// barely uses. So the few constructs a model reaches for anyway are flattened
// to something readable, and everything else is left alone.
export function normaliseMarkdown(md) {
  let out = String(md || "");

  // `[citation:3]` / `[Citation 3]` → `[3]`, the form segmentAnswer() reads.
  out = out.replace(/\[\s*citations?[:\s]\s*(\d{1,2})\s*\]/gi, "[$1]");
  // Inline links keep their text and lose the target: the module renders no
  // anchors, and a bare URL in the middle of a sentence is noise. Sources are
  // reachable, with their metadata, in the Sources tab.
  out = out.replace(/!?\[([^\]\n]+)\]\((?:https?:|mailto:)[^)\s]*\)/g, "$1");
  // Headings that survived the section split (a model nesting `###` inside a
  // section) become plain lines rather than losing their text.
  out = out.replace(/^\s{0,3}#{1,6}\s*/gm, "");
  out = out.replace(/^\s{0,3}>\s?/gm, "");
  // Bullets become a character the reader recognises; ordered lists already are.
  out = out.replace(/^\s*[-*+]\s+/gm, "• ");
  out = out.replace(/`([^`\n]+)`/g, "$1");
  out = out.replace(/\*\*([^*\n]+)\*\*/g, "$1");
  out = out.replace(/__([^_\n]+)__/g, "$1");
  // Single-marker emphasis, guarded so `2*3` and snake_case survive.
  out = out.replace(/(^|[\s(])\*(?!\s)([^*\n]+?)(?<!\s)\*(?=$|[\s).,;:!?])/g, "$1$2");
  out = out.replace(/(^|[\s(])_(?!\s)([^_\n]+?)(?<!\s)_(?=$|[\s).,;:!?])/g, "$1$2");
  // A rule between sections carries nothing once the sections are separate.
  out = out.replace(/^\s*([-*_])(?:\s*\1){2,}\s*$/gm, "");

  return out.replace(/\n{3,}/g, "\n\n").trim();
}

// ── sections ──────────────────────────────────────────────────────────────
// Both languages of the synthesis prompt, plus the spellings a model reaches
// for when it paraphrases the heading it was given.
const SECTIONS = [
  { key: "recommendation", labels: ["recommendation", "empfehlung", "рекомендація"] },
  { key: "summary", labels: ["evidence", "evidenz", "докази"] },
  {
    key: "limitations",
    labels: ["caveats", "zu beachten", "einschränkungen", "einschraenkungen", "limitations", "обмеження"],
  },
];

const headingText = (line) => {
  const hash = line.match(/^\s{0,3}#{1,6}\s*(.+?)\s*#*\s*$/);
  if (hash) return hash[1];
  const bold = line.match(/^\s*\*\*(.+?)\*\*:?\s*$/);
  return bold ? bold[1] : null;
};

const sectionKeyFor = (heading) => {
  const clean = String(heading).toLowerCase().replace(/[:.]+$/, "").trim();
  return SECTIONS.find((s) => s.labels.some((l) => clean === l || clean.startsWith(`${l} `)))?.key || null;
};

/**
 * `answer_md` → `{ recommendation, summary, limitations }`.
 *
 * An unrecognised heading (a model adding "## Sources") is not dropped: its
 * text stays as a line and its body continues the section that was open, so no
 * sentence the model wrote disappears between the wire and the screen.
 */
export function splitAnswerSections(md) {
  const lines = String(md || "").split(/\r?\n/);
  const buckets = { recommendation: [], summary: [], limitations: [] };
  const preamble = [];
  let current = null;

  for (const line of lines) {
    const heading = headingText(line);
    if (heading) {
      const key = sectionKeyFor(heading);
      if (key) { current = key; continue; }
      // Unknown heading: keep the words, stay in the current section.
      (current ? buckets[current] : preamble).push(heading);
      continue;
    }
    (current ? buckets[current] : preamble).push(line);
  }

  const joined = {
    recommendation: normaliseMarkdown(buckets.recommendation.join("\n")),
    summary: normaliseMarkdown(buckets.summary.join("\n")),
    limitations: normaliseMarkdown(buckets.limitations.join("\n")),
  };
  const lead = normaliseMarkdown(preamble.join("\n"));

  // No headings at all: the first paragraph leads and the rest is the body.
  // Better than an empty lead over a wall of text, and it invents nothing.
  if (!joined.recommendation && !joined.summary && !joined.limitations) {
    const paragraphs = lead.split(/\n{2,}/);
    return {
      recommendation: paragraphs[0] || "",
      summary: paragraphs.slice(1).join("\n\n"),
      limitations: "",
    };
  }
  // Text before the first heading belongs to the body, not to the lead: a
  // preamble is context, and the lead must stay the recommendation itself.
  return { ...joined, summary: [lead, joined.summary].filter(Boolean).join("\n\n") };
}

// ── citations ─────────────────────────────────────────────────────────────
// Only what the API actually sends is mapped. The fields it has no equivalent
// for (a plain-language summary, the publication year) stay absent rather than
// being guessed at — ReferenceCard renders what it is given, and an invented
// year on a clinical source is a lie with a date on it.
const TYPE_BY_SOURCE = {
  AWMF: "guideline",
  ESMO: "guideline",
  NICE: "guideline",
  Cochrane: "meta-analysis",
};

export function mapCitation(citation, index = 0) {
  if (!citation) return null;
  const source = citation.source || "—";
  const sourceId = citation.source_id || String(index + 1);
  const isPubmedLike = source === "PubMed" || source === "EuropePMC";
  return {
    id: `${source}:${sourceId}`,
    title: citation.title || sourceId,
    source,
    sourceType: TYPE_BY_SOURCE[source] || null,
    year: null,
    evidenceLevel: normaliseEvidenceLevel(citation.evidence_level),
    recommendationGrade: citation.recommendation_grade || null,
    summary: "",
    // The identifiers ReferenceCard can label. A PubMed-family id that is a
    // bare accession number is a PMID; anything starting 10. is a DOI.
    pmid: isPubmedLike && /^\d{6,9}$/.test(sourceId) ? sourceId : null,
    doi: /^10\.\d{4,9}\//.test(sourceId) ? sourceId : null,
    registry: !isPubmedLike && !/^10\./.test(sourceId) ? sourceId : null,
    url: citation.url || "",
    relevance: typeof citation.relevance_score === "number" ? citation.relevance_score : null,
  };
}

export function mapCitations(list) {
  return (list || []).map(mapCitation).filter(Boolean);
}

// ── abstention ────────────────────────────────────────────────────────────
// The backend abstains with a machine reason. Each one means something
// different to the reader — "I searched and found nothing" is not "you asked
// me something I am not for" — so each gets its own sentence rather than one
// apology reused four times.
const ABSTENTION = {
  no_retrieval_hits: {
    uk: ["Немає відповіді — у корпусі доказів немає джерел із цього питання.",
      "Пошук виконано, але жодне джерело не відповідало запиту. Спробуйте переформулювати або звузити питання."],
    en: ["No answer — the evidence corpus holds no sources on this question.",
      "The search ran but matched no source. Try rephrasing, or narrowing the question."],
    de: ["Keine Antwort — der Evidenzkorpus enthält keine Quellen zu dieser Frage.",
      "Die Suche lief, traf aber keine Quelle. Formulieren Sie die Frage um oder grenzen Sie sie ein."],
  },
  out_of_scope: {
    uk: ["Поза межами — це не клінічне питання.",
      "Модуль відповідає лише на клінічні запитання за доказовими джерелами."],
    en: ["Out of scope — this is not a clinical question.",
      "The module answers clinical questions from evidence sources only."],
    de: ["Außerhalb des Rahmens — das ist keine klinische Frage.",
      "Das Modul beantwortet ausschließlich klinische Fragen aus Evidenzquellen."],
  },
  low_confidence: {
    uk: ["Немає впевненої відповіді — знайдені джерела не підтверджують висновок.",
      "Джерела нижче знайдено, але їх недостатньо, щоб обґрунтувати рекомендацію. Перегляньте їх самостійно."],
    en: ["No confident answer — the sources found do not support a conclusion.",
      "The sources below were retrieved but do not ground a recommendation. Review them directly."],
    de: ["Keine belastbare Antwort — die gefundenen Quellen tragen keine Schlussfolgerung.",
      "Die Quellen unten wurden gefunden, begründen aber keine Empfehlung. Bitte selbst prüfen."],
  },
  // Not an evidence gap at all: the pipeline itself broke (the model was
  // unreachable, a stage raised). Telling the reader "no sources support this"
  // would blame the evidence for a backend failure, and would send them
  // rewriting a question that was never the problem.
  pipeline_error: {
    uk: ["Не вдалося сформувати відповідь — збій обробки.",
      "Це не брак доказів: конвеєр відповіді завершився помилкою. Спробуйте ще раз; якщо повторюється — це проблема на боці сервісу."],
    en: ["The answer could not be produced — the pipeline failed.",
      "This is not an evidence gap: the answer pipeline errored out. Try again; if it repeats, the service side needs attention."],
    de: ["Die Antwort konnte nicht erzeugt werden — die Pipeline ist fehlgeschlagen.",
      "Kein Evidenzmangel: die Antwort-Pipeline lief auf einen Fehler. Bitte erneut versuchen; wiederholt es sich, liegt es am Dienst."],
  },
  high_hallucination_risk: {
    uk: ["Відповідь відхилено перевіркою — вона не була підтверджена джерелами.",
      "Чернетку відповіді відхилено, бо її твердження не спиралися на знайдені джерела. Джерела нижче."],
    en: ["The draft answer failed verification — it was not grounded in the sources.",
      "A draft was produced but its claims did not hold against the retrieved sources, so it was discarded. The sources are below."],
    de: ["Der Antwortentwurf hat die Prüfung nicht bestanden — er war nicht durch die Quellen gedeckt.",
      "Ein Entwurf entstand, seine Aussagen hielten den gefundenen Quellen aber nicht stand und wurden verworfen. Die Quellen stehen unten."],
  },
};

const ABSTENTION_FALLBACK = {
  uk: ["Немає відповіді на це питання.", "Система відмовилася відповідати, бо не змогла обґрунтувати відповідь доказами."],
  en: ["No answer for this question.", "The system declined to answer because it could not ground one in evidence."],
  de: ["Keine Antwort auf diese Frage.", "Das System hat abgelehnt, da keine evidenzbasierte Antwort möglich war."],
};

export function abstentionCopy(reason, locale = "en") {
  const lang = ABSTENTION[reason]?.[locale] ? locale : "en";
  const entry = ABSTENTION[reason]?.[lang]
    || ABSTENTION_FALLBACK[ABSTENTION_FALLBACK[locale] ? locale : "en"];
  return { title: entry[0], body: entry[1] };
}

// ── the answer ────────────────────────────────────────────────────────────

/**
 * `QueryResponse` → the record AnswerDocument renders.
 *
 * `entities` comes off the `metadata` SSE frame rather than the final payload,
 * so it is passed in: the classifier's extraction is stream state, not part of
 * the stored answer.
 */
export function mapQueryResponse(response, { entities = [], locale = "en", latencyMs = null } = {}) {
  const r = response || {};
  const citations = mapCitations(r.citations);

  if (r.abstained) {
    const copy = abstentionCopy(r.abstention_reason, locale);
    return {
      abstained: true,
      recommendation: copy.title,
      summary: copy.body,
      limitations: "",
      grade: null,
      confidence: typeof r.confidence === "number" ? r.confidence : 0,
      entities,
      followUps: [],
      // Kept deliberately: for a low-confidence or failed-verification
      // abstention the retrieval DID find real sources. Hiding them would
      // withhold the one thing the clinician can still act on.
      citations,
      latencyMs: latencyMs ?? r.latency_ms ?? 0,
      abstentionReason: r.abstention_reason || null,
      queryHistoryId: r.query_history_id || null,
      conversationId: r.conversation_id || null,
      modelId: r.model_id || null,
    };
  }

  const sections = splitAnswerSections(r.answer_md);
  return {
    abstained: false,
    ...sections,
    grade: normaliseEvidenceLevel(r.evidence_level),
    confidence: typeof r.confidence === "number" ? r.confidence : 0,
    entities,
    // The API has no follow-up generator. An empty list renders no chips,
    // which is the honest state — inventing three questions here would put
    // words in the pipeline's mouth.
    followUps: [],
    citations,
    latencyMs: latencyMs ?? r.latency_ms ?? 0,
    hallucinationRisk: r.hallucination_risk || null,
    recommendationGrade: r.recommendation_grade || null,
    queryHistoryId: r.query_history_id || null,
    conversationId: r.conversation_id || null,
    modelId: r.model_id || null,
    promptVersion: r.prompt_version || null,
  };
}

// ── patient context ───────────────────────────────────────────────────────
// This is the PHI boundary, and it is a whitelist on purpose.
//
// The module holds a real patient: name, MRN, date of birth, diagnoses,
// medication. The API's `PatientContext` accepts none of those as identifiers —
// it takes a coarse age BRACKET, sex, weight, eGFR and free-text problem and
// medication lists, precisely so a clinical question can carry context without
// carrying a person. Nothing outside this function decides what leaves the
// browser, and nothing in it may be widened to a name, an MRN or a date.

const AGE_BUCKETS = [
  { max: 17, value: "0-17" },
  { max: 39, value: "18-39" },
  { max: 64, value: "40-64" },
  { max: 79, value: "65-79" },
];

export function ageRangeFromDob(dob, now = new Date()) {
  if (!dob) return null;
  const born = new Date(dob);
  if (Number.isNaN(born.getTime())) return null;
  let age = now.getFullYear() - born.getFullYear();
  const before = now.getMonth() < born.getMonth()
    || (now.getMonth() === born.getMonth() && now.getDate() < born.getDate());
  if (before) age -= 1;
  if (age < 0 || age > 130) return null;
  return AGE_BUCKETS.find((b) => age <= b.max)?.value || "80+";
}

const labelOf = (item, language) => {
  if (!item) return "";
  if (typeof item === "string") return item.trim();
  const label = (language === "de" && item.labelDe) || item.label || item.name || "";
  return [item.code, label].filter(Boolean).join(" ").trim();
};

const numericLab = (patient, pattern) => {
  const hit = (patient.labs || []).find((l) => pattern.test(String(l?.name || "")));
  const value = Number.parseFloat(hit?.value);
  return Number.isFinite(value) ? value : null;
};

/**
 * The module's patient → the API's de-identified `PatientContext`.
 * Returns null when nothing survives the whitelist, so the request omits the
 * field entirely rather than sending an empty object.
 */
export function toPatientContext(patient, { language = "en", now = new Date() } = {}) {
  if (!patient) return null;
  const context = {};

  const ageRange = ageRangeFromDob(patient.dob, now);
  if (ageRange) context.age_range = ageRange;

  const sex = String(patient.sex || "").toLowerCase();
  if (sex === "m" || sex === "male") context.sex = "M";
  else if (sex === "f" || sex === "female") context.sex = "F";

  const problems = (patient.diagnoses || []).map((d) => labelOf(d, language)).filter(Boolean).slice(0, 20);
  if (problems.length) context.comorbidities = problems;

  const meds = (patient.medications || []).map((m) => labelOf(m, language)).filter(Boolean).slice(0, 30);
  if (meds.length) context.current_medications = meds;

  const egfr = numericLab(patient, /egfr|gfr/i);
  if (egfr !== null && egfr >= 0 && egfr <= 200) context.egfr_ml_min = egfr;

  const weight = Number.parseFloat(patient.weightKg);
  if (Number.isFinite(weight) && weight >= 1 && weight <= 400) context.weight_kg = weight;

  return Object.keys(context).length ? context : null;
}
