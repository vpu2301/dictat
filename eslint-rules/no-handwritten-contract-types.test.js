// no-handwritten-contract-types.test.js — EVA-S01 AC-S01-F-2.
//
// Three layers, because "the rule exists" and "the rule fires in this repo's
// actual lint run" are different claims and the acceptance criterion is the
// second one:
//   1. contractNames() reserves the right names (and not the generic ones)
//   2. RuleTester over the JSDoc form — valid and invalid cases
//   3. a violation planted in a real source file, linted by the real CLI with
//      the real eslint.config.js, asserted to fail the build and then removed
import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { RuleTester } from "eslint";

import rule, { contractNames } from "./no-handwritten-contract-types.js";

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const contractsFile = path.join(repoRoot, "src/types/evidence.d.ts");
const options = [{ contractsFile }];

test("contract names cover the shapes and enums, not the scalar aliases", () => {
  const names = contractNames(contractsFile);
  for (const shape of ["AnswerEnvelope", "Segment", "Citation", "PatientSnapshot",
                       "PatientFact", "ClinicalIntent", "FollowUp", "CheckResult",
                       "AnswerProvenance", "EvidencePassage"]) {
    assert.ok(names.has(shape), `${shape} must be reserved`);
  }
  for (const enumName of ["SegmentKind", "EvidenceTier", "EvidenceAction", "EvidenceTargetKind"]) {
    assert.ok(names.has(enumName), `${enumName} must be reserved`);
  }
  // json-schema-to-typescript emits these as bare `= string` aliases. Reserving
  // `Text` or `Message` across a whole app is a rule nobody could live with.
  for (const generic of ["Text", "Message", "Id", "Url", "Title", "Code"]) {
    assert.ok(!names.has(generic), `${generic} must NOT be reserved`);
  }
});

test("the JSDoc form: a redeclared contract errors, an import alias does not", () => {
  const ruleTester = new RuleTester({
    languageOptions: { ecmaVersion: 2023, sourceType: "module" },
  });
  ruleTester.run("evidence/no-handwritten-contract-types", rule, {
    valid: [
      // The sanctioned alias — names the generated type, does not restate it.
      {
        code: `/** @typedef {import("../types/evidence").Segment} Segment */\nexport const x = 1;`,
        options,
      },
      // A local shape that is not a contract is nobody's business.
      { code: `/** @typedef {{ open: boolean }} DialogState */\nexport const y = 2;`, options },
      // Generic leaf names stay usable.
      { code: `/** @typedef {{ body: string }} Message */\nexport const z = 3;`, options },
      // Same name, allowlisted explicitly.
      {
        code: `/** @typedef {{ id: string }} Segment */\nexport const w = 4;`,
        options: [{ contractsFile, allow: ["Segment"] }],
      },
    ],
    invalid: [
      {
        code: `/** @typedef {{ id: string, kind: string, text: string }} Segment */\nexport const a = 1;`,
        options,
        errors: [{ messageId: "handwritten", data: { name: "Segment", module: "src/types/evidence" } }],
      },
      {
        code: `/** @typedef {{ answer_id: string }} AnswerEnvelope */\nexport const b = 2;`,
        options,
        errors: 1,
      },
      {
        code: `/**\n * @typedef {"evidence"|"patient_fact"} SegmentKind\n */\nexport const c = 3;`,
        options,
        errors: 1,
      },
    ],
  });
});

test("the TS declaration visitors fire when a TypeScript parser is configured", () => {
  // The repo has no TS sources, so espree never produces these nodes. Drive
  // the visitors directly rather than pretend the coverage exists.
  const reported = [];
  const visitors = rule.create({
    cwd: repoRoot,
    options,
    sourceCode: { getAllComments: () => [] },
    report: (d) => reported.push(d),
  });
  visitors.TSInterfaceDeclaration({ id: { name: "AnswerEnvelope" } });
  visitors.TSTypeAliasDeclaration({ id: { name: "SegmentKind" } });
  visitors.TSInterfaceDeclaration({ id: { name: "DialogState" } });
  assert.deepEqual(reported.map((r) => r.data.name), ["AnswerEnvelope", "SegmentKind"]);
});

test("planted violation: the real CLI fails on a real source file", async () => {
  // Inside the evidence module deliberately — real source, matched by the
  // config's own globs. A proof run against a file the config does not lint
  // proves the rule works somewhere nobody ships code.
  //
  // NOT in src/chat/: `node --test` runs test files concurrently, and
  // src/chat/noHostImports.test.js walks that directory. A file that exists for
  // one second is still a file when another test happens to look, and an
  // intermittent failure in an unrelated suite is a bad trade for a fixture
  // location. The evidence walkers skip `__`-prefixed files for the same reason.
  const planted = path.join(repoRoot, "src/components/evidence/__planted-contract-type.js");
  const eslintBin = path.join(repoRoot, "node_modules/.bin/eslint");
  const lint = () => run(eslintBin, ["src/components/evidence"], { cwd: repoRoot });

  // Baseline: the module is clean before planting.
  await lint();

  writeFileSync(
    planted,
    `// EVA-S01 planted violation — written and deleted by\n` +
      `// eslint-rules/no-handwritten-contract-types.test.js.\n` +
      `/** @typedef {{ answer_id: string, summary_segments: object[] }} AnswerEnvelope */\n` +
      `export const planted = true;\n`,
  );
  let failure = null;
  try {
    await lint();
  } catch (err) {
    failure = err;
  } finally {
    rmSync(planted, { force: true });
  }
  assert.ok(failure, "eslint passed a file redeclaring AnswerEnvelope");
  assert.match(failure.stdout ?? "", /AnswerEnvelope" is an evidence contract type/);
  assert.match(failure.stdout ?? "", /no-handwritten-contract-types/);

  // …and green again once it is gone, so the proof cannot pass by leaving the
  // repo permanently dirty.
  await lint();
  assert.equal(readFileSync(contractsFile, "utf8").startsWith("/* GENERATED"), true);
});
