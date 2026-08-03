// noteShape.js — the editor's shape ⇄ the /notes wire shape.
//
// These disagreed in three ways, and every one of them 422'd the save:
//
//   editor                        core-service NoteCreate
//   ──────────────────────────    ──────────────────────────────────────
//   structure: "SOAP"             structure: Literal["soap","apso","dap","free"]
//   sections:  { S: "скарги" }    sections:  [{key, content}, …]  (a LIST)
//   section ids: S / O / A / P    keys: subjective / objective / …
//                                 (the /note-structures catalogue)
//
// The editor keeps its short ids — they are what the section tabs render —
// and everything crossing the wire goes through here. Pure functions, unit
// tested, no React.

// UI structure id ⇄ the server's lowercase enum.
export const STRUCTURE_TO_WIRE = { SOAP: "soap", APSO: "apso", DAP: "dap", free: "free" };
export const WIRE_TO_STRUCTURE = { soap: "SOAP", apso: "APSO", dap: "DAP", free: "free" };

// Editor section id ⇄ the canonical key GET /note-structures publishes. A
// note written here has to be readable by anything else that speaks that
// catalogue, so "S" never reaches the wire.
export const SECTION_TO_KEY = {
  S: "subjective",
  O: "objective",
  A: "assessment",
  P: "plan",
  D: "data",
  note: "note",
};
export const KEY_TO_SECTION = Object.fromEntries(
  Object.entries(SECTION_TO_KEY).map(([id, key]) => [key, id]),
);

export function structureToWire(structure) {
  return STRUCTURE_TO_WIRE[structure] || "free";
}

export function structureFromWire(wire) {
  return WIRE_TO_STRUCTURE[String(wire || "").toLowerCase()] || "free";
}

/**
 * Editor state → the `sections` list the server stores.
 *
 * `order` is the structure's section ids, so the list keeps the order the
 * clinician sees rather than whatever order the object's keys happened to be
 * written in. Empty sections are kept: a SOAP note with nothing under "Plan"
 * still has a Plan, and dropping it would silently reshape the document on
 * every save.
 */
export function toWireSections({ structure, order = [], contents = {}, freeText = "" }) {
  if (structure === "free") {
    return [{ key: "note", content: String(freeText ?? "") }];
  }
  return order.map((id) => ({
    key: SECTION_TO_KEY[id] || id,
    content: String(contents[id] ?? ""),
  }));
}

/**
 * The stored `sections` list → editor state.
 * @returns {{ contents: object, freeText: string }}
 */
export function fromWireSections(sections) {
  const contents = {};
  let freeText = "";
  for (const s of Array.isArray(sections) ? sections : []) {
    // Tolerate both `content` and `text`: nothing else writes notes today,
    // but a section that arrives with neither must not become "undefined".
    const value = String(s?.content ?? s?.text ?? "");
    const key = String(s?.key ?? "");
    if (key === "note") {
      freeText = value;
      continue;
    }
    contents[KEY_TO_SECTION[key] || key] = value;
  }
  return { contents, freeText };
}

/**
 * A note has no title field in the editor, but the server has one and a list
 * with a column of blanks is a list nobody can scan. Derive it from the first
 * words the clinician actually wrote.
 */
export function deriveTitle({ structure, order = [], contents = {}, freeText = "" }) {
  const first =
    structure === "free"
      ? freeText
      : order.map((id) => contents[id]).find((v) => String(v || "").trim()) || "";
  const flat = String(first).replace(/\s+/g, " ").trim();
  if (!flat) return "";
  return flat.length <= 60 ? flat : `${flat.slice(0, 59)}…`;
}

/** True when there is nothing worth saving yet — the autosave's guard. */
export function isBlank({ structure, contents = {}, freeText = "" }) {
  if (structure === "free") return !String(freeText).trim();
  return !Object.values(contents).some((v) => String(v || "").trim());
}
