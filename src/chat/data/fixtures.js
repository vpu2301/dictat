// chat/data/fixtures.js — demo data for the mock-first sprint.
//
// EVERY PATIENT HERE IS FICTIONAL. No real PHI enters this repo, and none may:
// the module has no data-protection review yet (sprint brief §10), so the
// fixtures are the only patients it is allowed to know about. When the host's
// real patient API lands behind `usePatients`, that review lands with it.
//
// Answer shape mirrors the reference product (EvidenzAI): a structured answer,
// not a blob of prose — recommendation, evidence summary, limitations, an AWMF
// evidence grade, a confidence score, extracted entities, and citations that
// resolve to real source records. Each field carries a German variant because
// answer language is a feature setting, separate from the host's UI language.

export const demoUser = {
  id: "usr_01",
  name: "Dr. Anna Berger",
  email: "a.berger@demo-clinic.de",
  role: "physician",
};

export const demoWorkspace = { id: "ws_01", name: "Demo Klinik Nord" };

export const demoPatients = [
  {
    id: "pat_01", name: "Manfred Weber", dob: "1959-03-12", sex: "m",
    diagnoses: [
      { code: "E11.9", label: "Type 2 diabetes mellitus", labelDe: "Diabetes mellitus Typ 2" },
      { code: "I10", label: "Essential hypertension", labelDe: "Essentielle Hypertonie" },
    ],
    medications: ["Metformin 1000 mg 1-0-1", "Ramipril 5 mg 1-0-0"],
    labs: [
      { name: "HbA1c", value: "7.8", unit: "%", date: "2026-07-15" },
      { name: "eGFR", value: "54", unit: "ml/min", date: "2026-07-15" },
    ],
    allergies: ["Penicillin"],
  },
  {
    id: "pat_02", name: "Sofia Krause", dob: "1988-11-02", sex: "f",
    diagnoses: [{ code: "J45.9", label: "Asthma bronchiale", labelDe: "Asthma bronchiale" }],
    medications: ["Budesonid/Formoterol inhaler"],
    labs: [],
    allergies: [],
  },
  {
    id: "pat_03", name: "Yusuf Demir", dob: "1972-06-25", sex: "m",
    diagnoses: [{ code: "I48.0", label: "Paroxysmal atrial fibrillation", labelDe: "Paroxysmales Vorhofflimmern" }],
    medications: ["Apixaban 5 mg 1-0-1", "Bisoprolol 2.5 mg 1-0-0"],
    labs: [{ name: "INR", value: "1.1", unit: "", date: "2026-07-20" }],
    allergies: [],
  },
];

