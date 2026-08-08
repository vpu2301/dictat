// chat/data/platformMapping.js — THIS platform's AnswerEnvelope, in this
// module's shape.
//
// Pure functions, no fetch and no React, for the same reason answerMapping.js
// is: a wire format shared by two repos only stays honest if one side can
// assert it without the other side running. See platformMapping.test.js.
//
// ── The two contracts ─────────────────────────────────────────────────────
// The module renders a THREE-PART answer — a lead recommendation, the evidence
// body, a limitations aside — with `[1]`-style markers the citation parser
// turns into chips.
//
// `evidence-answer` (:8013) does not send prose. It sends a typed envelope:
// segments carrying one of six kinds (evidence / patient_fact / interpretation
// / uncertainty / missing_info / next_step), each with structured citations
// pointing at entries of a sources[] panel, split across a `summary` area and
// a `detail` area. There is no markdown anywhere in it.
//
// That taxonomy is what does the mapping work here, and it maps cleanly:
//
//   uncertainty | missing_info      → limitations (both areas)
//   the first remaining segment     → recommendation (the lead)
//   everything else                 → summary (the body)
//
// Segment ORDER is the pipeline's own; nothing here re-ranks it. Citations are
// structural on the wire, so the markers the reader clicks are appended to each
// segment's text from its own citation list — index into the answer's sources,
// exactly what citations.js parses.
//
// ── What this service does not have, and is not faked ─────────────────────
// No confidence score, no GRADE/Oxford evidence level, no extracted entities,
// no follow-up generator. Those come back `null`/`[]` rather than invented:
// a fabricated 0.86 next to a clinical answer is a lie with two decimal places.

import { abstentionCopy } from "./answerMapping.js";

// ── request ───────────────────────────────────────────────────────────────

// `AskRequest.locale` is `^(uk|en)` and the body is `additionalProperties:
// false` — an unmapped UI language (de, pl, ro…) is a 422, not a fallback the
// server does for us. This is also NOT the answer language: the pipeline
// answers in the language of the question and uses `locale` only for its own
// fixed strings.
export function askLocale(...candidates) {
  for (const candidate of candidates) {
    const value = String(candidate || "").toLowerCase();
    if (value.startsWith("uk")) return "uk";
    if (value.startsWith("en")) return "en";
  }
  return "en";
}

// S04 serves quick_search only. `contextual` exists in the mode enum but the
// pipeline behind it lands in S06, and the request body has no patient field at
// all — which is why an attached patient produces a note rather than a payload
// (see NOTES.patient_context_unsupported).
export const ASK_MODE = "quick_search";

export function buildAskBody(question, { language, locale } = {}) {
  return {
    question: String(question || "").trim(),
    mode: ASK_MODE,
    locale: askLocale(language, locale),
  };
}

// ── sources ───────────────────────────────────────────────────────────────

// EvidenceTier → the study-design pill. `other` has no design to show and gets
// no pill, which SourceTypePill already treats as "unknown" rather than "none".
const TYPE_BY_TIER = {
  guideline: "guideline",
  systematic_review: "meta-analysis",
  rct: "rct",
  observational: "observational",
};

// SourceAuthority → the publisher line. A web source says its domain instead:
// "nice.org.uk" tells a clinician more than "international" does.
const AUTHORITY_LABEL = {
  tenant: { uk: "Клініка", en: "Clinic", de: "Klinik" },
  national: { uk: "Національне джерело", en: "National", de: "National" },
  international: { uk: "Міжнародне джерело", en: "International", de: "International" },
  primary_literature: { uk: "Первинна література", en: "Primary literature", de: "Primärliteratur" },
};

const KIND_LABEL = {
  corpus: { uk: "Корпус доказів", en: "Evidence corpus", de: "Evidenzkorpus" },
  web: { uk: "Веб-джерело", en: "Web source", de: "Webquelle" },
  drug: { uk: "Довідник ліків", en: "Drug reference", de: "Arzneimittelreferenz" },
};

