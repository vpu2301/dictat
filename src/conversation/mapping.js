// mapping.js — who is the doctor and who is the patient (sprint 14).
//
// The wire gives anonymous voices (S1/S2). The doctor/patient reading of them
// is a SEPARATE, always-overridable hypothesis, and this module is its whole
// state machine. Kept apart from turns.js on purpose: a mapping flip must
// recolour every already-rendered turn without touching one word of text.
//
// The backend's inference is deliberately conservative — it abstains unless
// clinician-register vocabulary actually discriminates, and it flips only on
// strong evidence. Its silence is meaningful: "no hint ever arrived" is the
// machine saying *I don't know*, and the banner must ask rather than pick.
//
// FREEZING. The moment the clinician assigns the mapping it is authoritative:
// `set_speaker_mapping` stops server-side re-inference for the rest of the
// session, and this module ignores every later non-manual
// `speaker_mapping_updated`. We freeze OPTIMISTICALLY — on the click, not on
// the server's ack — because an inference update already in flight would
// otherwise repaint the screen out from under the clinician who just answered.

export const ROLES = ["doctor", "patient"];

export function emptyMapping() {
  return {
    mapping: {},        // { S1: "doctor"|"patient", ... } — sparse until known
    confidence: 0,
    rationale: "",
    frozen: false,      // manual assignment made → inference is over
    source: "none",     // "none" | "hint" | "inference" | "manual"
    pulse: 0,           // bumped once per accepted change → banner pulses once
  };
}

const clean = (m) => {
  const out = {};
  for (const [label, role] of Object.entries(m || {})) {
    if (role === "doctor" || role === "patient") out[label] = role;
  }
  return out;
};

const same = (a, b) => {
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => a[k] === b[k]);
};

export function isKnown(state) {
  return Object.keys(state.mapping).length > 0;
}

/**
 * `speaker_mapping_hint` off a partial/final — the current hypothesis attached
 * for convenience. It is NOT the authoritative channel, so it only fills a gap:
 * it never overrides an inference update and never touches a frozen mapping.
 */
export function applyHint(state, hint) {
  if (state.frozen || !hint) return state;
  if (state.source === "inference" || state.source === "manual") return state;
  const mapping = clean(hint);
  if (!Object.keys(mapping).length || same(mapping, state.mapping)) return state;
  return { ...state, mapping, source: "hint", pulse: state.pulse + 1 };
}

/**
 * `speaker_mapping_updated` — the authoritative change notification.
 *
 * `manual: true` is the server's acknowledgement of our own set; it confirms
 * the freeze. Anything else arriving after a freeze is a stale inference and is
 * dropped on the floor (VERIFY: "subsequent SpeakerMappingUpdated messages are
 * ignored").
 */
export function applyUpdate(state, msg) {
  if (!msg) return state;
  const mapping = clean(msg.mapping);
  if (msg.manual) {
    return {
      ...state,
      mapping: Object.keys(mapping).length ? mapping : state.mapping,
      confidence: 1,
      rationale: "",
      frozen: true,
      source: "manual",
      // No pulse: the clinician is looking at the change they just made.
      pulse: state.pulse,
    };
  }
  if (state.frozen) return state;
  if (!Object.keys(mapping).length) return state;
  if (same(mapping, state.mapping) && state.source === "inference") return state;
  return {
    ...state,
    mapping,
    confidence: typeof msg.confidence === "number" ? msg.confidence : state.confidence,
    rationale: msg.rationale || "",
    source: "inference",
    pulse: state.pulse + 1,
  };
}

/**
 * The banner's swap button. Returns the next state AND the mapping to put on
 * the wire — the caller sends it; this module never touches the socket.
 *
 * With no hypothesis yet, "swap" has nothing to invert, so it commits the
 * conventional reading (S1 doctor / S2 patient) — one tap from "I don't know"
 * to an explicit, frozen answer, which is still one tap from its opposite.
 */
export function swap(state) {
  const current = isKnown(state) ? state.mapping : { S1: "doctor", S2: "patient" };
  const mapping = {};
  for (const label of new Set([...Object.keys(current), "S1", "S2"])) {
    const role = current[label];
    mapping[label] = role === "doctor" ? "patient" : "doctor";
  }
  return [
    { ...state, mapping, confidence: 1, rationale: "", frozen: true, source: "manual", pulse: state.pulse },
    mapping,
  ];
}

// Assign one voice explicitly (the long-press menu). The other known voice
// takes the opposite role — with two speakers, naming one names both.
export function assignRole(state, label, role) {
  if (role !== "doctor" && role !== "patient") return [state, null];
  const other = label === "S1" ? "S2" : "S1";
  const mapping = { [label]: role, [other]: role === "doctor" ? "patient" : "doctor" };
  return [
    { ...state, mapping, confidence: 1, rationale: "", frozen: true, source: "manual", pulse: state.pulse },
    mapping,
  ];
}

// Role for a speaker label, or null when the mapping can't say (unmapped,
// UNKNOWN, or a segment diarization never labelled). Null is rendered as the
// neutral, visibly-unresolved treatment — never defaulted to a party.
export function roleOf(state, speaker) {
  if (!speaker || speaker === "UNKNOWN") return null;
  return state.mapping[speaker] || null;
}

// Inverse lookup for the menu: which voice currently holds this role?
export function labelForRole(state, role) {
  for (const [label, r] of Object.entries(state.mapping)) {
    if (r === role) return label;
  }
  return null;
}