// ── evidence ──────────────────────────────────────────────────────────────
// `source` is the body that published it (AWMF, Cochrane, ESMO, PubMed);
// `sourceType` is what kind of study it is. Both matter and they are not the
// same axis — a guideline from AWMF and an RCT indexed in PubMed carry very
// different weight for very different reasons.
export const demoEvidence = [
  {
    id: "ev_01",
    title: "National guideline: Type 2 diabetes therapy",
    titleDe: "Nationale VersorgungsLeitlinie: Therapie des Typ-2-Diabetes",
    source: "AWMF", sourceType: "guideline", year: 2024,
    evidenceLevel: "Ia", recommendationGrade: "A",
    summary: "First-line and escalation therapy recommendations, including individualised HbA1c corridors.",
    summaryDe: "Empfehlungen zur Erst- und Eskalationstherapie einschließlich individualisierter HbA1c-Korridore.",
    registry: "nvl-001", url: "#",
  },
  {
    id: "ev_02",
    title: "SGLT2 inhibitors in T2DM with reduced eGFR: a randomised trial",
    titleDe: "SGLT2-Inhibitoren bei T2DM mit reduzierter eGFR: eine randomisierte Studie",
    source: "PubMed", sourceType: "rct", year: 2023,
    evidenceLevel: "Ib", recommendationGrade: "A",
    summary: "Renal and cardiovascular outcomes in CKD subgroups down to eGFR 25 ml/min.",
    summaryDe: "Renale und kardiovaskuläre Endpunkte in CKD-Subgruppen bis eGFR 25 ml/min.",
    journal: "N Engl J Med", pmid: "36720132", url: "#",
  },
  {
    id: "ev_03",
    title: "Metformin dosing in CKD stage 3: a meta-analysis",
    titleDe: "Metformin-Dosierung bei CKD Stadium 3: eine Metaanalyse",
    source: "Cochrane", sourceType: "meta-analysis", year: 2022,
    evidenceLevel: "Ia", recommendationGrade: "B",
    summary: "Safety and lactate outcomes at eGFR 45–59 across 14 cohorts.",
    summaryDe: "Sicherheit und Laktat-Endpunkte bei eGFR 45–59 über 14 Kohorten.",
    doi: "10.1002/14651858.CD012345", url: "#",
  },
  {
    id: "ev_04",
    title: "HbA1c targets in older adults: a narrative review",
    titleDe: "HbA1c-Ziele bei älteren Patienten: eine narrative Übersicht",
    source: "PubMed", sourceType: "review", year: 2024,
    evidenceLevel: "IV", recommendationGrade: "0",
    summary: "Individualised targets, comorbidity burden and deprescribing considerations.",
    summaryDe: "Individualisierte Zielwerte, Komorbiditätslast und Überlegungen zum Deprescribing.",
    journal: "Diabetes Care", pmid: "38112204", url: "#",
  },
  {
    id: "ev_05",
    title: "Stepwise asthma therapy in adults",
    titleDe: "Stufentherapie des Asthmas bei Erwachsenen",
    source: "AWMF", sourceType: "guideline", year: 2025,
    evidenceLevel: "Ia", recommendationGrade: "A",
    summary: "ICS/formoterol as reliever and maintenance across steps 3–5, with escalation prerequisites.",
    summaryDe: "ICS/Formoterol als Bedarfs- und Erhaltungstherapie in den Stufen 3–5, mit Eskalationsvoraussetzungen.",
    registry: "020-009", url: "#",
  },
  {
    id: "ev_06",
    title: "Anticoagulation in atrial fibrillation",
    titleDe: "Antikoagulation bei Vorhofflimmern",
    source: "ESC", sourceType: "guideline", year: 2024,
    evidenceLevel: "Ia", recommendationGrade: "A",
    summary: "DOAC dosing criteria, CHA₂DS₂-VASc thresholds and periprocedural handling.",
    summaryDe: "DOAK-Dosierungskriterien, CHA₂DS₂-VASc-Schwellen und periprozedurales Vorgehen.",
    registry: "esc-af-2024", url: "#",
  },
];

