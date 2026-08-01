// speakerActions.js — resolving a clinician's answer into the two things that
// actually change (sprint 14).
//
// The clinician thinks in ROLES ("this is the patient"). The wire thinks in
// anonymous VOICES (S1/S2) plus a doctor/patient mapping over them. Every
// correction therefore lands on one or both of:
//
//   * the TURN's voice   — turns.setTurnSpeaker
//   * the session MAPPING — mapping.assignRole → set_speaker_mapping
//
// Keeping this translation in one pure function is what stops the two models
// drifting apart: a turn tagged "patient" while the mapping says its voice is
// the doctor would be a UI that contradicts itself in front of a clinician.

import { labelForRole } from "./mapping.js";

/**
 * The clinician picked a role for one turn.
 *
 * Returns { speaker, assign } where `speaker` is the voice the turn should
 * carry (null = leave it alone) and `assign` is a mapping change to send
 * (null = none needed).
 *
 * Cases:
 *  - The turn already has a voice → the answer is about the MAPPING: that
 *    voice belongs to that role. The turn keeps its label, and every other
 *    turn of that voice recolours with it (which is the point).
 *  - The turn has no usable voice (UNKNOWN / not yet labelled) → the answer is
 *    about the TURN. It takes the voice that already holds the role; if the
 *    mapping does not know one yet, the answer defines it.
 */
export function chooseRole({ turnSpeaker, mapping, role }) {
  if (role !== "doctor" && role !== "patient") return { speaker: null, assign: null };

  if (turnSpeaker === "S1" || turnSpeaker === "S2") {
    return { speaker: null, assign: { label: turnSpeaker, role } };
  }

  const held = labelForRole(mapping, role);
  if (held) return { speaker: held, assign: null };

  // Nothing is known yet: this turn's voice becomes S1 and defines the mapping.
  return { speaker: "S1", assign: { label: "S1", role } };
}

/**
 * The clinician answered "I can't tell either". That is a real answer about
 * the TURN and must never be pushed into the mapping — abstaining about one
 * turn says nothing about which voice is the clinician.
 */
export function chooseUnknown() {
  return { speaker: "UNKNOWN", assign: null };
}
