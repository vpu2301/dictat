// permissionsDrift.test.js — docs/auth/permissions.csv ↔ src/auth/roles.js MATRIX.
//
// The MATRIX is a *mirror*. A mirror that nobody checks is worse than no
// mirror at all: the UI keeps offering a button the backend has started to
// 403, or hides one it has started to allow, and both failures look like
// application bugs rather than a stale table. This test is the check, and it
// runs in both directions:
//
//   CSV → MATRIX   every backend action is either mirrored here or listed in
//                  UNMIRRORED with a reason. Adding a backend action without
//                  deciding which side it falls on fails the build.
//   MATRIX → CSV   every mirrored row names exactly the roles the CSV allows.
//                  No extra role, no missing role.
//
// Two vocabularies have to be reconciled first, and both gaps are historical
// rather than semantic — see ACTION_ALIAS / TARGET_ALIAS below.
//
// The outer guard (vendored CSV vs the backend's own copy) is
// `npm run auth:permissions -- --check`; this is the inner one.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EVIDENCE_ACTIONS, MATRIX, isAllowed, isKnowledgeAdminOnly } from "./roles.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const CSV = path.resolve(here, "../../docs/auth/permissions.csv");
const EVIDENCE_DTS = path.resolve(here, "../types/evidence.d.ts");

const claims = (...roles) => ({ sub: "u1", tid: "t1", roles });

// ── the CSV ───────────────────────────────────────────────────────────
// role,action,target_kind,allowed,notes — the notes column is free text and
// may contain commas, so split on the first four separators only.
function readCsv() {
  const [header, ...rows] = readFileSync(CSV, "utf8").trim().split(/\r?\n/);
  assert.equal(header, "role,action,target_kind,allowed,notes", "CSV header changed shape");
  const allowedBy = new Map(); // "action|target_kind" → Set(role)
  const roles = new Set();
  for (const line of rows) {
    const [role, action, target_kind, allowed] = line.split(",", 4);
    roles.add(role);
    const key = `${action}|${target_kind}`;
    if (!allowedBy.has(key)) allowedBy.set(key, new Set());
    if (allowed === "true") allowedBy.get(key).add(role);
  }
  return { allowedBy, roles };
}

// Roles the CSV carries that a browser session never holds, and which the
// MATRIX therefore does not model:
//  · `service` — machine-to-machine principal (ASR worker, NLP pipeline). It
//    never renders a UI, so mirroring its grants would be noise.
const NON_UI_ROLES = new Set(["service"]);
// …and the reverse: roles the MATRIX carries that the *tenant* CSV does not.
//  · `super_admin` — the cross-tenant operator. Its authority is granted
//    outside the per-tenant matrix (see docs/auth/roles.md); the MATRIX lists
//    it on the oversight rows so the pilot UI does not hide those from staff.
const PLATFORM_ROLES = new Set(["super_admin"]);

// ── vocabulary reconciliation ─────────────────────────────────────────
// dictat named these actions before the backend settled on singular nouns
// (sprints 02-06). Renaming the MATRIX keys today would touch every
// `usePermission(...)` call site in the app for no behavioural gain, so the
// mapping is declared here instead — explicitly, one line per divergence,
// which is also the list to work through if the FE ever adopts CSV names.
// New actions (every evidence.* row) use the CSV name verbatim: no aliases.
const ACTION_ALIAS = {
  "asr.submit": "asr.write",
  "admin.user.invite": "user.invite",
  "admin.user.deactivate": "user.deactivate",
  "templates.read": "template.read",
  // The FE has one write gate; the backend splits the same authority three
  // ways (clone/update/deprecate), all tenant_admin. Compared against update.
  "templates.write": "template.update",
  "reports.create": "report.write",
  "reports.read": "report.read",
  "notes.read": "note.read",
  "notes.write": "note.write",
  "patients.read": "patient.read",
  "patients.write": "patient.write",
  // Both DSAR surfaces (raise a request, run a subject-access export) gate on
  // the backend's single patient.dsar.
  "privacy.dsar": "patient.dsar",
  "privacy.request": "patient.dsar",
};
const TARGET_ALIAS = {
  dictation: "dictation_session",
  job: "asr_job",
  transcript: "nlp_text",
  event: "audit",
  chain: "audit",
};