// ── answers ───────────────────────────────────────────────────────────────
// Bracketed markers are 1-based indices into that answer's own citation list,
// so a chip can never point at a source the answer didn't cite.
export const demoAnswers = [
  {
    id: "ans_hba1c",
    match: /hba1c|zielwert|diabetes.*(target|ziel)|glyk/i,
    generic: {
      recommendation: "Aim for an individualised HbA1c corridor rather than one fixed number: 6.5–7.5% for most adults with type 2 diabetes [1].",
      recommendationDe: "Ein individualisierter HbA1c-Korridor ist einem festen Zielwert vorzuziehen: 6,5–7,5 % für die meisten Erwachsenen mit Typ-2-Diabetes [1].",
      summary: "The national guideline anchors the corridor on diabetes duration, comorbidity and hypoglycaemia risk [1]. A narrative review of older adults supports relaxing the target where life expectancy is limited or hypoglycaemia would be dangerous [2].",
      summaryDe: "Die Nationale VersorgungsLeitlinie verankert den Korridor an Diabetesdauer, Komorbidität und Hypoglykämierisiko [1]. Eine Übersichtsarbeit zu älteren Patienten stützt eine Lockerung des Ziels bei begrenzter Lebenserwartung oder relevantem Hypoglykämierisiko [2].",
      limitations: "No patient context is attached, so renal function, current therapy and hypoglycaemia history are unknown — all three move the corridor.",
      limitationsDe: "Kein Patientenkontext angehängt; Nierenfunktion, aktuelle Therapie und Hypoglykämie-Anamnese sind unbekannt — alle drei verschieben den Korridor.",
      grade: "Ia", confidence: 0.86,
      entities: ["HbA1c", "Type 2 diabetes", "Glycaemic target"],
      entitiesDe: ["HbA1c", "Typ-2-Diabetes", "Glykämisches Ziel"],
      citations: ["ev_01", "ev_04"],
      followUps: [
        "When is a relaxed HbA1c target justified?",
        "How does renal function change the target?",
      ],
      followUpsDe: [
        "Wann ist ein gelockerter HbA1c-Zielwert gerechtfertigt?",
        "Wie verändert die Nierenfunktion den Zielwert?",
      ],
    },
    withPatient: {
      pat_01: {
        recommendation: "For this 67-year-old with T2DM, hypertension and eGFR 54 ml/min, a corridor of ~7.0–7.5% is reasonable [1][2].",
        recommendationDe: "Für diesen 67-jährigen Patienten mit T2DM, Hypertonie und eGFR 54 ml/min ist ein Korridor von ca. 7,0–7,5 % vertretbar [1][2].",
        summary: "The recorded HbA1c of 7.8% sits just above that corridor, so the question is escalation, not rescue [1]. Metformin remains acceptable at eGFR 45–59, but the meta-analysis supports a dose review rather than continuing 1000 mg twice daily unexamined [3].",
        summaryDe: "Der dokumentierte HbA1c von 7,8 % liegt knapp darüber — es geht also um Eskalation, nicht um Rettung [1]. Metformin bleibt bei eGFR 45–59 akzeptabel, die Metaanalyse stützt jedoch eine Dosisüberprüfung statt einer unreflektierten Fortführung von 1000 mg zweimal täglich [3].",
        limitations: "Hypoglycaemia history and the trend of the eGFR are not in the attached record; a single creatinine-derived value can misstate stable renal function.",
        limitationsDe: "Hypoglykämie-Anamnese und eGFR-Verlauf fehlen im angehängten Datensatz; ein einzelner kreatininbasierter Wert kann eine stabile Nierenfunktion falsch abbilden.",
        grade: "Ia", confidence: 0.91,
        entities: ["HbA1c 7.8%", "eGFR 54 ml/min", "Metformin", "Type 2 diabetes"],
        entitiesDe: ["HbA1c 7,8 %", "eGFR 54 ml/min", "Metformin", "Typ-2-Diabetes"],
        citations: ["ev_01", "ev_04", "ev_03"],
        followUps: [
          "Should metformin be dose-reduced at eGFR 54?",
          "Which second agent fits this renal function?",
        ],
        followUpsDe: [
          "Sollte Metformin bei eGFR 54 dosisreduziert werden?",
          "Welches Zweitmedikament passt zu dieser Nierenfunktion?",
        ],
      },
    },
  },
  {
    id: "ans_sglt2",
    match: /sglt.?2|gliflozin|empagliflozin|dapagliflozin/i,
    generic: {
      recommendation: "SGLT2 inhibitors are a guideline-supported escalation in type 2 diabetes with cardiovascular or renal risk [1].",
      recommendationDe: "SGLT2-Inhibitoren sind bei Typ-2-Diabetes mit kardiovaskulärem oder renalem Risiko eine leitliniengestützte Eskalation [1].",
      summary: "The randomised evidence shows renal and cardiovascular benefit that persists into reduced eGFR, down to the thresholds studied [1]. Benefit is largely independent of the glucose-lowering effect, which is why the indication is risk-driven rather than HbA1c-driven.",
      summaryDe: "Die randomisierte Evidenz zeigt einen renalen und kardiovaskulären Nutzen, der bis in reduzierte eGFR-Bereiche reicht [1]. Der Nutzen ist weitgehend unabhängig von der Glukosesenkung — die Indikation ist daher risiko- und nicht HbA1c-getrieben.",
      limitations: "Without patient context, volume status, recurrent genital infections and ketoacidosis risk cannot be weighed.",
      limitationsDe: "Ohne Patientenkontext lassen sich Volumenstatus, rezidivierende Genitalinfektionen und Ketoazidoserisiko nicht abwägen.",
      grade: "Ib", confidence: 0.84,
      entities: ["SGLT2 inhibitor", "eGFR", "Cardiovascular risk"],
      entitiesDe: ["SGLT2-Inhibitor", "eGFR", "Kardiovaskuläres Risiko"],
      citations: ["ev_02"],
      followUps: [
        "Down to which eGFR may an SGLT2 inhibitor be started?",
        "How is it combined with metformin?",
      ],
      followUpsDe: [
        "Bis zu welcher eGFR darf ein SGLT2-Inhibitor begonnen werden?",
        "Wie wird er mit Metformin kombiniert?",
      ],
    },
    withPatient: {
      pat_01: {
        recommendation: "Adding an SGLT2 inhibitor is supported for this patient: eGFR 54 ml/min with hypertension is exactly the risk profile the trial evidence covers [1].",
        recommendationDe: "Die Ergänzung eines SGLT2-Inhibitors ist bei diesem Patienten gestützt: eGFR 54 ml/min mit Hypertonie entspricht genau dem in den Studien abgedeckten Risikoprofil [1].",
        summary: "Combination with his existing metformin is the standard escalation step rather than a switch [2]. Expect an initial dip in eGFR that is haemodynamic and not a reason to stop; ramipril is already on board, so review volume status before starting.",
        summaryDe: "Die Kombination mit dem bestehenden Metformin ist der übliche Eskalationsschritt, kein Wechsel [2]. Ein initialer eGFR-Abfall ist hämodynamisch bedingt und kein Absetzgrund; Ramipril besteht bereits — Volumenstatus vor Beginn prüfen.",
        limitations: "The record holds one eGFR value and no urine albumin, so the renal indication cannot be graded further.",
        limitationsDe: "Der Datensatz enthält einen eGFR-Wert und kein Albumin im Urin; die renale Indikation lässt sich nicht weiter graduieren.",
        grade: "Ib", confidence: 0.88,
        entities: ["SGLT2 inhibitor", "eGFR 54 ml/min", "Metformin", "Hypertension"],
        entitiesDe: ["SGLT2-Inhibitor", "eGFR 54 ml/min", "Metformin", "Hypertonie"],
        citations: ["ev_02", "ev_01"],
        followUps: [
          "What eGFR drop is expected after starting?",
          "Does ramipril need adjusting alongside?",
        ],
        followUpsDe: [
          "Welcher eGFR-Abfall ist nach Beginn zu erwarten?",
          "Muss Ramipril begleitend angepasst werden?",
        ],
      },
    },
  },
  {
    id: "ans_asthma",
    match: /asthma|inhal|ics|budesonid|formoterol/i,
    generic: {
      recommendation: "Before stepping up asthma therapy, verify inhaler technique, adherence and trigger control — then escalate within the ICS/formoterol regimen [1].",
      recommendationDe: "Vor einer Eskalation der Asthmatherapie sind Inhalationstechnik, Adhärenz und Triggerkontrolle zu prüfen — die Steigerung erfolgt dann innerhalb des ICS/Formoterol-Regimes [1].",
      summary: "From step 3 the guideline uses ICS/formoterol as both reliever and maintenance, which keeps the anti-inflammatory dose coupled to symptom-driven use [1]. Most apparent treatment failures at this step are delivery or adherence failures, not pharmacological ones.",
      summaryDe: "Ab Stufe 3 nutzt die Leitlinie ICS/Formoterol als Bedarfs- und Erhaltungstherapie, wodurch die antiinflammatorische Dosis an den symptomgesteuerten Gebrauch gekoppelt bleibt [1]. Die meisten scheinbaren Therapieversagen auf dieser Stufe sind Applikations- oder Adhärenzprobleme, keine pharmakologischen.",
      limitations: "No symptom score, exacerbation history or spirometry is attached, so the current step cannot be established from this question alone.",
      limitationsDe: "Symptomscore, Exazerbationsanamnese und Spirometrie fehlen; die aktuelle Stufe lässt sich aus der Frage allein nicht bestimmen.",
      grade: "Ia", confidence: 0.83,
      entities: ["Asthma", "ICS/formoterol", "Step-up therapy"],
      entitiesDe: ["Asthma", "ICS/Formoterol", "Stufentherapie"],
      citations: ["ev_05"],
      followUps: [
        "Which criteria define uncontrolled asthma?",
        "When is a biologic indicated?",
      ],
      followUpsDe: [
        "Welche Kriterien definieren unkontrolliertes Asthma?",
        "Wann ist ein Biologikum indiziert?",
      ],
    },
    withPatient: {
      pat_02: {
        recommendation: "This 37-year-old is already on budesonide/formoterol, so the next step is a within-regimen increase — not a new drug class [1].",
        recommendationDe: "Die 37-jährige Patientin erhält bereits Budesonid/Formoterol; der nächste Schritt ist eine Steigerung innerhalb des Regimes — keine neue Wirkstoffklasse [1].",
        summary: "Confirm inhaler technique and adherence first: with a single controller on board and no exacerbation history in the record, escalation without that check risks treating a delivery problem with a higher dose [1].",
        summaryDe: "Zuerst Inhalationstechnik und Adhärenz sichern: Bei einem einzigen Controller und fehlender Exazerbationsanamnese im Datensatz besteht sonst das Risiko, ein Applikationsproblem mit einer höheren Dosis zu behandeln [1].",
        limitations: "No spirometry, symptom score or exacerbation count is attached to this patient, so the current guideline step is inferred from medication alone.",
        limitationsDe: "Für diese Patientin liegen weder Spirometrie noch Symptomscore oder Exazerbationszahl vor; die aktuelle Stufe wird allein aus der Medikation abgeleitet.",
        grade: "Ia", confidence: 0.79,
        entities: ["Asthma bronchiale", "Budesonide/formoterol", "Adherence"],
        entitiesDe: ["Asthma bronchiale", "Budesonid/Formoterol", "Adhärenz"],
        citations: ["ev_05"],
        followUps: [
          "How is inhaler technique assessed in the consultation?",
          "What symptom score fits this patient?",
        ],
        followUpsDe: [
          "Wie wird die Inhalationstechnik in der Sprechstunde geprüft?",
          "Welcher Symptomscore passt zu dieser Patientin?",
        ],
      },
    },
  },
  {
    id: "ans_afib",
    match: /antikoag|anticoag|vorhofflimmern|atrial fibrillation|apixaban|doac|doak|inr/i,
    generic: {
      recommendation: "In atrial fibrillation a DOAC is preferred over a vitamin K antagonist for most patients; dosing follows age, weight and renal function, not INR [1].",
      recommendationDe: "Bei Vorhofflimmern ist für die meisten Patienten ein DOAK einem Vitamin-K-Antagonisten vorzuziehen; die Dosierung richtet sich nach Alter, Gewicht und Nierenfunktion, nicht nach INR [1].",
      summary: "The guideline sets dose-reduction criteria per agent and a CHA₂DS₂-VASc threshold for starting therapy at all [1]. Routine coagulation monitoring is not part of DOAC care and a normal INR says nothing about DOAC effect.",
      summaryDe: "Die Leitlinie definiert substanzspezifische Dosisreduktionskriterien und eine CHA₂DS₂-VASc-Schwelle für den Therapiebeginn [1]. Ein routinemäßiges Gerinnungsmonitoring gehört nicht zur DOAK-Therapie; ein normaler INR sagt nichts über die DOAK-Wirkung aus.",
      limitations: "Without patient context, neither the CHA₂DS₂-VASc score nor dose-reduction criteria can be applied.",
      limitationsDe: "Ohne Patientenkontext lassen sich weder CHA₂DS₂-VASc-Score noch Dosisreduktionskriterien anwenden.",
      grade: "Ia", confidence: 0.87,
      entities: ["Atrial fibrillation", "DOAC", "CHA₂DS₂-VASc"],
      entitiesDe: ["Vorhofflimmern", "DOAK", "CHA₂DS₂-VASc"],
      citations: ["ev_06"],
      followUps: [
        "Which dose-reduction criteria apply to apixaban?",
        "How is a DOAC handled before surgery?",
      ],
      followUpsDe: [
        "Welche Dosisreduktionskriterien gelten für Apixaban?",
        "Wie wird ein DOAK vor einer Operation gehandhabt?",
      ],
    },
    withPatient: {
      pat_03: {
        recommendation: "Apixaban 5 mg twice daily matches guideline dosing for this patient — no dose-reduction criterion is met by the attached record [1].",
        recommendationDe: "Apixaban 5 mg zweimal täglich entspricht bei diesem Patienten der Leitliniendosierung — der angehängte Datensatz erfüllt kein Dosisreduktionskriterium [1].",
        summary: "Note the recorded INR of 1.1: it is not a monitoring parameter for DOACs and must not be read as under-anticoagulation [1]. Bisoprolol addresses rate, not stroke risk, so it does not change the anticoagulation decision.",
        summaryDe: "Hinweis zum dokumentierten INR von 1,1: Er ist für DOAK kein Monitoring-Parameter und darf nicht als Unterantikoagulation gewertet werden [1]. Bisoprolol adressiert die Frequenz, nicht das Schlaganfallrisiko, und ändert die Antikoagulationsentscheidung nicht.",
        limitations: "Weight, creatinine and the full CHA₂DS₂-VASc components are not in the attached record, so the dose is checked against age alone.",
        limitationsDe: "Gewicht, Kreatinin und die vollständigen CHA₂DS₂-VASc-Komponenten fehlen im Datensatz; die Dosis wird allein gegen das Alter geprüft.",
        grade: "Ia", confidence: 0.82,
        entities: ["Paroxysmal atrial fibrillation", "Apixaban 5 mg", "INR 1.1"],
        entitiesDe: ["Paroxysmales Vorhofflimmern", "Apixaban 5 mg", "INR 1,1"],
        citations: ["ev_06"],
        followUps: [
          "Which parameters actually monitor apixaban?",
          "When would 2.5 mg be the correct dose?",
        ],
        followUpsDe: [
          "Welche Parameter überwachen Apixaban tatsächlich?",
          "Wann wäre 2,5 mg die korrekte Dosis?",
        ],
      },
    },
  },
];