const pick = (record, locale) => {
  if (!record) return "";
  const lang = record[locale] ? locale : "en";
  return record[lang] || "";
};

/** One `SourceRef` → the record ReferenceCard renders. */
export function mapSource(source, locale = "en") {
  if (!source?.id) return null;
  const web = source.web || null;
  return {
    id: source.id,
    title: source.title || source.id,
    source: web?.domain || pick(AUTHORITY_LABEL[source.source_authority], locale)
      || pick(KIND_LABEL[source.kind], locale) || "",
    sourceType: TYPE_BY_TIER[source.evidence_tier] || null,
    // `accessed_at` is when the connector fetched the page, not when the work
    // was published. Rendering it as a year would date the evidence wrongly.
    year: null,
    // The tiers above are a document taxonomy, not the Ia–IV scale the badge
    // decodes. There is no lossless map between them, so no badge.
    evidenceLevel: null,
    recommendationGrade: null,
    summary: "",
    pmid: null,
    doi: null,
    registry: null,
    url: web?.url || "",
    relevance: null,
  };
}

export function mapSources(sources, locale = "en") {
  return (sources || []).map((s) => mapSource(s, locale)).filter(Boolean);
}

// ── segments ──────────────────────────────────────────────────────────────

const LIMITATION_KINDS = new Set(["uncertainty", "missing_info"]);

/**
 * A segment's text with its citation markers appended.
 *
 * `indexOf` maps a source id to its 1-based position in the answer's own
 * citation list. A citation pointing at a source that never arrived is dropped
 * rather than rendered — segmentAnswer() would print `[4]` as literal text, and
 * a marker the reader can see but not click is worse than no marker.
 */
export function segmentText(segment, indexOf) {
  const text = String(segment?.text || "").trim();
  if (!text) return "";
  const seen = new Set();
  const markers = [];
  for (const citation of segment?.citations || []) {
    const index = indexOf?.get?.(citation?.source_id);
    if (!index || seen.has(index)) continue;
    seen.add(index);
    markers.push(`[${index}]`);
  }
  return markers.length ? `${text} ${markers.join("")}` : text;
}

const joinSegments = (segments, indexOf) =>
  segments.map((s) => segmentText(s, indexOf)).filter(Boolean).join("\n\n");

/** Body vs. aside, across both areas, order preserved. */
export function partitionSegments(summary = [], detail = []) {
  const all = [...summary, ...detail].filter(Boolean);
  return {
    body: all.filter((s) => !LIMITATION_KINDS.has(s.kind)),
    limitations: all.filter((s) => LIMITATION_KINDS.has(s.kind)),
  };
}

// ── notes ─────────────────────────────────────────────────────────────────
// Things the reader must know that are NOT part of the answer's prose: a
// connector that could not serve, a synthesis that dropped claims, a patient
// this service cannot yet take into account. They join the limitations aside,
// which is where a clinician already looks for what qualifies an answer.

const NOTES = {
  patient_context_unsupported: {
    uk: "Пацієнта прикріплено, але цей сервіс поки не приймає контекст пацієнта — відповідь загальна й не використала жодних його даних.",
    en: "A patient is attached, but this service does not accept patient context yet — the answer is generic and used none of their data.",
    de: "Ein Patient ist angehängt, doch dieser Dienst nimmt noch keinen Patientenkontext entgegen — die Antwort ist allgemein und hat keine Patientendaten verwendet.",
  },
  web_unavailable: {
    uk: "Живі веб-джерела були недоступні — відповідь спирається лише на локальний корпус доказів.",
    en: "Live web sources were unavailable — the answer draws on the local evidence corpus only.",
    de: "Live-Webquellen waren nicht verfügbar — die Antwort stützt sich nur auf den lokalen Evidenzkorpus.",
  },
  partial_synthesis: {
    uk: "Синтез неповний: частину тверджень не вдалося прив’язати до джерела, і їх вилучено.",
    en: "The synthesis is partial: some statements could not be tied to a source and were dropped.",
    de: "Die Synthese ist unvollständig: einige Aussagen ließen sich keiner Quelle zuordnen und wurden entfernt.",
  },
};

