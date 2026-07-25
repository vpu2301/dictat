// register.js — Sprint 13: wires the typed renderers into the field
// dispatch (step 01's registry). Imported once, for its side effect, by
// TipTapEditor — the only app-code entry to the renderer modules. Steps
// 04–05 add their registrations here.
//
// free_text is deliberately absent (unregisterable by contract) and any
// unregistered/unknown field_type falls through to plain prose.

import { registerFieldRenderer } from "../fieldRegistry.js";
import { ChoiceBody } from "./ChoiceBody.js";
import { MultiChoiceBody } from "./MultiChoiceBody.js";
import { NumericBody } from "./NumericBody.js";
import { DateBody } from "./DateBody.js";

registerFieldRenderer("choice", ChoiceBody);
registerFieldRenderer("multi_choice", MultiChoiceBody);
registerFieldRenderer("numeric_with_unit", NumericBody);
registerFieldRenderer("date", DateBody);
// date_with_note is the same renderer: its metadata carries only {date};
// the note IS the section prose (see DateBody.js header).
registerFieldRenderer("date_with_note", DateBody);
// structured_diagnosis is DELIBERATELY not registered (product decision,
// 2026-07-24): dictation stays free of coding chrome — diagnosis sections
// render as plain prose in the Studio, and the ICD-10 picker
// (DiagnosisBody) lives at the REVIEW stage instead: ReportPreview mounts
// it per diagnosis section, right where finalize demands the codes.
// Re-registering it here is all it takes to bring the picker back into
// the dictation editor.