// The graceful landing for anything the demo script doesn't cover. It abstains
// out loud instead of inventing a recommendation — an evidence tool that
// confabulates when it has nothing is worse than one that admits the gap.
export const fallbackAnswer = {
  abstained: true,
  recommendation: "No recommendation — the demo evidence set does not cover this question.",
  recommendationDe: "Keine Empfehlung — der Demo-Evidenzbestand deckt diese Frage nicht ab.",
  summary: "This build answers from a fixed set of four clinical scripts. Rather than assemble a plausible-sounding answer from unrelated sources, it abstains. Try one of the suggested questions, or consult the primary sources directly.",
  summaryDe: "Dieser Build antwortet aus vier fest hinterlegten klinischen Skripten. Statt eine plausibel klingende Antwort aus unpassenden Quellen zusammenzusetzen, enthält er sich. Nutzen Sie eine der vorgeschlagenen Fragen oder konsultieren Sie die Primärquellen direkt.",
  limitations: "Demo build — answers are fixtures, not generated, and no retrieval ran.",
  limitationsDe: "Demo-Build — Antworten sind Fixtures, nicht generiert; es lief keine Recherche.",
  grade: null, confidence: 0.0,
  entities: [],
  entitiesDe: [],
  citations: [],
  followUps: [],
  followUpsDe: [],
};

