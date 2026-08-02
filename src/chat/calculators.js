// chat/calculators.js — the bedside arithmetic, as pure functions.
//
// These are the only things in the module that COMPUTE rather than look up, so
// they are the only things that can be wrong in a way no source list would
// reveal. Hence: no React, no formatting decisions, and a test per formula
// against published worked examples.
//
// Each calculator returns `{ value, unit, label, detail }` — `detail` is the
// sentence that travels into the question or the note, so the reader can see
// what was put in, not just what came out.

export const CALCULATORS = ["egfr", "chadsvasc", "bmi"];

// ── CKD-EPI 2021 (race-free) ──────────────────────────────────────────────
// eGFR = 142 × min(Scr/κ,1)^α × max(Scr/κ,1)^−1.200 × 0.9938^age × 1.012 [female]
// κ = 0.7 (female) / 0.9 (male); α = −0.241 (female) / −0.302 (male).
// Creatinine in mg/dL. The 2021 equation drops the race coefficient — using an
// older one here would quietly change who gets referred.
export function egfr({ creatinine, age, sex }) {
  const scr = Number(creatinine);
  const yrs = Number(age);
  if (!(scr > 0) || !(yrs > 0)) return null;
  const female = String(sex).toLowerCase() === "f";
  const k = female ? 0.7 : 0.9;
  const a = female ? -0.241 : -0.302;
  const ratio = scr / k;
  const value = 142
    * Math.min(ratio, 1) ** a
    * Math.max(ratio, 1) ** -1.200
    * 0.9938 ** yrs
    * (female ? 1.012 : 1);
  return {
    key: "egfr",
    value: Math.round(value),
    unit: "ml/min/1.73m²",
    label: "eGFR (CKD-EPI 2021)",
    detail: `creatinine ${scr} mg/dL, age ${yrs}, ${female ? "female" : "male"}`,
  };
}

// ── CHA₂DS₂-VASc ──────────────────────────────────────────────────────────
// Age is scored ONCE: ≥75 gives 2 and 65–74 gives 1, never both.
export const CHADSVASC_ITEMS = [
  { key: "chf", points: 1, en: "Congestive heart failure", uk: "Серцева недостатність" },
  { key: "hypertension", points: 1, en: "Hypertension", uk: "Гіпертензія" },
  { key: "diabetes", points: 1, en: "Diabetes mellitus", uk: "Цукровий діабет" },
  { key: "stroke", points: 2, en: "Stroke / TIA / thromboembolism", uk: "Інсульт / ТІА / тромбоемболія" },
  { key: "vascular", points: 1, en: "Vascular disease", uk: "Судинне захворювання" },
  { key: "female", points: 1, en: "Female sex", uk: "Жіноча стать" },
];

export function chadsvasc({ age, flags = {} }) {
  const yrs = Number(age);
  if (!(yrs >= 0)) return null;
  const agePoints = yrs >= 75 ? 2 : yrs >= 65 ? 1 : 0;
  const flagPoints = CHADSVASC_ITEMS.reduce((sum, item) => sum + (flags[item.key] ? item.points : 0), 0);
  const value = agePoints + flagPoints;
  const named = CHADSVASC_ITEMS.filter((i) => flags[i.key]).map((i) => i.en);
  return {
    key: "chadsvasc",
    value,
    unit: "",
    label: "CHA₂DS₂-VASc",
    detail: [`age ${yrs} (+${agePoints})`, ...named].join(", "),
  };
}

// ── BMI ───────────────────────────────────────────────────────────────────
export function bmi({ weightKg, heightCm }) {
  const kg = Number(weightKg);
  const cm = Number(heightCm);
  if (!(kg > 0) || !(cm > 0)) return null;
  const m = cm / 100;
  const value = kg / (m * m);
  return {
    key: "bmi",
    value: Math.round(value * 10) / 10,
    unit: "kg/m²",
    label: "BMI",
    detail: `${kg} kg, ${cm} cm`,
  };
}

export const RUN = { egfr, chadsvasc, bmi };

// The line a result travels as — into the question, or into a note. It carries
// the inputs, because a bare number in a record is a number nobody can check.
export function resultLine(result) {
  if (!result) return "";
  const value = `${result.value}${result.unit ? ` ${result.unit}` : ""}`;
  return `${result.label}: ${value} (${result.detail})`;
}
