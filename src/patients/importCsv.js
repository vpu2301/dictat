// importCsv.js — turning a clinic's spreadsheet into PatientCreate rows.
//
// Pure functions, no DOM and no network: the modal renders what this returns,
// and the unit tests pin the parsing rules that a real export from a legacy
// system will hit — semicolon delimiters (Excel in a uk/de locale), a UTF-8
// BOM, quoted fields with embedded commas and newlines, dd.mm.yyyy dates, and
// "Ч"/"Ж" for sex.
//
// Validation here is deliberately the SAME shape check the server runs
// (src/api/patients.js mirrors core-service `_clean_phone` / `_clean_email`,
// src/patients/ipn.js mirrors the РНОКПП checksum). The point is to show the
// clinician which line is wrong before the upload, not to be the authority —
// the server still decides, and the import endpoint answers per row.

import { isEmailShapeValid, isPhoneShapeValid, normalizeEmail, normalizePhone } from "../api/patients.js";
import { checkIpn, stripIpnSeparators } from "./ipn.js";

// ── Field catalogue ──────────────────────────────────────────────────────
// `key` is what the mapping and the row builder speak; the header synonyms
// are what a real file says. Lowercased + punctuation-stripped before match.
export const IMPORT_FIELDS = [
  { key: "name", required: true, synonyms: ["name", "full name", "patient", "patient name", "fullname", "піб", "ім'я", "имя", "пацієнт", "прізвище та ім'я", "прізвище ім'я по батькові"] },
  { key: "name_en", synonyms: ["name en", "name_en", "latin name", "ім'я латиницею", "имя латиницей"] },
  { key: "dob", synonyms: ["dob", "birth", "birthday", "birth date", "date of birth", "дата народження", "днр", "народження", "дата рождения"] },
  { key: "sex", synonyms: ["sex", "gender", "стать", "пол"] },
  { key: "mrn", synonyms: ["mrn", "chart", "chart no", "record no", "medical record number", "номер картки", "карта", "мрн", "№ картки"] },
  { key: "ipn", synonyms: ["ipn", "rnokpp", "tax id", "іпн", "ипн", "рнокпп", "ідентифікаційний код", "инн"] },
  { key: "phone", synonyms: ["phone", "mobile", "tel", "telephone", "телефон", "моб", "мобільний", "номер телефону"] },
  { key: "email", synonyms: ["email", "e-mail", "mail", "пошта", "ел пошта", "електронна пошта", "почта"] },
  { key: "street", synonyms: ["street", "address", "вулиця", "адреса", "улица"] },
  { key: "house", synonyms: ["house", "building", "apartment", "будинок", "буд", "дім", "квартира", "дом"] },
  { key: "zip", synonyms: ["zip", "postal", "postal code", "postcode", "індекс", "поштовий індекс", "индекс"] },
  { key: "city", synonyms: ["city", "town", "місто", "город"] },
  { key: "country", synonyms: ["country", "країна", "страна"] },
  { key: "tags", synonyms: ["tags", "labels", "теги", "мітки", "ярлики"] },
  { key: "summary", synonyms: ["summary", "diagnosis", "notes", "діагноз", "підсумок", "коротко", "диагноз"] },
];

const FIELD_KEYS = IMPORT_FIELDS.map((f) => f.key);

// ── CSV parsing ──────────────────────────────────────────────────────────

// Excel writes the user's list separator, which is ";" across most of Europe
// and "\t" when the file came out of a "copy the sheet" clipboard paste.
// Guessed from the first line, where the header row lives.
export function detectDelimiter(text) {
  const firstLine = String(text).replace(/^﻿/, "").split(/\r?\n/, 1)[0] || "";
  const counts = [",", ";", "\t", "|"].map((d) => [d, firstLine.split(d).length - 1]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

// RFC 4180-ish reader: quoted fields may contain the delimiter, newlines and
// doubled quotes. Written as a character scan rather than a split() because a
// diagnosis column ("гіпертензія, стадія II") breaks every split-based parser.
export function parseDelimited(text, delimiter) {
  const src = String(text ?? "").replace(/^﻿/, "");
  const d = delimiter || detectDelimiter(src);
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  let i = 0;
  const pushField = () => { row.push(field); field = ""; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };
  while (i < src.length) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 2; continue; }
        quoted = false; i += 1; continue;
      }
      field += ch; i += 1; continue;
    }
    if (ch === '"' && field === "") { quoted = true; i += 1; continue; }
    if (ch === d) { pushField(); i += 1; continue; }
    if (ch === "\r") { i += 1; continue; }
    if (ch === "\n") { pushRow(); i += 1; continue; }
    field += ch; i += 1;
  }
  if (field !== "" || row.length) pushRow();
  // Trailing blank lines are an artifact of every editor; drop them.
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

