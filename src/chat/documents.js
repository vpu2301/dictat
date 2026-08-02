// chat/documents.js — turning an answer into something you can put in a record.
//
// An evidence answer is read once; a note is kept. So the generator does not
// paste the answer into a document — it rewrites it into the shape the document
// needs:
//
//  · note   — assessment and plan, the way it goes into a chart entry;
//  · plan   — numbered next steps, for a to-do or a handover;
//  · summary— the answer with its provenance, for a case discussion.
//
// Three rules the generator keeps, because a document leaves the module and
// nobody can see the caveats any more:
//   1. Citation markers are resolved to a numbered source list. A "[1]" in a
//      note nobody can follow is worse than no citation at all.
//   2. Limitations always travel with the recommendation.
//   3. Every document says it came from a demo build that does not generate
//      answers. Removing that line is a decision for whoever ships the real
//      backend, not something the reader should have to know.
//
// Pure functions, no React: this is the part most worth testing, because its
// output ends up in a patient's record.

import { citedSources } from "./citations.js";
import { age } from "./i18n.js";

export const DOCUMENT_KINDS = ["note", "plan", "summary"];

const LABELS = {
  note: {
    en: { title: "Clinical note", assessment: "Assessment", plan: "Plan", context: "Patient context", sources: "Evidence", limits: "Limitations" },
    de: { title: "Klinische Notiz", assessment: "Beurteilung", plan: "Procedere", context: "Patientenkontext", sources: "Evidenz", limits: "Einschränkungen" },
    uk: { title: "Клінічна нотатка", assessment: "Оцінка", plan: "План", context: "Контекст пацієнта", sources: "Докази", limits: "Обмеження" },
  },
  plan: {
    en: { title: "Plan", steps: "Next steps", context: "Patient context", sources: "Evidence", limits: "Limitations" },
    de: { title: "Procedere", steps: "Nächste Schritte", context: "Patientenkontext", sources: "Evidenz", limits: "Einschränkungen" },
    uk: { title: "План", steps: "Наступні кроки", context: "Контекст пацієнта", sources: "Докази", limits: "Обмеження" },
  },
  summary: {
    en: { title: "Evidence summary", question: "Question", answer: "Answer", context: "Patient context", sources: "Evidence", limits: "Limitations" },
    de: { title: "Evidenz-Zusammenfassung", question: "Fragestellung", answer: "Antwort", context: "Patientenkontext", sources: "Evidenz", limits: "Einschränkungen" },
    uk: { title: "Підсумок доказів", question: "Питання", answer: "Відповідь", context: "Контекст пацієнта", sources: "Докази", limits: "Обмеження" },
  },
};

const DISCLAIMER = {
  en: "Generated from an evidence-chat answer (demo build — answers are fixtures, not generated). Review before filing.",
  de: "Erstellt aus einer Evidenz-Chat-Antwort (Demo-Build — Antworten sind Fixtures, nicht generiert). Vor Ablage prüfen.",
  uk: "Створено з відповіді доказового чату (демо-збірка — відповіді фіксовані, не згенеровані). Перевірте перед збереженням.",
};

const pickLabels = (kind, lang) => LABELS[kind][lang] || LABELS[kind].en;

// Markers only mean something next to the numbered list they point at, and the
// list travels at the bottom of the document — so the prose keeps them.
const sourceLines = (sources) => sources.map((s) => {
  const ids = [s.pmid && `PMID ${s.pmid}`, s.doi && `DOI ${s.doi}`, s.registry].filter(Boolean).join(", ");
  return `[${s.index}] ${s.title} — ${s.source} ${s.year}, ${s.evidenceLevel}${ids ? ` (${ids})` : ""}`;
});

// The patient block is deliberately terse and factual: what was attached when
// the question was asked, so a reader can tell what the answer was reasoning
// over. Nothing is inferred and nothing is added.
const patientLines = (patient, lang) => {
  if (!patient) return [];
  const years = age(patient.dob);
  const head = [patient.name, years != null ? `${years}` : null, patient.sex ? patient.sex.toUpperCase() : null]
    .filter(Boolean).join(" · ");
  const out = [head];
  if (patient.diagnoses?.length) {
    out.push(patient.diagnoses
      .map((d) => [d.code, lang === "de" && d.labelDe ? d.labelDe : d.label].filter(Boolean).join(" "))
      .join("; "));
  }
  if (patient.medications?.length) out.push(patient.medications.join("; "));
  if (patient.labs?.length) out.push(patient.labs.map((l) => `${l.name} ${l.value}${l.unit ? ` ${l.unit}` : ""}`).join("; "));
  if (patient.allergies?.length) out.push(`Allergies: ${patient.allergies.join(", ")}`);
  return out;
};

// The plan steps. Follow-ups are questions, not actions, so they are not steps
// — the recommendation is. Sentences are split on ; and . to give a clinician
// something to tick off rather than one long paragraph.
const planSteps = (answer) => String(answer.recommendation || "")
  .split(/(?<=[.;])\s+/)
  .map((s) => s.trim())
  .filter((s) => s.length > 3);

const block = (heading, lines) => (lines.length ? [`${heading}:`, ...lines, ""] : []);

export function generateDocument({ kind = "note", question, answer, patient, language = "en", locale = "en" }) {
  if (!answer) return null;
  // Document language follows the ANSWER, not the interface: the note is
  // written in the language its content is in, or it reads as a translation
  // nobody made.
  const lang = language === "de" ? "de" : (locale === "uk" ? "uk" : "en");
  const L = pickLabels(kind, lang);
  const sources = citedSources(answer.citations);
  const lines = [];

  lines.push(`${L.title}: ${question}`, "");

  if (patient) lines.push(...block(L.context, patientLines(patient, lang)));

  if (kind === "note") {
    lines.push(...block(L.assessment, [answer.recommendation]));
    lines.push(...block(L.plan, [answer.summary]));
  } else if (kind === "plan") {
    lines.push(...block(L.steps, planSteps(answer).map((s, i) => `${i + 1}. ${s}`)));
  } else {
    lines.push(...block(L.question, [question]));
    lines.push(...block(L.answer, [answer.recommendation, answer.summary].filter(Boolean)));
  }

  if (answer.limitations) lines.push(...block(L.limits, [answer.limitations]));
  if (sources.length) lines.push(...block(L.sources, sourceLines(sources)));

  lines.push(`— ${DISCLAIMER[lang]}`);

  return {
    kind,
    title: `${L.title}: ${question}`,
    body: lines.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    sourceCount: sources.length,
    patientId: patient?.id || null,
    language: lang,
  };
}
