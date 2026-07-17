// Sprint 11 step 07 — mutation check on the PII scanner: a hygiene helper
// that cannot catch a PLANTED leak proves nothing. node --test.
import { test } from "node:test";
import assert from "node:assert/strict";

import { findPiiLeaks, genValidIpn } from "./pii.js";

const FIXTURE = { name: "Тест Пацієнт-Х", ipn: "1759013776", mrn: "MRN-777" };
const CLEAN = {
  urls: ["http://localhost:5173/#/patients/6f0a-uuid", "http://localhost:8003/patients?query=%D0%86%D0%B2"],
  storage: { l: { "mdx.tpl.stars.v1": "[]" }, s: {} },
  telemetryBodies: ['{"request_id":"x","event":"shown_only","prefix":"зад"}'],
};

test("clean snapshot → no leaks", () => {
  assert.deepEqual(findPiiLeaks(CLEAN, FIXTURE), []);
});

test("planted leaks ARE caught — name in URL, ІПН in storage, MRN in telemetry", () => {
  const nameInUrl = findPiiLeaks({ ...CLEAN, urls: [...CLEAN.urls, "http://x/#/patients?q=Тест Пацієнт-Х"] }, FIXTURE);
  assert.equal(nameInUrl.length, 1);
  assert.match(nameInUrl[0], /name .* URL/);

  const ipnInStorage = findPiiLeaks({ ...CLEAN, storage: { last: FIXTURE.ipn } }, FIXTURE);
  assert.equal(ipnInStorage.length, 1);

  const mrnInTelemetry = findPiiLeaks({ ...CLEAN, telemetryBodies: ['{"prefix":"MRN-777"}'] }, FIXTURE);
  assert.equal(mrnInTelemetry.length, 1);
});

test("URL-ENCODED leaks are caught too (the sneaky variant)", () => {
  const enc = encodeURIComponent(FIXTURE.name);
  const leaks = findPiiLeaks({ ...CLEAN, urls: [`http://x/?q=${enc}`] }, FIXTURE);
  assert.equal(leaks.length, 1);
});

test("genValidIpn produces checksum-valid 10-digit ІПНs", async () => {
  const { checkIpn } = await import("../../src/patients/ipn.js");
  for (let i = 0; i < 50; i++) {
    const ipn = genValidIpn();
    assert.match(ipn, /^\d{10}$/);
    assert.equal(checkIpn(ipn).ok, true, ipn);
  }
});
