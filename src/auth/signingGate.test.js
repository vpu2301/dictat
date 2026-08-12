// signingGate.test.js — a qualified signature is a physician's act.
//
//   node --test src/auth/signingGate.test.js
//
// Defect 1 of the 2026-08-09 clinical-governance hotfix: the sprint-09 signing
// UI rendered for nurse, tenant_admin and auditor alike — on the report
// screen, in the Studio preview, on the note editor and review, and as the КЕП
// option in the consent sheet.
//
// These tests RENDER the real components as each role and read the markup back
// (src/testing/renderRole.mjs). That is the difference between "the sign
// button is disabled" and "the sign button was never served", and the hotfix
// asks for the second. Grepping the source — the technique in
// noAuditExport.test.js — cannot tell them apart: the JSX is in the file
// either way; the question is which branch runs.
//
// The FE gate is advisory and these tests do not pretend otherwise: the
// backend is the boundary, and `signingForbiddenMessage` covers what a user
// sees when it refuses.
import { test } from "node:test";
import assert from "node:assert/strict";

import { canSign, isSigningForbidden, SIGNING_ROLES } from "./roles.js";
import { ROLES, renderAs, renderAnonymous, h } from "../testing/renderRole.mjs";

const { SignAction, SignedBadge, signingForbiddenMessage, signingErrorMessage } =
  await import("../components/SignGate.jsx");
const { ConsentSheet } = await import("../patients/ConsentSheet.jsx");

const NON_SIGNERS = ["nurse", "tenant_admin", "auditor"];

// The affordance, as it appears in markup. Ukrainian and English both, because
// a gate that only hid the Ukrainian label would still ship the button.
const SIGN_TOKENS = [/Підписати/, /Sign\b/, /name="sign"/];

const absent = (markup, tokens, who) => {
  for (const t of tokens) {
    assert.ok(!t.test(markup), `${who}: "${t}" must not be in the markup — found it`);
  }
};

// ── the predicate ──────────────────────────────────────────────────────

test("only a clinician may sign", () => {
  assert.deepEqual(SIGNING_ROLES, ["clinician"]);
  assert.equal(canSign(ROLES.clinician), true);
  for (const r of NON_SIGNERS) assert.equal(canSign(ROLES[r]), false, r);
});

test("a doctor who also administers the clinic keeps the act", () => {
  // A matrix over ROLES, not people — the same rule the rest of roles.js uses.
  assert.equal(canSign(ROLES.clinician_admin), true);
});

test("no claims at all is not a signer", () => {
  assert.equal(canSign(null), false);
  assert.equal(canSign(undefined), false);
  assert.equal(canSign({}), false);
  assert.equal(canSign({ roles: [] }), false);
  // A role list that is not a list must not be coerced into one.
  assert.equal(canSign({ roles: "clinician" }), false);
});

// ── the shared gate component ──────────────────────────────────────────

test("the sign action is served to a clinician", () => {
  const markup = renderAs(
    ROLES.clinician,
    h(SignAction, { claims: ROLES.clinician, signed: false, lang: "uk" },
      h("button", null, "Підписати")),
  );
  assert.match(markup, /Підписати/);
});

test("the sign action is ABSENT for every other role", () => {
  for (const r of NON_SIGNERS) {
    const markup = renderAs(
      ROLES[r],
      h(SignAction, { claims: ROLES[r], signed: false, lang: "uk" },
        h("button", null, "Підписати")),
    );
    absent(markup, SIGN_TOKENS, r);
  }
});

test("a SIGNED document still shows its status to a non-clinician", () => {
  // Removing the action must not remove the fact. A nurse who could no longer
  // tell a signed report from an unsigned one would have lost information,
  // not been protected from anything.
  for (const r of NON_SIGNERS) {
    const markup = renderAs(
      ROLES[r],
      h(SignAction, {
        claims: ROLES[r], signed: true, signedAt: "2026-08-01T10:00:00Z",
        signer: "Др. Коваль", lang: "uk",
      }, h("button", null, "Підписати")),
    );
    assert.match(markup, /sign-status-badge/, `${r}: the read-only badge is served`);
    assert.match(markup, /Підписано/, `${r}: says it is signed`);
    assert.match(markup, /Др. Коваль/, `${r}: names the signer`);
    // …but never the act.
    assert.ok(!/<button/.test(markup), `${r}: no actionable control`);
  }
});

test("an UNSIGNED document offers a non-clinician nothing at all", () => {
  for (const r of NON_SIGNERS) {
    const markup = renderAs(
      ROLES[r],
      h(SignAction, { claims: ROLES[r], signed: false, lang: "uk" },
        h("button", null, "Підписати")),
    );
    assert.equal(markup, "", `${r}: no badge, no button, no empty chrome`);
  }
});

test("the badge renders standalone for a read-only viewer", () => {
  const markup = renderAs(ROLES.auditor,
    h(SignedBadge, { signedAt: "2026-08-01T10:00:00Z", lang: "uk" }));
  assert.match(markup, /sign-status-badge/);
  assert.ok(!/<button/.test(markup));
});

test("a stale session is not a signer", () => {
  const markup = renderAnonymous(
    h(SignAction, { claims: null, signed: false, lang: "uk" },
      h("button", null, "Підписати")),
  );
  assert.equal(markup, "");
});