// Seeded history. Threads are complete so "resume" always has something to
// restore, including the patient context the session was held under.
export const demoSessions = [
  {
    id: "ses_01",
    title: "HbA1c target discussion",
    titleDe: "Diskussion HbA1c-Zielwert",
    patientId: "pat_01",
    updatedAt: "2026-07-31T09:40:00Z",
    messages: [
      { id: "msg_01", role: "user", text: "What HbA1c target should I aim for in this patient?" },
      {
        id: "msg_02", role: "assistant", status: "done",
        answerId: "ans_hba1c", answerFor: "pat_01",
      },
    ],
  },
  {
    id: "ses_02",
    title: "Asthma step-up therapy",
    titleDe: "Asthma-Eskalationstherapie",
    patientId: null,
    updatedAt: "2026-07-29T14:10:00Z",
    messages: [
      { id: "msg_03", role: "user", text: "When should asthma therapy be stepped up?" },
      { id: "msg_04", role: "assistant", status: "done", answerId: "ans_asthma", answerFor: null },
    ],
  },
];

// Openers for an empty thread — an empty chat that says "ask me anything"
// teaches nobody what this build can actually answer.
export const demoPrompts = [
  { en: "What HbA1c target should I aim for?", de: "Welchen HbA1c-Zielwert sollte ich anstreben?" },
  { en: "When would you add an SGLT2 inhibitor?", de: "Wann würden Sie einen SGLT2-Inhibitor ergänzen?" },
  { en: "When should asthma therapy be stepped up?", de: "Wann sollte die Asthmatherapie eskaliert werden?" },
  { en: "How is anticoagulation dosed in atrial fibrillation?", de: "Wie wird die Antikoagulation bei Vorhofflimmern dosiert?" },
];