// Backend actions with no UI gate in dictat, each with the reason it has none.
// This list is deliberately tedious to extend: a new backend action lands in
// the failing-test message until someone decides whether the UI gates on it.
// An evidence.* action may never appear here — see the guard below.
const UNMIRRORED = {
  "autocomplete.read|phrase": "autocomplete is always-on for its callers; no surface toggles it",
  "autocomplete.write|phrase": "phrase learning is implicit in accepting a suggestion",
  "notification.read|notification": "the bell renders whatever the socket delivers",
  "notification.write|notification": "acks/prefs are per-user, not role-gated",
  "patient.read_full|patient": "S15 break-glass: gated by a per-patient grant, not by role",
  "stats.read|tenant": "dashboard KPIs are fetched by the admin dashboard route guard",
  "synonym.read|synonym": "NLP lexicon; no FE surface",
  "synonym.write|synonym": "NLP lexicon; no FE surface",
  "template.clone|template": "folded into templates.write",
  "template.deprecate|template": "folded into templates.write",
  "tenant.create|tenant": "company console only (its own owner gate)",
  "tenant.manage_members|tenant": "company console only",
  "tenant.read|tenant": "every session reads its own tenant",
  "tenant.update|tenant": "admin settings route guard",
  "user.manage_roles|user": "admin users route guard",
  "user.reactivate|user": "platform-wide /admin/users endpoint, not clinic-scoped",
  "user.read|user": "admin users route guard",
  "user.reset_mfa|user": "admin users route guard",
};

const csvKey = (action, target) =>
  `${ACTION_ALIAS[action] ?? action}|${TARGET_ALIAS[target] ?? target}`;

const matrixRows = () =>
  Object.entries(MATRIX).flatMap(([action, byTarget]) =>
    Object.entries(byTarget).map(([target, roles]) => ({ action, target, roles })),
  );

// ── direction 1: MATRIX → CSV ─────────────────────────────────────────
test("every mirrored row names exactly the roles the CSV allows", () => {
  const { allowedBy } = readCsv();
  for (const { action, target, roles } of matrixRows()) {
    const key = csvKey(action, target);
    const csvRoles = allowedBy.get(key);
    assert.ok(
      csvRoles,
      `MATRIX["${action}"].${target} has no CSV row (looked for "${key}"). ` +
        `Either the backend dropped the action or the alias map needs an entry.`,
    );
    const expected = [...csvRoles].filter((r) => !NON_UI_ROLES.has(r)).sort();
    const actual = roles.filter((r) => !PLATFORM_ROLES.has(r)).slice().sort();
    assert.deepEqual(
      actual,
      expected,
      `role drift on ${action}/${target} (CSV row "${key}")`,
    );
  }
});

// ── direction 2: CSV → MATRIX ─────────────────────────────────────────
test("every CSV action is mirrored or explicitly unmirrored", () => {
  const { allowedBy } = readCsv();
  const mirrored = new Set(matrixRows().map((r) => csvKey(r.action, r.target)));
  const unaccounted = [...allowedBy.keys()].filter(
    (key) => !mirrored.has(key) && !(key in UNMIRRORED),
  );
  assert.deepEqual(
    unaccounted,
    [],
    `backend action(s) neither mirrored in MATRIX nor listed in UNMIRRORED:\n  ` +
      unaccounted.join("\n  ") +
      `\nAdd a MATRIX row if the UI gates on it, or an UNMIRRORED entry saying why it doesn't.`,
  );
});

test("UNMIRRORED cannot be used to skip an evidence action, and cannot go stale", () => {
  const { allowedBy } = readCsv();
  for (const key of Object.keys(UNMIRRORED)) {
    assert.ok(
      !key.startsWith("evidence."),
      `${key} is an evidence action — evidence surfaces gate on the matrix, always`,
    );
    assert.ok(allowedBy.has(key), `UNMIRRORED lists "${key}", which the CSV no longer has`);
  }
});

