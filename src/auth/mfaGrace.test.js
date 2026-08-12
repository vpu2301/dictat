// mfaGrace.test.js — the enrolment route builder + return-path sanitiser.
//
// The `return` value round-trips through the URL, so the sanitiser is a
// security boundary, not a convenience: it must refuse anything that is not an
// in-app hash path, and must never build a route that loops back into /mfa.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MFA_ENROLMENT_ROUTE,
  mfaEnrolmentRoute,
  sanitizeMfaReturn,
} from "./mfaGrace.js";

test("sanitizeMfaReturn keeps ordinary in-app paths, query included", () => {
  assert.equal(sanitizeMfaReturn("/admin/users"), "/admin/users");
  assert.equal(sanitizeMfaReturn("/admin/users?offset=50"), "/admin/users?offset=50");
  assert.equal(sanitizeMfaReturn("/tenant/members"), "/tenant/members");
});

test("sanitizeMfaReturn collapses everything suspect to '/'", () => {
  assert.equal(sanitizeMfaReturn(""), "/");
  assert.equal(sanitizeMfaReturn(null), "/");
  assert.equal(sanitizeMfaReturn(undefined), "/");
  assert.equal(sanitizeMfaReturn("admin/users"), "/");          // not rooted
  assert.equal(sanitizeMfaReturn("https://evil.example"), "/"); // absolute URL
  assert.equal(sanitizeMfaReturn("//evil.example"), "/");       // protocol-relative
  assert.equal(sanitizeMfaReturn("javascript:alert(1)"), "/");  // not a path at all
});

test("sanitizeMfaReturn refuses an enrolment loop", () => {
  assert.equal(sanitizeMfaReturn("/mfa"), "/");
  assert.equal(sanitizeMfaReturn("/mfa?required=1"), "/");
  assert.equal(sanitizeMfaReturn("/mfa/anything"), "/");
  // …but a path that merely starts with the letters is not /mfa.
  assert.equal(sanitizeMfaReturn("/mfa-help"), "/mfa-help");
});

test("mfaEnrolmentRoute builds the grace route with the way back", () => {
  assert.equal(
    mfaEnrolmentRoute("/admin/users"),
    "/mfa?required=1&return=%2Fadmin%2Fusers",
  );
  // The query string survives the round trip.
  const route = mfaEnrolmentRoute("/admin/audit?from_seq=42");
  const qs = new URLSearchParams(route.split("?")[1]);
  assert.equal(qs.get("required"), "1");
  assert.equal(qs.get("return"), "/admin/audit?from_seq=42");
});

test("mfaEnrolmentRoute without a usable return is the bare grace route", () => {
  assert.equal(mfaEnrolmentRoute(""), MFA_ENROLMENT_ROUTE);
  assert.equal(mfaEnrolmentRoute("/"), MFA_ENROLMENT_ROUTE);
  assert.equal(mfaEnrolmentRoute("/mfa?required=1"), MFA_ENROLMENT_ROUTE);
  assert.equal(mfaEnrolmentRoute("//evil.example"), MFA_ENROLMENT_ROUTE);
});

test("round trip: what the route carries is what the sanitiser hands back", () => {
  const original = "/admin/users?offset=100";
  const route = mfaEnrolmentRoute(original);
  const carried = new URLSearchParams(route.split("?")[1]).get("return");
  assert.equal(sanitizeMfaReturn(carried), original);
});
