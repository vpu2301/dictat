// noteShape.test.js — the conversions that make /notes accept a save.
//
// Every assertion here is pinned to the as-built core-service contract
// (routers/notes.py: `structure: Literal["soap","apso","dap","free"]`,
// `sections: list[dict]`, `extra="forbid"`), because the editor used to send
// an object with an uppercase structure and got a 422 on every keystroke.
import test from "node:test";
import assert from "node:assert/strict";

import {
  deriveTitle,
  fromWireSections,
  isBlank,
  structureFromWire,
  structureToWire,
  toWireSections,
} from "./noteShape.js";

const SOAP_ORDER = ["S", "O", "A", "P"];

test("structure crosses the wire lowercase, and comes back in editor form", () => {
  assert.equal(structureToWire("SOAP"), "soap");
  assert.equal(structureToWire("APSO"), "apso");
  assert.equal(structureToWire("DAP"), "dap");
  assert.equal(structureToWire("free"), "free");
  // Anything unknown degrades to the one structure that cannot be wrong.
  assert.equal(structureToWire("???"), "free");

  assert.equal(structureFromWire("soap"), "SOAP");
  assert.equal(structureFromWire("SOAP"), "SOAP", "case-insensitive on the way back");
  assert.equal(structureFromWire(null), "free");
});

test("sections become an ordered LIST keyed by the catalogue's names", () => {
  const wire = toWireSections({
    structure: "SOAP",
    order: SOAP_ORDER,
    contents: { S: "скарги на кашель", A: "ГРВІ" },
  });
  assert.deepEqual(wire, [
    { key: "subjective", content: "скарги на кашель" },
    { key: "objective", content: "" },
    { key: "assessment", content: "ГРВІ" },
    { key: "plan", content: "" },
  ]);
});

test("an empty section is kept, not dropped", () => {
  // A SOAP note with nothing under Plan still HAS a Plan; dropping it would
  // reshape the document on every save.
  const wire = toWireSections({ structure: "SOAP", order: SOAP_ORDER, contents: { S: "x" } });
  assert.equal(wire.length, 4);
  assert.deepEqual(wire.map((s) => s.key), ["subjective", "objective", "assessment", "plan"]);
});

test("free text is one section called note", () => {
  assert.deepEqual(
    toWireSections({ structure: "free", freeText: "пацієнт скаржиться на біль" }),
    [{ key: "note", content: "пацієнт скаржиться на біль" }],
  );
});

test("a stored note hydrates back into editor state", () => {
  const { contents, freeText } = fromWireSections([
    { key: "subjective", content: "скарги" },
    { key: "objective", content: "" },
    { key: "assessment", content: "ГРВІ" },
    { key: "plan", content: "спокій" },
  ]);
  assert.deepEqual(contents, { S: "скарги", O: "", A: "ГРВІ", P: "спокій" });
  assert.equal(freeText, "");
});

test("a free-text note hydrates into the free field", () => {
  const { contents, freeText } = fromWireSections([{ key: "note", content: "текст" }]);
  assert.equal(freeText, "текст");
  assert.deepEqual(contents, {});
});

test("round trip preserves what the clinician typed", () => {
  const contents = { S: "скарги", O: "т 37.2", A: "ГРВІ", P: "спокій" };
  const back = fromWireSections(toWireSections({ structure: "SOAP", order: SOAP_ORDER, contents }));
  assert.deepEqual(back.contents, contents);
});

test("a malformed section list never yields the string 'undefined'", () => {
  const { contents } = fromWireSections([{ key: "subjective" }, null, { content: "orphan" }]);
  assert.equal(contents.S, "");
  assert.equal(Object.values(contents).includes("undefined"), false);
});

test("the title comes from the first thing actually written", () => {
  assert.equal(
    deriveTitle({ structure: "SOAP", order: SOAP_ORDER, contents: { S: "", O: "  ", A: "ГРВІ, легкий перебіг" } }),
    "ГРВІ, легкий перебіг",
  );
  assert.equal(deriveTitle({ structure: "free", freeText: "коротка нотатка" }), "коротка нотатка");
  assert.equal(deriveTitle({ structure: "free", freeText: "   " }), "");
  const long = deriveTitle({ structure: "free", freeText: "я".repeat(200) });
  assert.equal(long.length, 60, "capped, with an ellipsis as the 60th char");
  assert.ok(long.endsWith("…"));
});

test("blank means nothing to save", () => {
  assert.equal(isBlank({ structure: "free", freeText: "" }), true);
  assert.equal(isBlank({ structure: "free", freeText: " " }), true);
  assert.equal(isBlank({ structure: "free", freeText: "x" }), false);
  assert.equal(isBlank({ structure: "SOAP", contents: { S: "", O: "" } }), true);
  assert.equal(isBlank({ structure: "SOAP", contents: { S: "", O: "щось" } }), false);
});
