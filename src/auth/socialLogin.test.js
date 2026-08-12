/* The URL this builds is the first half of an authentication flow, and it is
 * the half a test can actually pin: where the browser is sent, what it is told
 * to come back to, and what it does with the answer.
 *
 * Run: node --test src/auth/socialLogin.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  SOCIAL_PROVIDERS, isSocialProvider, socialStartUrl, socialRedirectUri,
  readSocialCallback, socialErrorFor, SOCIAL_ERRORS,
} from "./socialLogin.js";

const LOC = { origin: "https://app.klarnote.example", pathname: "/" };

test("the two providers the UI offers are the two that resolve", () => {
  assert.deepEqual(SOCIAL_PROVIDERS.map((p) => p.key), ["google", "apple"]);
  assert.ok(isSocialProvider("google"));
  assert.ok(isSocialProvider("apple"));
  assert.ok(!isSocialProvider("facebook"));
});

test("an unknown provider throws rather than building a URL to nowhere", () => {
  // A typo must fail here, not send a clinician to a 404 on the auth service.
  assert.throws(() => socialStartUrl("gogle", LOC), /unknown provider/);
});

test("the start URL points at auth-service, not at the identity provider", () => {
  // The whole security argument for this design: the browser goes to our own
  // service, which brokers the provider and sets the HttpOnly refresh cookie.
  // A URL pointing straight at Keycloak or Google would mean the SPA is doing
  // its own token exchange and holding a refresh token in JavaScript.
  const url = new URL(socialStartUrl("google", LOC));
  assert.equal(url.pathname, "/auth/social/google/start");
  assert.ok(!/google\.com|apple\.com|openid-connect/.test(url.host + url.pathname));
});

test("the redirect_uri is absolute and carries no hash route", () => {
  // auth-service appends ?social=… to whatever it is given. A query cannot be
  // added after a '#' — it would become part of the SPA's route string and
  // 404 — so the redirect target must be the bare origin + path.
  const url = new URL(socialStartUrl("apple", LOC));
  const back = decodeURIComponent(url.searchParams.get("redirect_uri"));
  assert.equal(back, "https://app.klarnote.example/");
  assert.ok(!back.includes("#"));
  assert.equal(socialRedirectUri(LOC), back);
});

test("the redirect_uri follows the deployment, not a hard-coded host", () => {
  // The SPA runs on localhost, a staging host and each clinic's own domain.
  const local = new URL(socialStartUrl("google", { origin: "http://localhost:5173", pathname: "/" }));
  assert.equal(decodeURIComponent(local.searchParams.get("redirect_uri")), "http://localhost:5173/");
});

test("no marker means this was not a federated round trip", () => {
  assert.equal(readSocialCallback(""), null);
  assert.equal(readSocialCallback("?foo=1"), null);
});

test("a successful return is recognised as one", () => {
  assert.deepEqual(readSocialCallback("?social=ok"), { ok: true, reason: "" });
});

test("a failure carries its reason", () => {
  assert.deepEqual(readSocialCallback("?social=error&reason=no_account"),
    { ok: false, reason: "no_account" });
});

test("anything that is not ok is a failure, including a hostile value", () => {
  // The marker arrives in a URL, so it is attacker-controlled input.
  assert.equal(readSocialCallback("?social=OK").ok, false);
  assert.equal(readSocialCallback("?social=<script>").ok, false);
});

test("an unknown reason degrades to the generic message, never to a blank", () => {
  // A reason string a future backend invents must not render as an empty
  // error box, and must never be echoed to the page — it comes from the URL.
  const e = socialErrorFor("something_new_in_2027", "en");
  assert.equal(e.message, SOCIAL_ERRORS.failed.en);
  assert.equal(e.action, "retry");
  assert.ok(!e.message.includes("something_new"));
});

test("no-account is the invite-only case and points at requesting access", () => {
  // This platform has no self-serve signup; the button cannot create a user.
  // If this ever became `retry` the person would loop on a button that can
  // never succeed for them.
  assert.equal(socialErrorFor("no_account", "en").action, "request");
  assert.match(socialErrorFor("no_account", "en").message, /invite-only/i);
  assert.match(socialErrorFor("no_account", "uk").message, /запрошенням/);
});

test("every error carries both languages and an action the UI can render", () => {
  const actions = new Set(["retry", "request"]);
  for (const [key, e] of Object.entries(SOCIAL_ERRORS)) {
    assert.ok(e.uk && e.uk.trim().length > 8, `${key}: missing uk`);
    assert.ok(e.en && e.en.trim().length > 8, `${key}: missing en`);
    assert.ok(actions.has(e.action), `${key}: unknown action ${e.action}`);
  }
});