// ── agents ────────────────────────────────────────────────────────────────
// The catalog behind the Agents screen. Built-ins ship with the product and
// cannot be deleted; anything a clinician creates is marked `custom` and lives
// beside them. `runs` is what makes an agent feel real — a catalog of things
// that have never run is a catalog of promises.
export const demoAgents = [
  {
    id: "agt_quick", name: "QuickAnswer", builtin: true, status: "running", runs: 234,
    scope: "evidence",
    description: "Structured answer in under five seconds: recommendation, evidence summary, grade and citations.",
    descriptionDe: "Strukturierte Antwort in unter fünf Sekunden: Empfehlung, Evidenzzusammenfassung, Grad und Zitate.",
    sources: ["awmf", "cochrane", "pubmed"],
  },
  {
    id: "agt_deep", name: "DeepTrace", builtin: true, status: "idle", runs: 41,
    scope: "evidence",
    description: "Slower, wider pass: traverses guideline references and returns the reasoning chain behind each claim.",
    descriptionDe: "Langsamer, breiter: verfolgt Leitlinienreferenzen und liefert die Argumentationskette hinter jeder Aussage.",
    sources: ["awmf", "esc", "cochrane", "pubmed"],
  },
  {
    id: "agt_drug", name: "DrugIntelligence", builtin: true, status: "idle", runs: 7,
    scope: "drug",
    description: "Interaction and dosing checks against the attached patient's medication list and renal function.",
    descriptionDe: "Interaktions- und Dosierungsprüfung gegen Medikationsliste und Nierenfunktion des Patienten.",
    sources: ["rote-liste", "pubmed"],
  },
  {
    id: "agt_watch", name: "Guideline Watcher", builtin: true, status: "coming_soon", runs: 0,
    scope: "monitor",
    description: "Watches the guideline bodies you follow and flags revisions that touch your specialty.",
    descriptionDe: "Beobachtet die von Ihnen verfolgten Leitliniengremien und meldet Revisionen in Ihrem Fachgebiet.",
    sources: ["awmf", "esc"],
  },
];