// ── the 403, rendered kindly ───────────────────────────────────────────

test("a refused signing call reads as a rule, not a failure", () => {
  const err = { status: 403, problem: { code: "forbidden" } };
  assert.equal(isSigningForbidden(err), true);
  const msg = signingErrorMessage(err, "uk");
  assert.equal(msg, "Підписання доступне лише лікарю.");
  assert.equal(signingErrorMessage(err, "en"), "Only a physician can sign.");
  // No status code, no error class, nothing to screenshot for support.
  assert.ok(!/403|error|Error/.test(msg));
});

test("a real failure is NOT swallowed by the friendly message", () => {
  // A 500 or a network drop must stay loud — returning null lets the caller
  // fall through to its ordinary error view.
  for (const err of [{ status: 500 }, { status: 0 }, new Error("network"), null]) {
    assert.equal(signingErrorMessage(err, "uk"), null);
    assert.equal(isSigningForbidden(err), false);
  }
});

test("the message exists in both languages and neither is a placeholder", () => {
  for (const lang of ["uk", "en"]) {
    const m = signingForbiddenMessage(lang);
    assert.ok(m && m.length > 10 && !/TODO|FIXME/.test(m));
  }
});

// ── consent: the КЕП option ────────────────────────────────────────────

const consentProps = {
  lang: "uk",
  patient: { id: "p1", name: { uk: "Тест Пацієнт" } },
  onClose() {},
  onGranted() {},
};

test("a nurse may record a consent but is never offered КЕП", () => {
  const markup = renderAs(ROLES.nurse, h(ConsentSheet, consentProps));
  // The acts that ARE hers stay.
  assert.match(markup, /value="verbal"/, "verbal consent is a nurse's to record");
  assert.match(markup, /value="written"/, "so is written");
  // The one that is not, is gone — not disabled, gone.
  assert.ok(!/value="digital"/.test(markup), "the КЕП option must not be served");
  assert.ok(!/КЕП/.test(markup), "nor its label");
  assert.ok(!/disabled/.test(markup), "and not merely disabled");
});

test("a clinician is offered all three consent methods", () => {
  const markup = renderAs(ROLES.clinician, h(ConsentSheet, consentProps));
  for (const m of ["verbal", "written", "digital"]) {
    assert.match(markup, new RegExp(`value="${m}"`), m);
  }
  assert.match(markup, /КЕП/);
});

test("an admin is offered no КЕП option either", () => {
  for (const r of ["tenant_admin", "auditor"]) {
    const markup = renderAs(ROLES[r], h(ConsentSheet, consentProps));
    assert.ok(!/value="digital"/.test(markup), r);
  }
});

// ── no ungated entry point ─────────────────────────────────────────────
// Rendering proves the gates that exist work. This proves none was missed —
// and that the next one added cannot be. Every file that mounts the signing
// flow, or renders a signing affordance, must consult the gate.
test("every file carrying a signing affordance consults the gate", async () => {
  const { readFileSync, readdirSync, statSync } = await import("node:fs");
  const { join, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");

  const walk = (dir) => readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (n === "node_modules" || n === "testing") return [];
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

  // What counts as a signing affordance in source. `SigningFlow` and
  // `ConsentSignDialog` are the dialogs; `name="sign"` is the icon every
  // sign button carries.
  const AFFORDANCE = /<SigningFlow|<ConsentSignDialog|name="sign"|openSign\s*:/;
  // The gate, however it is spelled at the call site.
  const GATED = /canSign\s*\(|<SignAction|SIGNING_ROLES/;

  // The public marketing tree draws the sign ICON as an illustration of the
  // product. It mounts no dialog, has no auth context and calls nothing —
  // excluding it is safe, and the assertion below is what keeps that true.
  const isMarketing = (p) => p.includes("/marketing/") || p.endsWith("LandingPage.jsx");

  const files = walk(root)
    .filter((p) => p.endsWith(".jsx"))
    .filter((p) => !p.endsWith("SignGate.jsx"))         // the gate itself
    .filter((p) => !p.endsWith("SigningFlow.jsx"))      // the dialog's own body
    .filter((p) => !p.endsWith("DevPasswordSign.jsx")); // ditto, dev fallback

  // A signing CALL is the thing that must never be reachable ungated — the
  // icon alone is decoration. Pinned separately so the marketing exclusion
  // above cannot grow into a hiding place.
  const CALL = /<SigningFlow|<ConsentSignDialog|openSign\s*:|initSigning\s*\(/;
  const marketingCalls = files.filter(isMarketing)
    .filter((p) => CALL.test(readFileSync(p, "utf8")))
    .map((p) => p.slice(root.length + 1));
  assert.deepEqual(marketingCalls, [],
    "a marketing page must never mount or invoke the signing flow");

  const offenders = files
    .filter((p) => !isMarketing(p))
    .filter((p) => {
      const src = readFileSync(p, "utf8");
      return AFFORDANCE.test(src) && !GATED.test(src);
    })
    .map((p) => p.slice(root.length + 1));

  assert.deepEqual(offenders, [],
    "these render a signing affordance without consulting canSign()");
});
