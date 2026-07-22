import test from "node:test";
import assert from "node:assert/strict";
import { normalizeExcluded, excludedKindLabel, formatBytes, downloadErrorMessage } from "./manifest.js";

test("normalizeExcluded: as-built object shape survives verbatim", () => {
  const excluded = [
    { kind: "patient.ipn", reason: "raw ІПН excluded by policy (DSAR_INCLUDE_RAW_IPN=false)" },
    { kind: "recording_audio", reason: "raw audio excluded by policy" },
  ];
  assert.deepEqual(normalizeExcluded(excluded), excluded);
});

test("normalizeExcluded: legacy string entries become {kind, reason:''}", () => {
  assert.deepEqual(normalizeExcluded(["raw_audio"]), [{ kind: "raw_audio", reason: "" }]);
});

test("normalizeExcluded: never yields '[object Object]' for any entry", () => {
  const out = normalizeExcluded([{ kind: "x", reason: "y" }, "z", null, {}]);
  for (const e of out) {
    assert.equal(typeof e.kind, "string");
    assert.equal(typeof e.reason, "string");
    assert.ok(!`${e.kind}${e.reason}`.includes("[object"));
  }
  assert.equal(out.length, 2); // null and {} are dropped
});

test("normalizeExcluded: tolerates missing / non-array input", () => {
  assert.deepEqual(normalizeExcluded(undefined), []);
  assert.deepEqual(normalizeExcluded(null), []);
  assert.deepEqual(normalizeExcluded("raw_audio"), []);
});

test("excludedKindLabel: known kinds translate, unknown fall through", () => {
  assert.equal(excludedKindLabel("recording_audio", "en"), "Raw audio");
  assert.equal(excludedKindLabel("patient.ipn", "uk"), "ІПН");
  assert.equal(excludedKindLabel("something_new", "en"), "something_new");
});

test("formatBytes", () => {
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(2048), "2.0 KB");
  assert.equal(formatBytes(5 * 1024 * 1024), "5.0 MB");
  assert.equal(formatBytes(undefined), null);
});

test("downloadErrorMessage: the 15-minute link expiry gets actionable copy", () => {
  const err = {
    status: 403,
    problem: { code: "download_link_expired", detail: "download link missing or expired (900s TTL) — re-fetch the request status for a fresh link" },
  };
  const en = downloadErrorMessage(err, "en");
  assert.match(en, /15 minutes/);
  assert.ok(!en.includes("900s TTL"));           // no raw backend wording
  assert.match(downloadErrorMessage(err, "uk"), /15 хвилин/);
});

test("downloadErrorMessage: package TTL vs plain 403 vs unknown", () => {
  assert.match(downloadErrorMessage({ status: 410, problem: { code: "package_expired" } }, "en"), /retention window/);
  assert.match(downloadErrorMessage({ status: 403, problem: {} }, "en"), /patient\.dsar/);
  assert.match(downloadErrorMessage({ status: 500, problem: { detail: "boom" } }, "en"), /boom/);
  assert.match(downloadErrorMessage({}, "en"), /Could not download/);
});
