// breakGlassGate.test.js — the interstitial comes BEFORE the data, and the
// compliance view is read-only.
//
//   node --test src/patients/breakGlassGate.test.js
//
// The claim these pin is a negative and a strong one: when the backend
// answers 403 `phi_access_required`, the clinical payload must never enter
// the DOM — not hidden behind the modal, not rendered underneath it, not
// present-but-blurred. Rendering the real screens and reading the markup back
// is the only way to say that honestly.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ROLES, renderAs, h } from "../testing/renderRole.mjs";
import { isPhiAccessRequired } from "../api/phiAccess.js";

const here = dirname(fileURLToPath(import.meta.url));

const { BreakGlassGate } = await import("./BreakGlassGate.jsx");
const { RequestAccessModal, FALLBACK_REASONS } = await import("../components/RequestAccessModal.jsx");

// What a real 403 from core-service looks like on this path.
const PHI_403 = { status: 403, problem: { code: "phi_access_required" } };

test("the backend's refusal is what triggers the flow — not a client guess", () => {
  // ALWAYS defer to the response as truth: a client that decided for itself
  // who is 'unrelated' would challenge the treating clinician on a slow
  // relationship lookup, and would wave through anyone whose roles looked
  // right to a stale token.
  assert.equal(isPhiAccessRequired(PHI_403), true);
  assert.equal(isPhiAccessRequired({ status: 403 }), false, "a bare 403 is not this");
  assert.equal(isPhiAccessRequired({ status: 404 }), false);
  assert.equal(isPhiAccessRequired(null), false);
});

// ── the interstitial stands in front of the data ───────────────────────

// The record, as a stand-in for whatever clinical surface sits behind the
// gate. If ANY of this reaches the markup while the gate is up, the gate
// failed at the only job it has.
const CLINICAL = () => h("div", { className: "record" },
  h("h2", null, "Хронологія"),
  h("p", null, "Алергія: пеніцилін"),
  h("p", null, "Діагноз: I10"),
);

test("an unrelated principal gets the gate, and NO clinical payload", () => {
  let built = 0;
  const markup = renderAs(ROLES.tenant_admin,
    h(BreakGlassGate, {
      error: PHI_403, lang: "uk", resourceKind: "patient", resourceId: "pat-1",
      onGranted() {},
    }, () => { built += 1; return CLINICAL(); }));

  assert.match(markup, /break-glass-gate/, "the interstitial is what renders");
  for (const leak of [/Хронологія/, /Алергія/, /пеніцилін/, /I10/, /class="record"/]) {
    assert.ok(!leak.test(markup), `clinical payload leaked past the gate: ${leak}`);
  }
  // Stronger than "not shown": not even CONSTRUCTED. `children` is a function
  // for exactly this reason — an element prop would have evaluated the
  // patient's data into props before the gate ever ran.
  assert.equal(built, 0, "the record's JSX was never built");
});

test("the warning is stated plainly, before anything is asked", () => {
  const markup = renderAs(ROLES.tenant_admin,
    h(BreakGlassGate, {
      error: PHI_403, lang: "uk", resourceKind: "patient", resourceId: "pat-1",
    }, CLINICAL));
  // The apostrophe is HTML-escaped in the markup (&#x27;), so match around it.
  assert.match(markup, /не пов.{1,8}язані лікуванням/, "says the relationship is absent");
  assert.match(markup, /Доступ буде зафіксовано/, "and that the access is recorded");
});

test("passing the gate renders the record and nothing else", () => {
  // No error → the gate is not in the way at all. This is the treating
  // clinician's path, and it must cost them nothing.
  let built = 0;
  const markup = renderAs(ROLES.clinician,
    h(BreakGlassGate, { error: null, lang: "uk", resourceId: "pat-1" },
      () => { built += 1; return CLINICAL(); }));
  assert.equal(built, 1);
  assert.match(markup, /Хронологія/);
  assert.ok(!/break-glass-gate/.test(markup), "no interstitial");
  assert.ok(!/Запитати доступ/.test(markup), "nothing asks them to justify themselves");
});

