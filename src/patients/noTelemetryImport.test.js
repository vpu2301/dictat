// Sprint 11 step 02 — module-boundary tripwire: no patient-domain module may
// import the telemetry sink. Extends the S10 telemetry privacy tripwire from
// "outbound keys are whitelisted" to "patient code cannot even reach the
// sink". A build-time grep, not a convention.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

// Every module that handles patient identity. Additions to src/patients/
// are picked up automatically; the explicit list covers the rest.
const PATIENT_MODULES = [
  ...readdirSync(join(SRC, "patients"))
    .filter((f) => /\.(js|jsx)$/.test(f) && !f.includes(".test."))
    .map((f) => join("patients", f)),
  "api/patients.js",
  "api/consents.js",
  "api/privacy.js",
  "api/encounters.js",
  "api/useSearchQuery.js",
  "components/PatientProfile.jsx",
  "components/ConsentFlow.jsx",
];

const FORBIDDEN = [
  /autocomplete\/telemetry/,   // the sink module itself
  /sendTelemetry/,             // its API, however imported
];

test("patient modules never import or call the telemetry sink", () => {
  for (const rel of PATIENT_MODULES) {
    const text = readFileSync(join(SRC, rel), "utf8");
    for (const re of FORBIDDEN) {
      assert.ok(!re.test(text), `${rel} must not reference ${re}`);
    }
  }
});

test("the module list actually covers the roster (self-check)", () => {
  assert.ok(PATIENT_MODULES.some((m) => m.endsWith("PatientDirectory.jsx")));
  assert.ok(PATIENT_MODULES.some((m) => m.endsWith("ipn.js")));
});
