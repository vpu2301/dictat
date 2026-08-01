// roles.test.js — the role predicates that decide which nav a user sees.
// Pure data + functions (roles.js imports no React), so `node --test` runs it.
import test from "node:test";
import assert from "node:assert/strict";

import {
  PATIENT_ROLES,
  canReadPatients,
  hasClinicalAccess,
  isAdminOnly,
  isAllowed,
  isAuditorOnly,
} from "./roles.js";

const claims = (...roles) => ({ sub: "u1", tid: "t1", roles });

test("auditor holds no clinical access", () => {
  assert.equal(hasClinicalAccess(claims("auditor")), false);
  assert.equal(hasClinicalAccess(claims("clinician")), true);
  assert.equal(hasClinicalAccess(claims("nurse")), true);
});

test("the patient roster is closed to an auditor", () => {
  assert.equal(canReadPatients(claims("auditor")), false);
  assert.equal(isAllowed(claims("auditor"), "patients.read", "patient"), false);
  assert.equal(isAllowed(claims("auditor"), "patients.write", "patient"), false);
  // …and open to everyone the matrix names.
  for (const role of PATIENT_ROLES) {
    assert.equal(canReadPatients(claims(role)), true, `${role} should read patients`);
  }
});

test("isAuditorOnly is a matrix over roles, not people", () => {
  assert.equal(isAuditorOnly(claims("auditor")), true);
  // A doctor who also audits keeps the whole clinical workspace.
  assert.equal(isAuditorOnly(claims("auditor", "clinician")), false);
  assert.equal(canReadPatients(claims("auditor", "clinician")), true);
  // An admin who also audits is an admin — they keep the roster and the console.
  assert.equal(isAuditorOnly(claims("auditor", "tenant_admin")), false);
  assert.equal(canReadPatients(claims("auditor", "tenant_admin")), true);
  // Non-auditors are never auditor-only.
  assert.equal(isAuditorOnly(claims("tenant_admin")), false);
  assert.equal(isAuditorOnly(claims("clinician")), false);
  assert.equal(isAuditorOnly(null), false);
});

test("an auditor keeps exactly the oversight surfaces", () => {
  const a = claims("auditor");
  assert.equal(isAllowed(a, "audit.read", "event"), true);
  assert.equal(isAllowed(a, "audit.verify", "chain"), true);
  assert.equal(isAllowed(a, "templates.read", "template"), true);
  assert.equal(isAllowed(a, "phi_access.read", "phi_access_request"), true);
  // …and nothing clinical or administrative.
  assert.equal(isAllowed(a, "dictation.start", "dictation"), false);
  assert.equal(isAllowed(a, "asr.submit", "job"), false);
  assert.equal(isAllowed(a, "reports.read", "report"), false);
  assert.equal(isAllowed(a, "notes.read", "note"), false);
  assert.equal(isAllowed(a, "templates.write", "template"), false);
  assert.equal(isAllowed(a, "admin.user.invite", "user"), false);
  assert.equal(isAllowed(a, "privacy.approve", "patient"), false);
});

test("the S14 admin split still holds", () => {
  assert.equal(isAdminOnly(claims("tenant_admin")), true);
  assert.equal(isAdminOnly(claims("tenant_admin", "clinician")), false);
  assert.equal(isAllowed(claims("tenant_admin"), "reports.read", "report"), false);
});