const normHeader = (h) =>
  String(h ?? "")
    .toLowerCase()
    .replace(/[_.\-–—]+/g, " ")
    .replace(/[»«"'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();

// Synonyms go through the same normaliser as the header, so "E-mail" in the
// file and "e-mail" in the catalogue meet at "e mail" instead of missing each
// other over a hyphen.
const NORMALIZED_FIELDS = IMPORT_FIELDS.map((f) => ({
  key: f.key,
  match: new Set([f.key, ...f.synonyms].map((s) => normHeader(s))),
}));

// header row → { fieldKey: columnIndex }. Unmapped columns are simply absent;
// the modal shows them as ignored so nothing is silently dropped.
export function autoMapHeaders(headers) {
  const mapping = {};
  const used = new Set();
  (headers || []).forEach((raw, index) => {
    const h = normHeader(raw);
    if (!h) return;
    for (const f of NORMALIZED_FIELDS) {
      if (mapping[f.key] !== undefined || used.has(index)) continue;
      if (f.match.has(h)) {
        mapping[f.key] = index;
        used.add(index);
        break;
      }
    }
  });
  return mapping;
}

// A file with no header row at all: if the first line does not map to a single
// known field, treat every line as data and let the caller map by hand.
export function looksLikeHeader(cells) {
  return Object.keys(autoMapHeaders(cells)).length > 0;
}

// ── Value normalisation ──────────────────────────────────────────────────

const pad2 = (n) => String(n).padStart(2, "0");

// Accepts what a spreadsheet actually holds: ISO, dd.mm.yyyy, dd/mm/yyyy and
// yyyy/mm/dd. Returns "" for blank (dob is optional) and null for garbage, so
// the caller can tell "not given" from "unparseable".
export function normalizeDob(raw) {
  const v = String(raw ?? "").trim();
  if (!v) return "";
  let y, m, d;
  let match = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) { [, y, m, d] = match; }
  else {
    match = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (!match) return null;
    [, d, m, y] = match;
  }
  const yi = Number(y), mi = Number(m), di = Number(d);
  if (mi < 1 || mi > 12 || di < 1 || di > 31) return null;
  // Reject 31.02 and friends rather than letting Date roll them forward.
  const probe = new Date(Date.UTC(yi, mi - 1, di));
  if (probe.getUTCFullYear() !== yi || probe.getUTCMonth() !== mi - 1 || probe.getUTCDate() !== di) return null;
  return `${yi}-${pad2(mi)}-${pad2(di)}`;
}

const MALE = new Set(["m", "male", "ч", "чол", "чоловік", "чоловіча", "м", "муж", "мужской"]);
const FEMALE = new Set(["f", "w", "female", "ж", "жін", "жінка", "жіноча", "жен", "женский"]);

// The server enum is M | F | U. Anything unrecognised becomes U rather than a
// row error: an unknown sex is a real record, a rejected row is a lost patient.
export function normalizeSex(raw) {
  const v = String(raw ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (!v) return "U";
  if (MALE.has(v)) return "M";
  if (FEMALE.has(v)) return "F";
  return "U";
}

export function splitTags(raw) {
  return String(raw ?? "")
    .split(/[;,|]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

// ── Row → wire item ──────────────────────────────────────────────────────

const cell = (cells, mapping, key) =>
  mapping[key] === undefined ? "" : String(cells[mapping[key]] ?? "").trim();

/**
 * Build one import row.
 * @returns {{ item: object|null, errors: {field: string, code: string}[], display: object }}
 *   `item` is the PatientCreate body, or null when the row cannot be sent.
 *   `errors` use the same codes the server answers with, so the preview and
 *   the result table speak one vocabulary.
 */
export function buildImportRow(cells, mapping) {
  const errors = [];
  const nameUk = cell(cells, mapping, "name");
  const nameEn = cell(cells, mapping, "name_en") || nameUk;
  if (!nameUk && !nameEn) errors.push({ field: "name", code: "name_required" });

  const dobRaw = cell(cells, mapping, "dob");
  const dob = normalizeDob(dobRaw);
  if (dob === null) errors.push({ field: "dob", code: "dob_invalid" });

  const phoneRaw = cell(cells, mapping, "phone");
  const phone = phoneRaw ? normalizePhone(phoneRaw) : "";
  if (phoneRaw && !isPhoneShapeValid(phoneRaw)) errors.push({ field: "phone", code: "phone_invalid" });

  const emailRaw = cell(cells, mapping, "email");
  const email = emailRaw ? normalizeEmail(emailRaw) : "";
  if (emailRaw && !isEmailShapeValid(emailRaw)) errors.push({ field: "email", code: "email_invalid" });

  const ipnRaw = cell(cells, mapping, "ipn");
  const ipn = ipnRaw ? stripIpnSeparators(ipnRaw) : "";
  if (ipn && !checkIpn(ipn).ok) errors.push({ field: "ipn", code: "ipn_invalid" });

  const summary = cell(cells, mapping, "summary");
  const address = {
    street: cell(cells, mapping, "street"),
    house: cell(cells, mapping, "house"),
    zip: cell(cells, mapping, "zip"),
    city: cell(cells, mapping, "city"),
    country: cell(cells, mapping, "country"),
  };
  const display = {
    name: nameUk || nameEn,
    dob: dob || dobRaw,
    sex: normalizeSex(cell(cells, mapping, "sex")),
    mrn: cell(cells, mapping, "mrn"),
    phone: phone || phoneRaw,
    email: email || emailRaw,
    city: address.city,
    ipn,
  };

  if (errors.length) return { item: null, errors, display };

  const item = {
    name: { uk: nameUk || nameEn, en: nameEn || nameUk },
    sex: display.sex,
    mrn: display.mrn,
    tags: splitTags(cell(cells, mapping, "tags")),
  };
  if (dob) item.dob = dob;
  if (phone) item.phone = phone;
  if (email) item.email = email;
  if (summary) item.summary = { uk: summary, en: summary };
  if (Object.values(address).some(Boolean)) item.address = address;
  if (ipn) item.ipn = ipn;
  return { item, errors, display };
}

/**
 * Parse a whole file into rows ready for the preview table.
 * @returns {{ headers: string[], mapping: object, rows: Array, unmapped: string[] }}
 */
export function parsePatientCsv(text, { mapping: forced } = {}) {
  const table = parseDelimited(text);
  if (!table.length) return { headers: [], mapping: {}, rows: [], unmapped: [] };
  const hasHeader = looksLikeHeader(table[0]);
  const headers = hasHeader ? table[0].map((h) => String(h).trim()) : table[0].map((_, i) => `#${i + 1}`);
  const mapping = forced || (hasHeader ? autoMapHeaders(headers) : {});
  const body = hasHeader ? table.slice(1) : table;
  const mappedCols = new Set(Object.values(mapping));
  return {
    headers,
    mapping,
    unmapped: headers.filter((_, i) => !mappedCols.has(i)),
    rows: body.map((cells, i) => ({ line: i + (hasHeader ? 2 : 1), ...buildImportRow(cells, mapping) })),
  };
}

// The file the "download a template" link hands out — the columns in the
// order the form fills them, with one example row so the date and sex
// notation are self-evident.
export function csvTemplate(lang = "uk") {
  const uk = [
    "ПІБ,Дата народження,Стать,Номер картки,ІПН,Телефон,Email,Місто,Вулиця,Будинок,Індекс,Країна,Теги,Діагноз",
    "Іван Петренко,15.01.1980,Ч,MRN-1001,,+380671234567,ivan@example.com,Київ,вул. Шевченка,12,01001,Україна,діабет;гіпертензія,Цукровий діабет 2 типу",
  ];
  const en = [
    "Name,Date of birth,Sex,MRN,IPN,Phone,Email,City,Street,House,Zip,Country,Tags,Diagnosis",
    "Ivan Petrenko,1980-01-15,M,MRN-1001,,+380671234567,ivan@example.com,Kyiv,Shevchenka St,12,01001,Ukraine,diabetes;hypertension,Type 2 diabetes",
  ];
  return (lang === "uk" ? uk : en).join("\n") + "\n";
}

export const IMPORT_FIELD_KEYS = FIELD_KEYS;
