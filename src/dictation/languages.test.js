import test from "node:test";
import assert from "node:assert/strict";

import {
  DICTATION_CODES, UPLOAD_CODES, TEMPLATE_CODES,
  speechLocale, langLabel, asDictationLang, asUploadLang, asTemplateLang,
  supportsUpload, dictationOptions,
} from "./languages.js";

test("German is a dictation language, not an upload or template one", () => {
  assert.deepEqual(DICTATION_CODES, ["uk", "en", "de"]);
  assert.ok(!UPLOAD_CODES.includes("de"), "asr-service pins ^(uk|en)$");
  assert.ok(!TEMPLATE_CODES.includes("de"), "report-service enums uk|en");
  assert.equal(supportsUpload("de"), false);
  assert.equal(supportsUpload("uk"), true);
});

test("the recogniser gets a full locale tag", () => {
  assert.equal(speechLocale("de"), "de-DE");
  assert.equal(speechLocale("uk"), "uk-UA");
  assert.equal(speechLocale("en"), "en-US");
  assert.equal(speechLocale("zz"), "uk-UA", "unknown falls back to the first, never undefined");
});

test("a UI locale is coerced to something the backend accepts", () => {
  assert.equal(asDictationLang("de"), "de");
  assert.equal(asDictationLang("uk"), "uk");
  // The interface speaks eight languages; the socket's contract is three.
  assert.equal(asDictationLang("pl"), "en");
  assert.equal(asDictationLang("ro"), "en");
  assert.equal(asDictationLang(undefined), "en");
});

test("upload and template coercion stop at uk|en — German included", () => {
  assert.equal(asUploadLang("de"), "en");
  assert.equal(asTemplateLang("de"), "en");
  assert.equal(asUploadLang("uk"), "uk");
  assert.equal(asTemplateLang("cs"), "en");
});

test("labels speak the reader's language", () => {
  assert.equal(langLabel("de", "uk"), "Німецька");
  assert.equal(langLabel("de", "en"), "German");
  assert.equal(langLabel("de", "de"), "Deutsch");
  assert.equal(langLabel("de", "pl"), "German", "no translation → English, never blank");
});

test("options carry the code as the label when short", () => {
  const short = dictationOptions("uk", { short: true });
  assert.deepEqual(short.map((o) => o.value), ["uk", "en", "de"]);
  assert.deepEqual(short.map((o) => o.label), ["UK", "EN", "DE"]);
  assert.equal(short[2].sub, "Німецька");
  assert.equal(dictationOptions("en")[2].label, "German");
});
