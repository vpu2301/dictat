// S14 — units for the break-glass client's pure pieces: the 403 classifier
// that turns a refusal into an offer, and the role predicates that decide
// which surfaces an account may even see.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";

import { isPhiAccessRequired, phiAccessResourceId } from "./phiAccess.js";
import { hasClinicalAccess, isAdminOnly, isAllowed } from "../auth/roles.js";

const REPORT_ID = "33333333-3333-3333-3333-333333333333";

function apiError(status, problem) {
  // Shape mirrors ApiError from client.js — only the fields the
  // classifier reads.
  return { status, problem };
}

const claims = (...roles) => ({ roles, sub: "u", tid: "t" });

// ── the 403 classifier ────────────────────────────────────────────────

test("a phi_access_required 403 is recognised and carries its target", () => {
  const err = apiError(403, {
    code: "phi_access_required",
    resource_kind: "report",
    resource_id: REPORT_ID,
    can_request_access: true,
  });
  assert.equal(isPhiAccessRequired(err), true);
  assert.equal(phiAccessResourceId(err), REPORT_ID);
});

test("a plain role_denied 403 is NOT an invitation to break glass", () => {
  // An auditor hits this: refused, and offering them a request they
  // cannot make would be a dead end dressed up as an action.
  const err = apiError(403, { code: "role_denied", can_request_access: false });
  assert.equal(isPhiAccessRequired(err), false);
});

test("other statuses and malformed errors are never misread as break-glass", () => {
  assert.equal(isPhiAccessRequired(apiError(401, { code: "phi_access_required" })), false);
  assert.equal(isPhiAccessRequired(apiError(404, null)), false);
  assert.equal(isPhiAccessRequired(apiError(403, null)), false);
  assert.equal(isPhiAccessRequired(null), false);
  assert.equal(isPhiAccessRequired(undefined), false);
  assert.equal(phiAccessResourceId(apiError(403, null)), null);
});

// ── role predicates ───────────────────────────────────────────────────

test("clinician and nurse hold clinical access; an admin alone does not", () => {
  assert.equal(hasClinicalAccess(claims("clinician")), true);
  assert.equal(hasClinicalAccess(claims("nurse")), true);
  assert.equal(hasClinicalAccess(claims("tenant_admin")), false);
  assert.equal(hasClinicalAccess(claims("auditor")), false);
});

test("a doctor who also administers the tenant keeps clinical access", () => {
  // The matrix is over ROLES, not people. This is the seeded
  // admin@tenant-a account, which holds both — losing its clinical
  // surfaces would be a regression, not the feature.
  const both = claims("tenant_admin", "clinician");
  assert.equal(hasClinicalAccess(both), true);
  assert.equal(isAdminOnly(both), false);
  assert.equal(isAllowed(both, "reports.read", "report"), true);
});

test("isAdminOnly identifies exactly the accounts S14 restricts", () => {
  assert.equal(isAdminOnly(claims("tenant_admin")), true);
  assert.equal(isAdminOnly(claims("super_admin")), true);
  assert.equal(isAdminOnly(claims("clinician")), false);
  assert.equal(isAdminOnly(claims("auditor")), false);
});

test("an admin-only account is denied clinical surfaces but keeps the roster", () => {
  const admin = claims("tenant_admin");
  assert.equal(isAllowed(admin, "reports.read", "report"), false);
  assert.equal(isAllowed(admin, "notes.read", "note"), false);
  assert.equal(isAllowed(admin, "dictation.read", "dictation"), false);
  assert.equal(isAllowed(admin, "asr.read", "job"), false);
  // The patient list is the surface their job actually needs — and the
  // place they find the report to request.
  assert.equal(isAllowed(admin, "patients.read", "patient"), true);
  assert.equal(isAllowed(admin, "phi_access.request", "phi_access_request"), true);
});

test("only an admin is offered break-glass — a clinician already has the read", () => {
  assert.equal(isAllowed(claims("clinician"), "phi_access.request", "phi_access_request"), false);
  assert.equal(isAllowed(claims("nurse"), "phi_access.request", "phi_access_request"), false);
  // An auditor reads the grant LOG but never the reports themselves.
  assert.equal(isAllowed(claims("auditor"), "phi_access.read", "phi_access_request"), true);
  assert.equal(isAllowed(claims("auditor"), "reports.read", "report"), false);
});
