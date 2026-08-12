// sessionEnd.test.js — the announcement everything else hangs off.

import test from "node:test";
import assert from "node:assert/strict";

import {
  SESSION_END,
  clearSessionEndReason,
  endSession,
  onSessionEnd,
  peekSessionEndReason,
  takeSessionEndReason,
} from "./sessionEnd.js";

// Module state is shared across tests by design (it is a singleton bus), so
// every case starts from a known floor.
const reset = () => clearSessionEndReason();

test("the reason survives the redirect and is consumed exactly once", () => {
  reset();
  endSession(SESSION_END.REVOKED);
  assert.equal(peekSessionEndReason(), SESSION_END.REVOKED, "peek must not consume");
  assert.equal(takeSessionEndReason(), SESSION_END.REVOKED);
  // The login screen has now said it. A reload of that screen must not repeat
  // an ending the user already read and acted on.
  assert.equal(takeSessionEndReason(), null);
});

test("subscribers are told, with the reason", () => {
  reset();
  const seen = [];
  const off = onSessionEnd((r) => seen.push(r));
  endSession(SESSION_END.EXPIRED);
  off();
  endSession(SESSION_END.REVOKED); // after unsubscribe — must not be heard
  assert.deepEqual(seen, [SESSION_END.EXPIRED]);
});

test("the same ending is announced once, however many requests discover it", () => {
  reset();
  let calls = 0;
  const off = onSessionEnd(() => { calls++; });
  // Six parallel requests all get a 401 from the same revocation.
  for (let i = 0; i < 6; i++) endSession(SESSION_END.REVOKED);
  off();
  assert.equal(calls, 1, "a revoked session must not produce six banners");
});

test("a different reason after the first still gets through", () => {
  reset();
  const seen = [];
  const off = onSessionEnd((r) => seen.push(r));
  endSession(SESSION_END.EXPIRED);
  endSession(SESSION_END.REVOKED);
  off();
  assert.deepEqual(seen, [SESSION_END.EXPIRED, SESSION_END.REVOKED]);
});

test("a throwing subscriber cannot stop the others learning", () => {
  reset();
  let reached = false;
  const offBad = onSessionEnd(() => { throw new Error("boom"); });
  const offGood = onSessionEnd(() => { reached = true; });
  assert.doesNotThrow(() => endSession(SESSION_END.REVOKED));
  offBad(); offGood();
  assert.ok(reached, "the auth context must still be cleared");
});

test("an unknown reason degrades to expiry rather than vanishing", () => {
  reset();
  // Better to tell a user their session expired than to say nothing because a
  // future caller passed a string this module has not heard of.
  assert.equal(endSession("something_new"), SESSION_END.EXPIRED);
  assert.equal(peekSessionEndReason(), SESSION_END.EXPIRED);
});

test("signing out is a distinct reason, so the login screen can stay quiet", () => {
  reset();
  endSession(SESSION_END.SIGNED_OUT);
  assert.equal(takeSessionEndReason(), SESSION_END.SIGNED_OUT);
  // …and it is not one of the three the banner explains.
  assert.notEqual(SESSION_END.SIGNED_OUT, SESSION_END.EXPIRED);
  assert.notEqual(SESSION_END.SIGNED_OUT, SESSION_END.REVOKED);
});

test("a fresh login wipes the previous ending", () => {
  reset();
  endSession(SESSION_END.REVOKED);
  clearSessionEndReason();          // what login() calls on success
  assert.equal(peekSessionEndReason(), null);
});