// ── the sprint's own rows ─────────────────────────────────────────────
// Table-driven and written out longhand rather than derived from the MATRIX:
// deriving would make the test agree with whatever the MATRIX says, which is
// the one thing it must not do.
const EVIDENCE_EXPECTED = [
  { action: "evidence.ask", target: "evidence", roles: ["clinician", "nurse", "tenant_admin"] },
  { action: "evidence.context.read", target: "evidence", roles: ["clinician", "nurse"] },
  { action: "evidence.acts.manage", target: "evidence", roles: ["clinician", "tenant_admin"] },
  { action: "evidence.deeptrace.run", target: "evidence", roles: ["clinician", "tenant_admin"] },
  { action: "evidence.drugs.read", target: "evidence", roles: ["clinician", "nurse", "tenant_admin"] },
  { action: "evidence.drugs.predict", target: "evidence", roles: ["clinician"] },
  { action: "evidence.ops.read", target: "evidence", roles: ["auditor", "tenant_admin"] },
  { action: "evidence.corpus.manage", target: "evidence_corpus", roles: ["knowledge_admin", "tenant_admin"] },
  { action: "evidence.domains.manage", target: "evidence_corpus", roles: ["knowledge_admin"] },
];
const ALL_ROLES = ["clinician", "nurse", "tenant_admin", "auditor", "knowledge_admin"];

test("the MATRIX carries all nine evidence actions", () => {
  assert.deepEqual(
    EVIDENCE_ACTIONS,
    EVIDENCE_EXPECTED.map((r) => r.action).sort(),
  );
});

for (const { action, target, roles } of EVIDENCE_EXPECTED) {
  test(`${action} admits exactly ${roles.join(", ")}`, () => {
    for (const role of ALL_ROLES) {
      assert.equal(
        isAllowed(claims(role), action, target),
        roles.includes(role),
        `${role} on ${action}`,
      );
    }
    // Wrong target_kind is not a near miss — it is a different permission.
    const otherTarget = target === "evidence" ? "evidence_corpus" : "evidence";
    assert.equal(isAllowed(claims(roles[0]), action, otherTarget), false);
  });
}

test("the admin ⟂ PHI split survives into evidence", () => {
  const admin = claims("tenant_admin");
  // Generic clinical questions: yes. The same question about a patient: no.
  assert.equal(isAllowed(admin, "evidence.ask", "evidence"), true);
  assert.equal(isAllowed(admin, "evidence.context.read", "evidence"), false);
  // A doctor who also administers the clinic keeps both — roles, not people.
  assert.equal(isAllowed(claims("tenant_admin", "clinician"), "evidence.context.read", "evidence"), true);
});

test("knowledge_admin curates the corpus and touches nothing else", () => {
  const ka = claims("knowledge_admin");
  assert.equal(isKnowledgeAdminOnly(ka), true);
  assert.equal(isAllowed(ka, "evidence.corpus.manage", "evidence_corpus"), true);
  assert.equal(isAllowed(ka, "evidence.domains.manage", "evidence_corpus"), true);
  // Every other row in the whole matrix denies it.
  for (const { action, target } of matrixRows()) {
    if (action === "evidence.corpus.manage" || action === "evidence.domains.manage") continue;
    assert.equal(
      isAllowed(ka, action, target),
      false,
      `knowledge_admin must not hold ${action}/${target}`,
    );
  }
  // A curator who is also a doctor is a doctor too.
  assert.equal(isKnowledgeAdminOnly(claims("knowledge_admin", "clinician")), false);
});

// ── the generated union ───────────────────────────────────────────────
// `EvidenceAction` is what makes permission strings compile-checked from S03.
// A union that has drifted from the MATRIX would type-check code that gates on
// an action the table cannot answer, so the tie is asserted here rather than
// left to the typegen script's good intentions.
test("EvidenceAction union in the generated types equals the MATRIX actions", () => {
  const dts = readFileSync(EVIDENCE_DTS, "utf8");
  const decl = dts.match(/export type EvidenceAction =([^;]+);/);
  assert.ok(decl, "src/types/evidence.d.ts declares no EvidenceAction — re-run npm run contracts:types");
  const members = [...decl[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(members, EVIDENCE_ACTIONS, "regenerate the types after changing evidence actions");
});

test("EvidenceTargetKind union covers the evidence target kinds", () => {
  const dts = readFileSync(EVIDENCE_DTS, "utf8");
  const decl = dts.match(/export type EvidenceTargetKind =([^;]+);/);
  assert.ok(decl, "src/types/evidence.d.ts declares no EvidenceTargetKind");
  const members = [...decl[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(members, ["evidence", "evidence_corpus"]);
});