export const AGENT_SCOPES = ["evidence", "drug", "monitor"];

// ── connectors ────────────────────────────────────────────────────────────
// Where the evidence would come from. Grouped the way a clinician thinks about
// them rather than by how they are implemented: guideline bodies, literature
// databases, drug references, hospital systems.
export const CONNECTOR_CATEGORIES = [
  { id: "guidelines", uk: "Настанови та стандарти", en: "Guidelines & standards" },
  { id: "literature", uk: "Бази літератури", en: "Literature databases" },
  { id: "clinical", uk: "Клінічні довідники", en: "Clinical references" },
  { id: "hospital", uk: "Лікарняні системи", en: "Hospital systems" },
];

export const demoConnectors = [
  {
    id: "awmf", name: "AWMF Leitlinien", category: "guidelines", region: "DE", status: "connected",
    description: "Current German S1–S3 clinical guidelines.",
    descriptionDe: "Aktuelle deutsche S1–S3-Behandlungsleitlinien.",
    count: 1184, countUnit: "guidelines", countUnitDe: "Leitlinien",
  },
  {
    id: "esc", name: "ESC Guidelines", category: "guidelines", region: "EU", status: "connected",
    description: "European Society of Cardiology recommendations.",
    descriptionDe: "Empfehlungen der European Society of Cardiology.",
    count: 96, countUnit: "guidelines", countUnitDe: "Leitlinien",
  },
  {
    id: "nice", name: "NICE", category: "guidelines", region: "UK", status: "available",
    description: "UK national guidance and quality standards.",
    descriptionDe: "Britische nationale Leitlinien und Qualitätsstandards.",
  },
  {
    id: "cochrane", name: "Cochrane Library", category: "literature", status: "connected",
    description: "Systematic reviews and meta-analyses.",
    descriptionDe: "Systematische Übersichtsarbeiten und Metaanalysen.",
    count: 9420, countUnit: "reviews", countUnitDe: "Reviews",
  },
  {
    id: "pubmed", name: "PubMed / MEDLINE", category: "literature", status: "connected",
    description: "36M biomedical citations and abstracts.",
    descriptionDe: "36 Mio. biomedizinische Zitate und Abstracts.",
    count: 36000000, countUnit: "citations", countUnitDe: "Zitate",
  },
  {
    id: "embase", name: "Embase", category: "literature", status: "available",
    description: "Biomedical database with a pharmacology focus.",
    descriptionDe: "Biomedizinische Datenbank mit pharmakologischem Schwerpunkt.",
  },
  {
    id: "rote-liste", name: "Rote Liste", category: "clinical", region: "DE", status: "connected",
    description: "German drug reference: dosing, interactions, contraindications.",
    descriptionDe: "Arzneimittelverzeichnis: Dosierung, Interaktionen, Kontraindikationen.",
    count: 8300, countUnit: "products", countUnitDe: "Produkte",
  },
  {
    id: "lab-ref", name: "Lab reference ranges", category: "clinical", status: "available",
    description: "Age- and sex-adjusted reference intervals.",
    descriptionDe: "Alters- und geschlechtsadjustierte Referenzbereiche.",
  },
  {
    id: "his", name: "Hospital information system", category: "hospital", status: "coming_soon",
    description: "Patient context straight from the chart. Requires a data-protection review.",
    descriptionDe: "Patientenkontext direkt aus der Akte. Erfordert eine Datenschutzprüfung.",
    enterprise: true,
  },
  {
    id: "fhir", name: "FHIR endpoint", category: "hospital", status: "coming_soon",
    description: "Standards-based record exchange with the host platform.",
    descriptionDe: "Standardbasierter Datenaustausch mit der Host-Plattform.",
    enterprise: true,
  },
];