// `insufficient_basis` rides along as a flag AND as the envelope status; the
// status already produces the abstention card, so the flag adds nothing.
const NOTE_FOR_FLAG = new Set(["web_unavailable", "partial_synthesis"]);

export function noteLines({ flags = [], patientAttached = false, locale = "en" } = {}) {
  const lines = [];
  if (patientAttached) lines.push(pick(NOTES.patient_context_unsupported, locale));
  const seen = new Set();
  for (const flag of flags) {
    const code = flag?.code;
    if (!code || seen.has(code) || !NOTE_FOR_FLAG.has(code)) continue;
    seen.add(code);
    lines.push(pick(NOTES[code], locale));
  }
  return lines.filter(Boolean);
}

// ── the answer ────────────────────────────────────────────────────────────

const dedupeFlags = (...lists) => {
  const seen = new Map();
  for (const flag of lists.flat()) {
    if (flag?.code && !seen.has(flag.code)) seen.set(flag.code, flag);
  }
  return [...seen.values()];
};

/**
 * The accumulated stream → the record AnswerDocument renders.
 *
 * @param {object} state `{ header, summary[], detail[], sources[], done }`
 */
export function mapAnswer(state = {}, { locale = "en", latencyMs = 0, patientAttached = false } = {}) {
  const sources = (state.sources || []).filter((s) => s?.id);
  const citations = mapSources(sources, locale);
  const indexOf = new Map(sources.map((s, i) => [s.id, i + 1]));
  const flags = dedupeFlags(state.header?.flags || [], state.done?.flags || []);
  const status = state.done?.status || "ok";

  const common = {
    grade: null,
    confidence: null,
    entities: [],
    followUps: [],
    citations,
    latencyMs,
    answerId: state.done?.answer_id || state.header?.answer_id || null,
    provenanceRef: state.done?.provenance_ref || null,
    verified: state.header?.verified === true,
    degraded: state.done?.degraded ?? state.header?.degraded ?? false,
    flags,
  };

  // Triage refused the question. Not a failure and not an evidence gap: the
  // pipeline ran and its answer is "not here". The service sends its own
  // sentence for why — it is the specific one, so it wins over the generic copy.
  if (status === "deflected") {
    const copy = abstentionCopy("out_of_scope", locale);
    const triage = state.done?.triage || null;
    return {
      ...common,
      abstained: true,
      abstentionReason: triage?.reason_code || "out_of_scope",
      recommendation: copy.title,
      summary: triage?.message || copy.body,
      limitations: "",
    };
  }

  const { body, limitations } = partitionSegments(state.summary, state.detail);
  const notes = noteLines({ flags, patientAttached, locale });
  const aside = [joinSegments(limitations, indexOf), ...notes].filter(Boolean).join("\n\n");

  // Nothing to stand an answer on. `insufficient_basis` is the service saying
  // so out loud; an empty body without that status means the same thing and is
  // treated the same way rather than rendered as a blank answer.
  if (status === "insufficient_basis" || !body.length) {
    // The two abstentions read differently to a clinician: "I found nothing"
    // sends them rewriting the question, "I found sources but they carry no
    // conclusion" sends them to the sources. Which one it is depends on
    // whether retrieval returned anything.
    const copy = abstentionCopy(sources.length ? "low_confidence" : "no_retrieval_hits", locale);
    return {
      ...common,
      abstained: true,
      abstentionReason: sources.length ? "low_confidence" : "no_retrieval_hits",
      recommendation: copy.title,
      summary: [copy.body, joinSegments(limitations, indexOf)].filter(Boolean).join("\n\n"),
      limitations: notes.join("\n\n"),
    };
  }

  const [lead, ...rest] = body;
  return {
    ...common,
    abstained: false,
    recommendation: segmentText(lead, indexOf),
    summary: joinSegments(rest, indexOf),
    limitations: aside,
  };
}
