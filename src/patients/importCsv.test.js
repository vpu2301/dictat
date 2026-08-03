// importCsv.test.js — the parsing rules a real clinic export will hit.
import test from "node:test";
import assert from "node:assert/strict";

import {
  autoMapHeaders,
  buildImportRow,
  csvTemplate,
  detectDelimiter,
  normalizeDob,
  normalizeSex,
  parseDelimited,
  parsePatientCsv,
  splitTags,
} from "./importCsv.js";

// ── delimiters + quoting ────────────────────────────────────────────────

test("detects the delimiter Excel actually wrote", () => {
  assert.equal(detectDelimiter("a,b,c\n1,2,3"), ",");
  assert.equal(detectDelimiter("a;b;c\n1;2;3"), ";");
  assert.equal(detectDelimiter("a\tb\tc"), "\t");
  // Single column, no delimiter anywhere — comma is a harmless default.
  assert.equal(detectDelimiter("name\nІван"), ",");
});

test("a quoted field keeps its commas and newlines", () => {
  const rows = parseDelimited('name,summary\n"Петренко, Іван","діабет,\nстадія II"');
  assert.deepEqual(rows, [
    ["name", "summary"],
    ["Петренко, Іван", "діабет,\nстадія II"],
  ]);
});

test("doubled quotes inside a quoted field collapse to one", () => {
  assert.deepEqual(parseDelimited('a\n"say ""hi"""'), [["a"], ['say "hi"']]);
});

test("a UTF-8 BOM does not become part of the first header", () => {
  const { mapping } = parsePatientCsv("﻿Name,Phone\nІван,+380671234567");
  assert.equal(mapping.name, 0, "BOM-prefixed header must still map");
});

test("blank trailing lines are dropped", () => {
  assert.equal(parseDelimited("a,b\n1,2\n\n\n").length, 2);
});

// ── header mapping ──────────────────────────────────────────────────────

test("maps Ukrainian and English headers, however they are punctuated", () => {
  const m = autoMapHeaders(["ПІБ", "Дата народження", "Стать", "№ картки", "Моб.", "E-mail", "Місто"]);
  assert.deepEqual(m, { name: 0, dob: 1, sex: 2, mrn: 3, phone: 4, email: 5, city: 6 });
  const en = autoMapHeaders(["Full Name", "Date of Birth", "Gender", "MRN", "Telephone", "Mail", "Town"]);
  assert.deepEqual(en, { name: 0, dob: 1, sex: 2, mrn: 3, phone: 4, email: 5, city: 6 });
});

test("a column nobody recognises is reported, not silently dropped", () => {
  const { unmapped } = parsePatientCsv("Name,Insurance policy\nІван,ABC-1");
  assert.deepEqual(unmapped, ["Insurance policy"]);
});

test("a file with no header row is treated as all data", () => {
  const { rows, headers } = parsePatientCsv("Іван Петренко,15.01.1980\nОлена Ковальчук,02.02.1990");
  assert.equal(rows.length, 2, "both lines are data");
  assert.equal(headers[0], "#1");
  // Nothing is mapped, so every row is missing the required name.
  assert.equal(rows[0].errors[0].code, "name_required");
});

// ── value normalisation ─────────────────────────────────────────────────

test("dates arrive in whatever the locale wrote", () => {
  assert.equal(normalizeDob("1980-01-15"), "1980-01-15");
  assert.equal(normalizeDob("15.01.1980"), "1980-01-15");
  assert.equal(normalizeDob("15/01/1980"), "1980-01-15");
  assert.equal(normalizeDob("1980/1/5"), "1980-01-05");
  assert.equal(normalizeDob(""), "", "blank means not given");
  assert.equal(normalizeDob("вчора"), null, "garbage is distinguishable from blank");
  assert.equal(normalizeDob("31.02.1980"), null, "a date that does not exist is not rolled forward");
});