test("an ordinary error is not a break-glass prompt", () => {
  // A 500 must not invite the user to write a justification for a bug.
  for (const err of [{ status: 500 }, { status: 403 }, { status: 404 }]) {
    const markup = renderAs(ROLES.tenant_admin,
      h(BreakGlassGate, { error: err, lang: "uk", resourceId: "p" }, CLINICAL));
    assert.ok(!/break-glass-gate/.test(markup), `status ${err.status} must fall through`);
  }
});

test("leaving is offered alongside continuing", () => {
  const markup = renderAs(ROLES.tenant_admin,
    h(BreakGlassGate, {
      error: PHI_403, lang: "uk", resourceId: "pat-1", onLeave() {},
    }, CLINICAL));
  assert.match(markup, /data-testid="bg-request"/);
  assert.match(markup, /data-testid="bg-leave"/, "a gate with one door is a nudge");
});

// ── who is even offered the door ───────────────────────────────────────

test("a clinical role is not asked to justify itself — there is no door", () => {
  // 2026-08-09. Break-glass is an ADMINISTRATOR's only way into a clinical
  // record; a clinician and a nurse hold `patient.read_full` and `report.read`
  // outright, with the treatment relationship recorded in the audit event
  // rather than required. So a 403 reaching them is a stale token or a deep
  // link into another tenant, not an invitation: offering "Request access"
  // would be a door they cannot open, and — if a server ever agreed — would
  // mint a grant on the one role that must never hold one.
  for (const role of ["clinician", "nurse"]) {
    const markup = renderAs(ROLES[role],
      h(BreakGlassGate, {
        error: PHI_403, lang: "uk", resourceKind: "patient", resourceId: "pat-1",
        onLeave() {},
      }, CLINICAL));
    assert.match(markup, /break-glass-gate/, `${role}: the record still does not render`);
    assert.ok(!/data-testid="bg-request"/.test(markup), `${role} was offered the request`);
    assert.ok(!/data-testid="bg-reason"/.test(markup), `${role} was offered the reason vocabulary`);
    assert.match(markup, /адміністратора/, `${role}: told who can help instead`);
    assert.match(markup, /data-testid="bg-leave"/, `${role}: and a way back`);
    for (const leak of [/Хронологія/, /пеніцилін/, /I10/]) {
      assert.ok(!leak.test(markup), `${role}: clinical payload leaked: ${leak}`);
    }
  }
});

test("a doctor who also administers the clinic keeps the door", () => {
  // The matrix is over ROLES, not people: this account carries both, and the
  // admin role is what break-glass answers to.
  const markup = renderAs(ROLES.clinician_admin,
    h(BreakGlassGate, {
      error: PHI_403, lang: "uk", resourceKind: "patient", resourceId: "pat-1",
    }, CLINICAL));
  assert.match(markup, /data-testid="bg-request"/);
});

test("the modal refuses to become a password prompt for a role that cannot mint", () => {
  // Second lock, behind the gate's: a call site that forgets to check must not
  // be able to put a grant on a clinical role.
  const markup = renderAs(ROLES.nurse,
    h(RequestAccessModal, {
      lang: "uk", resourceKind: "patient", resourceId: "pat-1",
      onClose() {}, onGranted() {},
    }));
  assert.ok(!/type="password"/.test(markup), "no re-authentication is offered");
  assert.ok(!/data-testid="bg-reason"/.test(markup), "no reason to choose");
  assert.ok(!/type="submit"/.test(markup), "and nothing to submit");
  assert.match(markup, /адміністратора/);
});

test("the interstitial states the consequence before anything is typed", () => {
  const markup = renderAs(ROLES.tenant_admin,
    h(RequestAccessModal, {
      lang: "uk", resourceKind: "patient", resourceId: "pat-1",
      patientLabel: "Тест Пацієнт", onClose() {}, onGranted() {},
    }));
  // A person who is surprised afterwards was misled by the dialog.
  assert.match(markup, /журнал аудиту/, "says the access is recorded");
  assert.match(markup, /адміністратор/, "says why they are being asked");
});

