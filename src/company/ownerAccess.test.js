import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_OWNER_EMAILS,
  PLATFORM_ROLES,
  isPlatformOwner,
  ownerEmailOf,
  ownerGateReason,
  parseOwnerEmails,
} from "./ownerAccess.js";

const OWNERS = ["vpu2301@gmail.com"];

test("no session is never an owner", () => {
  assert.equal(isPlatformOwner(null, OWNERS), false);
  assert.equal(ownerGateReason(null, OWNERS), "no-session");
});

test("allowlisted email on db_user grants the console", () => {
  const state = { claims: { roles: ["tenant_admin"] }, dbUser: { email: "vpu2301@gmail.com" } };
  assert.equal(isPlatformOwner(state, OWNERS), true);
  assert.equal(ownerGateReason(state, OWNERS), "owner");
});

test("email match is case- and whitespace-insensitive", () => {
  const state = { claims: { roles: [] }, dbUser: { email: "  VPU2301@Gmail.COM " } };
  assert.equal(isPlatformOwner(state, OWNERS), true);
});

test("the snake_case /auth/me shape is accepted too", () => {
  const state = { claims: { roles: [] }, db_user: { email: "vpu2301@gmail.com" } };
  assert.equal(isPlatformOwner(state, OWNERS), true);
});

test("a tenant_admin who is not allowlisted is refused", () => {
  const state = { claims: { roles: ["tenant_admin"] }, dbUser: { email: "admin@tenant-a.example" } };
  assert.equal(isPlatformOwner(state, OWNERS), false);
  assert.equal(ownerGateReason(state, OWNERS), "not-owner");
});

test("a platform role grants the console regardless of email", () => {
  for (const role of PLATFORM_ROLES) {
    const state = { claims: { roles: [role] }, dbUser: { email: "someone@else.example" } };
    assert.equal(isPlatformOwner(state, OWNERS), true, role);
  }
});

test("a session with no email at all is refused, not crashed", () => {
  assert.equal(isPlatformOwner({ claims: { roles: ["clinician"] } }, OWNERS), false);
  assert.equal(ownerEmailOf({ claims: {} }), "");
  assert.equal(ownerEmailOf(null), "");
});

test("parseOwnerEmails normalises a comma list and tolerates blanks", () => {
  assert.deepEqual(parseOwnerEmails(" A@x.com , b@Y.com ,, "), ["a@x.com", "b@y.com"]);
  assert.deepEqual(parseOwnerEmails(""), []);
  assert.deepEqual(parseOwnerEmails(undefined), []);
});

test("the shipped default allowlist is the Klarnote owner account", () => {
  assert.deepEqual(DEFAULT_OWNER_EMAILS, ["vpu2301@gmail.com"]);
});
