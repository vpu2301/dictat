// Sprint 11 step 02 — ІПН checksum units. Vectors are SHARED with the
// backend suite (libs/crypto/tests/unit/test_ipn.py) so the two
// implementations can never drift silently.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";

import { checkIpn, stripIpnSeparators } from "./ipn.js";

const VALID = [
  "1759013776", // Σ=270, 270 % 11 = 6
  "2874309631", // Σ=276, 276 % 11 = 1
  "1759113770", // Σ=274, 274 % 11 = 10 → control (10 % 10) = 0 edge case
  "0000000000", // Σ=0 → control 0 (degenerate but formula-valid)
];

test("valid vectors pass and normalize to themselves", () => {
  for (const ipn of VALID) {
    assert.deepEqual(checkIpn(ipn), { ok: true, ipn }, ipn);
  }
});

test("separators (spaces/dashes) are stripped before validation", () => {
  const cases = [
    ["175 901 37 76", "1759013776"],
    ["1759-0137-76", "1759013776"],
    [" 1759013776 ", "1759013776"],
    ["28 74-30 96-31", "2874309631"],
  ];
  for (const [raw, expected] of cases) {
    assert.equal(stripIpnSeparators(raw), expected);
    assert.deepEqual(checkIpn(raw), { ok: true, ipn: expected }, raw);
  }
});

test("shape violations → reason 'shape' (not a checksum message)", () => {
  for (const raw of ["", null, undefined, "175901377", "17590137761", "17590A3776", "175901377б", "١٧٥٩٠١٣٧٧٦"]) {
    assert.deepEqual(checkIpn(raw), { ok: false, reason: "shape" }, String(raw));
  }
});

test("control-digit mismatches → reason 'checksum' (a typo, say so)", () => {
  for (const raw of ["1759013775", "1759013777", "2874309639", "1234567890"]) {
    assert.deepEqual(checkIpn(raw), { ok: false, reason: "checksum" }, raw);
  }
});