test("the reason vocabulary is closed and the justification is required", () => {
  const markup = renderAs(ROLES.tenant_admin,
    h(RequestAccessModal, {
      lang: "uk", resourceKind: "patient", resourceId: "pat-1",
      onClose() {}, onGranted() {},
    }));
  // A closed enum, not a free-text "reason" box. The chooser is the
  // platform MenuSelect, whose options exist only while it is open, so the
  // vocabulary is pinned against the constant instead of the markup — the
  // markup can only show that a chooser (not a text box) is what is served.
  assert.match(markup, /data-testid="bg-reason"/, "reason is chosen from a fixed list");
  assert.match(markup, /aria-haspopup="listbox"/, "…from a listbox, not typed");
  const codes = FALLBACK_REASONS.map((r) => r.code);
  for (const code of ["patient_complaint", "legal_request", "care_continuity", "other"]) {
    assert.ok(codes.includes(code), code);
  }
  // …and the justification is always demanded, not only for `other`.
  assert.match(markup, /data-testid="bg-justification"/);
  assert.match(markup, /aria-required="true"/);
  assert.match(markup, /Обґрунтування/);
});

test("submit is blocked client-side until reason AND justification exist", () => {
  // The submit button starts disabled: nothing has been chosen or written.
  const markup = renderAs(ROLES.tenant_admin,
    h(RequestAccessModal, {
      lang: "uk", resourceKind: "patient", resourceId: "pat-1",
      onClose() {}, onGranted() {},
    }));
  const submit = markup.match(/<button[^>]*type="submit"[^>]*>/);
  assert.ok(submit, "there is a submit control");
  assert.match(submit[0], /disabled/, "and it is refused until the form is answered");
});

// ── the treating clinician is never challenged ─────────────────────────

test("the patient page routes its 403 into the gate, and nothing else does", () => {
  // The wiring, pinned by source: the page must hand the refusal to the gate
  // component rather than growing a second copy of the interstitial that
  // could drift from it.
  const src = readFileSync(join(here, "..", "components", "PatientProfile.jsx"), "utf8");
  assert.match(src, /<BreakGlassGate/, "the page uses the gate");
  assert.match(src, /isPhiAccessRequired\(patientReq\.error\)/,
    "and only on the backend's own refusal code");
});

test("the report page routes its 403 into the same gate", () => {
  // It used to carry its own interstitial, whose copy opened "Administrators
  // hold no standing access to clinical records" — addressed to someone who,
  // being a clinician, was not the person reading it. One gate, one rule about
  // who is offered the door.
  const src = readFileSync(join(here, "..", "components", "Reports.jsx"), "utf8");
  assert.match(src, /<BreakGlassGate/, "the page uses the gate");
  assert.ok(!/RequestAccessModal/.test(src), "and does not reach for the modal itself");
});

// ── the compliance view is read-only ───────────────────────────────────

test("the break-glass review screen offers no way to take the log out", () => {
  // Same stance as the sprint-17 audit viewer (src/admin/noAuditExport.test.js)
  // and with more force: every row names a patient, a reason and a person.
  // Pinned by source, because an export is a MECHANISM — a Blob and an
  // a.click() — and the point is that the mechanism is not in the file.
  const src = readFileSync(join(here, "..", "pages", "PhiAccessLogPage.jsx"), "utf8");
  const FORBIDDEN = [
    /\bcsv\b/i,
    /\bdownload\b/i,
    /createObjectURL/i,
    /new Blob\(/,
    /\.click\(\)/,
    /вивантаж(ити|ення)/i,
    /Експорт/i,
  ];
  for (const re of FORBIDDEN) {
    assert.ok(!re.test(src), `an export mechanism is present: ${re}`);
  }
});

test("the review screen still SHOWS what a reviewer needs", () => {
  // Removing the export must not remove the oversight. The columns that
  // answer who/when/patient/reason/justification stay.
  const src = readFileSync(join(here, "..", "pages", "PhiAccessLogPage.jsx"), "utf8");
  for (const needed of [/reason_code/, /reason_note/, /requested_by/, /resource_id/, /use_count/]) {
    assert.match(src, needed, `the reviewer needs ${needed}`);
  }
});
