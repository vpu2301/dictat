// fieldFixtures.js — Sprint 13 typed fixtures, authored against the PINNED
// backend shapes (report_models/field_metadata.py, template_models/schema.py,
// read from source 2026-07-22). TEST-ONLY: imported by unit/renderer tests,
// never by app code (mirrors the src/autocomplete/fixtures.js convention;
// enforced by the no-app-import test in fieldFixtures.test.js). Once the
// backend extractor (BE steps 04/05) and /v1/icd10/search (BE step 03) land,
// contract integration tests replay real curls instead — these fixtures never
// stand in for a live backend in app code.

// A template with one section of every sprint-13 field type (+ prose).
export const FIXTURE_TEMPLATE = {
  id: "9a1f0d2c-5b3e-4c7a-8f6d-1e2a3b4c5d6e",
  code: "cardio_exam",
  schema_version: 3,
  name: { uk: "Кардіологічний огляд", en: "Cardiology exam" },
  sections: [
    { id: "anamnesis", field_type: "free_text", required: true,
      name: { uk: "Анамнез", en: "History" }, options: [] },
    { id: "pain_location", field_type: "choice", required: true,
      name: { uk: "Локалізація болю", en: "Pain location" },
      options: [
        { value: "retrosternal", label: "Загрудинний", voice_aliases: ["за грудиною"] },
        { value: "left_arm", label: "Ліва рука", voice_aliases: ["ліва рука", "в ліву руку"] },
        { value: "none", label: "Немає", voice_aliases: ["немає болю"] },
      ] },
    { id: "risk_factors", field_type: "multi_choice", required: false,
      name: { uk: "Фактори ризику", en: "Risk factors" },
      options: [
        { value: "smoking", label: "Куріння", voice_aliases: ["курить"] },
        { value: "hypertension", label: "Гіпертензія", voice_aliases: ["тиск"] },
        { value: "diabetes", label: "Діабет", voice_aliases: ["цукровий діабет"] },
      ] },
    { id: "lvef", field_type: "numeric_with_unit", required: true,
      name: { uk: "ФВ ЛШ", en: "LVEF" }, options: [] },
    { id: "onset_date", field_type: "date", required: false,
      name: { uk: "Дата початку", en: "Onset date" }, options: [] },
    { id: "diagnosis", field_type: "structured_diagnosis", required: true,
      name: { uk: "Діагноз", en: "Diagnosis" }, options: [] },
  ],
};

// Extracted (proposal) metadata — one per field type, contract-valid.
export const EXTRACTED_META = {
  choice: { source: "extracted", confidence: 0.87, selected: "retrosternal" },
  multi_choice: { source: "extracted", confidence: 0.74, selected: ["smoking", "hypertension"] },
  numeric_with_unit: { source: "extracted", confidence: 0.91, value: 42, unit: "%" },
  date: { source: "extracted", confidence: 0.8, date: "2026-07-15" },
  structured_diagnosis: {
    source: "extracted", confidence: 0.82,
    proposals: [
      { code: "I20.0", display: "Нестабільна стенокардія", confidence: 0.82 },
      { code: "I25.1", display: "Атеросклеротична хвороба серця", confidence: 0.61 },
    ],
  },
};

// Clinician-confirmed metadata (source manual, NO confidence).
export const MANUAL_META = {
  choice: { source: "manual", selected: "retrosternal" },
  multi_choice: { source: "manual", selected: ["smoking"] },
  numeric_with_unit: { source: "manual", value: 42, unit: "%" },
  date: { source: "manual", date: "2026-07-15" },
};

// A loaded draft's content, mid-review: extractor filled everything, the
// clinician confirmed nothing yet; one code already confirmed earlier lives
// in section.icd10 (the single authority).
export const FIXTURE_DRAFT_CONTENT = {
  template_id: FIXTURE_TEMPLATE.id,
  template_schema_version: FIXTURE_TEMPLATE.schema_version,
  title: "",
  encounter_date: "2026-07-15",
  sections: [
    { section_key: "anamnesis", text: "Скарги на загрудинний біль при навантаженні." },
    { section_key: "pain_location", text: "біль за грудиною",
      field_specific_metadata: EXTRACTED_META.choice },
    { section_key: "risk_factors", text: "",
      field_specific_metadata: EXTRACTED_META.multi_choice },
    { section_key: "lvef", text: "фракція викиду 42 відсотки",
      field_specific_metadata: EXTRACTED_META.numeric_with_unit },
    { section_key: "onset_date", text: "початок 15 липня",
      field_specific_metadata: EXTRACTED_META.date },
    { section_key: "diagnosis", text: "клініка нестабільної стенокардії",
      icd10: [{ code: "I10", display: "Есенціальна гіпертензія" }],
      field_specific_metadata: EXTRACTED_META.structured_diagnosis },
  ],
  icd10_codes: [],
};

// /v1/icd10/search response (BE step 03 shape). Only is_leaf rows are
// selectable; the non-leaf row is a category header.
export const FIXTURE_ICD10_SEARCH = {
  results: [
    { code: "I20", display: "Стенокардія [грудна жаба]", is_leaf: false },
    { code: "I20.0", display: "Нестабільна стенокардія", is_leaf: true },
    { code: "I20.8", display: "Інші форми стенокардії", is_leaf: true },
  ],
};

// finalize 422 top-level `problems` (BE step 06 shape) — one item per new
// code plus the two existing ones.
export const FIXTURE_FINALIZE_PROBLEMS = [
  { field: "sections.pain_location", code: "choice_not_selected",
    detail: "select one option", section_key: "pain_location", reason: "required choice has no confirmed selection" },
  { field: "sections.lvef", code: "numeric_not_filled",
    detail: "value and unit required", section_key: "lvef", reason: "required numeric field empty" },
  { field: "sections.onset_date", code: "date_not_filled",
    detail: "date required", section_key: "onset_date", reason: "required date field empty" },
  { field: "sections.diagnosis", code: "diagnosis_not_confirmed",
    detail: "confirm or dismiss proposals", section_key: "diagnosis", reason: "proposals pending, nothing confirmed" },
  { field: "sections.diagnosis", code: "missing_icd10",
    detail: "at least one code", section_key: "diagnosis", reason: "no confirmed ICD-10 code" },
  { field: "sections.anamnesis", code: "min_chars",
    detail: "at least 20 characters", section_key: "anamnesis", reason: "too short" },
];

// Voice field operations (BE step 07 shape, sprint-05 WS `final.operations`).
export const FIXTURE_VOICE_OPS = [
  { op: "set_choice", arg: { section_id: "pain_location", value: "left_arm" } },
  { op: "add_choice", arg: { section_id: "risk_factors", value: "diabetes" } },
  { op: "remove_choice", arg: { section_id: "risk_factors", value: "smoking" } },
  { op: "mark_diagnosis_text", arg: { text: "нестабільна стенокардія" } },
  { op: "unknown", arg: { reason: "option_not_found" } },
];