test("sex accepts what a Ukrainian register writes", () => {
  assert.equal(normalizeSex("Ч"), "M");
  assert.equal(normalizeSex("чол."), "M");
  assert.equal(normalizeSex("male"), "M");
  assert.equal(normalizeSex("Ж"), "F");
  assert.equal(normalizeSex("female"), "F");
  assert.equal(normalizeSex(""), "U");
  // Unknown is a real record, not a rejected row.
  assert.equal(normalizeSex("невідомо"), "U");
});

test("tags split on any of the separators a spreadsheet uses", () => {
  assert.deepEqual(splitTags("діабет; гіпертензія|астма, ХОЗЛ"), ["діабет", "гіпертензія", "астма", "ХОЗЛ"]);
  assert.deepEqual(splitTags(""), []);
});

// ── row building ────────────────────────────────────────────────────────

const MAP = { name: 0, dob: 1, sex: 2, mrn: 3, phone: 4, email: 5, city: 6, ipn: 7, tags: 8 };

test("a clean row becomes a PatientCreate body", () => {
  const { item, errors } = buildImportRow(
    ["Іван Петренко", "15.01.1980", "Ч", "MRN-1", "+380 (67) 123-45-67", "IVAN@Example.com ", "Київ", "", "діабет;гіпертензія"],
    MAP,
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(item.name, { uk: "Іван Петренко", en: "Іван Петренко" });
  assert.equal(item.dob, "1980-01-15");
  assert.equal(item.sex, "M");
  assert.equal(item.mrn, "MRN-1");
  // Normalised exactly as the server would store them.
  assert.equal(item.phone, "+380671234567");
  assert.equal(item.email, "ivan@example.com");
  assert.deepEqual(item.tags, ["діабет", "гіпертензія"]);
  assert.deepEqual(item.address, { street: "", house: "", zip: "", city: "Київ", country: "" });
  assert.equal("ipn" in item, false, "an empty ІПН is not sent");
});

test("optional fields left blank do not reach the wire", () => {
  const { item } = buildImportRow(["Іван", "", "", "", "", "", "", "", ""], MAP);
  assert.deepEqual(Object.keys(item).sort(), ["mrn", "name", "sex", "tags"]);
  assert.equal(item.sex, "U");
});

test("a row without a name cannot be sent", () => {
  const { item, errors } = buildImportRow(["   ", "15.01.1980"], MAP);
  assert.equal(item, null);
  assert.deepEqual(errors, [{ field: "name", code: "name_required" }]);
});

test("bad phone / e-mail / ІПН are flagged with the server's own codes", () => {
  const { item, errors } = buildImportRow(
    ["Іван", "", "", "", "не телефон", "broken.example.com", "", "1234567890", ""],
    MAP,
  );
  assert.equal(item, null);
  assert.deepEqual(errors.map((e) => e.code), ["phone_invalid", "email_invalid", "ipn_invalid"]);
});

test("a valid ІПН passes the checksum through to the wire", () => {
  // 1234567899 satisfies the РНОКПП control digit.
  const { item, errors } = buildImportRow(["Іван", "", "", "", "", "", "", "1234567899", ""], MAP);
  assert.deepEqual(errors, []);
  assert.equal(item.ipn, "1234567899");
});

test("the whole-file parse numbers rows by spreadsheet line", () => {
  const { rows } = parsePatientCsv("ПІБ,Телефон\nІван,+380671234567\nОлена,не телефон");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].line, 2, "line 1 is the header");
  assert.equal(rows[1].line, 3);
  assert.equal(rows[1].errors[0].code, "phone_invalid");
  // The display row survives a failed validation so the preview can show it.
  assert.equal(rows[1].display.name, "Олена");
});

test("the offered template parses back into valid rows", () => {
  for (const lang of ["uk", "en"]) {
    const { rows } = parsePatientCsv(csvTemplate(lang));
    assert.equal(rows.length, 1, `${lang}: one example row`);
    assert.deepEqual(rows[0].errors, [], `${lang}: the template must be importable as-is`);
    assert.equal(rows[0].item.dob, "1980-01-15");
    assert.equal(rows[0].item.sex, "M");
  }
});
