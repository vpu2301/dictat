// consentTexts.js — the approved consent-text registry.
//
// MUST match the backend's, at infra/seeds/consents/<type>-<version>.md: a
// digital capture with a pair that has no approved text is rejected 422
// consent_text_version_unknown. Versioning is append-only there — a wording
// change is a NEW version, never an edit — so this map only ever grows.
//
// Lives in its own plain module (not ConsentSheet.jsx) so the contract can be
// asserted under `node --test`, which cannot parse JSX.

export const APPROVED_CONSENT_VERSIONS = {
  ai_scribe: ["v1"],
  data_processing: ["v1"],
  // S14 conversation mode records the CONSULTATION — the patient's own voice.
  // Separate lawful basis, separate approved text (recording-v1.md); an
  // ai_scribe consent does not authorise it, and dictation-service enforces
  // that server-side (error consent_required).
  recording: ["v1"],
};
