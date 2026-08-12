// mfa.spec.js — TOTP enrolment and the login second step (sprint 16).
//
// Against auth-service's contract as built (routers/mfa.py, routers/login.py,
// ADR-0039):
//
//   POST /auth/mfa/enrol  → { provisioning_uri, secret, issuer, account }
//   POST /auth/mfa/verify → { enrolled, enrolled_at } | 400 invalid | 409 stale
//   POST /auth/login      → 401 + code otp_required | otp_invalid | otp_unavailable
//   403 code=mfa_enrolment_required — the grace flow, from any gated endpoint
//
// The TOTP arithmetic is the REAL RFC 6238 computation, done here in the spec
// from RFC 4226's own test-vector secret. That matters: a fixture that accepts
// any six digits proves the form submits, not that enrolment works. This one
// computes the code the way an authenticator app would, and the fixture
// backend accepts only that.
//
// And the assertion that has nothing to do with UI: after a completed
// enrolment the secret must not be findable in localStorage, sessionStorage,
// cookies, the URL or the console. A second factor stored where the first
// factor's attacker can also reach is not a second factor.

import { test, expect } from "@playwright/test";
import crypto from "node:crypto";

const TENANT_A = "00000000-0000-0000-0000-00000000000a";

// RFC 4226 §D test key "12345678901234567890", base32-encoded. Not a
// credential — a published test vector, which is the point.
const SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
const ISSUER = "Klarnote";
const ACCOUNT = "user@tenant-a.example";
const PROVISIONING_URI =
  `otpauth://totp/${ISSUER}:${ACCOUNT}?secret=${SECRET}&issuer=${ISSUER}` +
  "&algorithm=SHA1&digits=6&period=30";

// RFC 6238 over RFC 4226 — the same six digits the clinician's phone shows.
function totpNow(secret = SECRET, at = Date.now()) {
  const key = Buffer.from(base32Decode(secret));
  const counter = Math.floor(at / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const digest = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(code % 1_000_000).padStart(6, "0");
}

function base32Decode(s) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of s.replace(/=+$/, "").toUpperCase()) {
    value = (value << 5) | A.indexOf(ch);
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Uint8Array.from(out);
}

function meBody({ mfa = false, enrolled = false } = {}) {
  return {
    claims: {
      sub: "user-123", tid: TENANT_A, roles: ["clinician"], scope: "openid",
      iss: "mock", mfa, mfa_enrolled: enrolled,
    },
    db_user: {
      email: ACCOUNT, display_name: "Dr Test", role: "clinician", status: "active",
      mfa_enrolled_at: enrolled ? "2026-08-08T09:00:00Z" : null,
    },
  };
}

/**
 * The auth-service fixture.
 *
 * `requireOtp` turns on the login second factor; `enrolled` decides whether
 * enrol 409s; `graceOn` makes every non-auth endpoint answer the 403 grace
 * signal. Each switch corresponds to one deployment state a clinic can
 * actually be in.
 */
function installAuth(page, opts = {}) {
  const ctl = {
    requireOtp: false,
    enrolled: false,
    graceOn: false,
    enrolFails: null,      // null | 403 | 409 | 503
    verifyFails: null,     // null | 409
    sessionOpen: false,
    enrolCalls: 0,
    verifyCalls: 0,
    loginBodies: [],
    ...opts,
  };

  const isApi = (url) =>
    url.hostname === "localhost" &&
    ["8000", "8001", "8002", "8003", "8004", "8005", "8006", "8007", "8008", "8009"].includes(url.port);

  const done = page.route(isApi, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();
    const json = (status, body, headers) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body), headers });
    const MFA_CHALLENGE = { "www-authenticate": 'MFA realm="medical-dictation"' };

    if (path.endsWith("/auth/login") && method === "POST") {
      const form = new URLSearchParams(req.postData() || "");
      const otp = form.get("otp");
      ctl.loginBodies.push({ email: form.get("email"), otp });
      if (ctl.requireOtp) {
        if (ctl.otpUnavailable) {
          return json(401, { code: "otp_unavailable", detail: "MFA verification unavailable; try again" }, MFA_CHALLENGE);
        }
        if (!otp) return json(401, { code: "otp_required", detail: "TOTP code required for this account" }, MFA_CHALLENGE);
        if (otp !== totpNow()) return json(401, { code: "otp_invalid", detail: "invalid TOTP code" }, MFA_CHALLENGE);
      }
      ctl.sessionOpen = true;
      return json(200, { access_token: "tok", expires_in: 300, token_type: "Bearer" });
    }
    if (path.endsWith("/auth/refresh")) {
      return ctl.sessionOpen ? json(200, { access_token: "tok" }) : json(401, { title: "refresh_failed" });
    }
    if (path.endsWith("/auth/logout")) { ctl.sessionOpen = false; return route.fulfill({ status: 204, body: "" }); }

    if (path.endsWith("/auth/me")) {
      if (!ctl.sessionOpen) return json(401, { title: "expired" });
      return json(200, meBody({ mfa: ctl.requireOtp, enrolled: ctl.enrolled }));
    }

    if (path === "/auth/mfa/enrol" && method === "POST") {
      ctl.enrolCalls++;
      if (ctl.enrolFails === 403) {
        return json(403, { detail: "MFA enrolment is not enabled on this deployment (MDX_MFA_ENROLMENT_ENABLED)" });
      }
      if (ctl.enrolFails === 503) return json(503, { detail: "MFA secret store unavailable: no master key" });
      if (ctl.enrolled || ctl.enrolFails === 409) {
        return json(409, { detail: "already enrolled; ask an administrator to reset MFA first" });
      }
      return json(200, { provisioning_uri: PROVISIONING_URI, secret: SECRET, issuer: ISSUER, account: ACCOUNT });
    }
    if (path === "/auth/mfa/verify" && method === "POST") {
      ctl.verifyCalls++;
      if (ctl.verifyFails === 409) {
        return json(409, { detail: "no pending enrolment; call POST /auth/mfa/enrol first" });
      }
      const body = req.postDataJSON();
      if (body.code !== totpNow()) return json(400, { detail: "invalid TOTP code" });
      ctl.enrolled = true;
      return json(200, { enrolled: true, enrolled_at: "2026-08-08T12:00:00Z" });
    }
    if (/^\/auth\/mfa\/[0-9a-f-]+$/.test(path) && method === "DELETE") {
      ctl.enrolled = false;
      ctl.resetSub = path.split("/").pop();
      return route.fulfill({ status: 204, body: "" });
    }

    // Everything else. With the grace flag on, a gated endpoint answers the
    // 403 that means "you may do this, once you have a second factor".
    if (ctl.graceOn) {
      return json(403, { code: "mfa_enrolment_required", detail: "MFA enrolment required for this endpoint" });
    }
    if (path.endsWith("/readyz") || path.endsWith("/healthz")) return json(200, { status: "ok" });
    return json(200, { items: [] });
  });

  return done.then(() => ctl);
}

// `challenge: true` stops at the second step instead of waiting for the
// workspace. Waiting for something is not optional here: /#/mfa is a gated
// route, and a `goto` that races the sign-in lands on the login screen.
async function login(page, { challenge = false } = {}) {
  await page.goto("/#/login");
  await page.locator('input[type="email"]').fill(ACCOUNT);
  await page.locator('input[type="password"]').fill("dev-password");
  await page.locator('button[type="submit"]').click();
  if (challenge) {
    await expect(page.getByTestId("login-otp-step")).toBeVisible();
  } else {
    await expect(page.locator(".sb-brand")).toBeVisible({ timeout: 15_000 });
  }
}

async function typeOtp(page, code) {
  const boxes = page.getByTestId("otp-input").locator("input");
  for (let i = 0; i < code.length; i++) await boxes.nth(i).fill(code[i]);
}

// ══════════════════════════════════════════════════════════════════════
// 1. Enrolment
// ══════════════════════════════════════════════════════════════════════

test("the 403 grace signal routes to enrolment, and says why", async ({ page }) => {
  const ctl = await installAuth(page);
  await login(page);

  // From here every gated endpoint answers 403 mfa_enrolment_required.
  ctl.graceOn = true;
  await page.evaluate(() => window.__mdxClient.apiAt("http://localhost:8006", "/v1/reports").catch(() => {}));

  // Not a forbidden page — a forbidden page tells a clinician to contact an
  // administrator about something they can fix themselves in forty seconds.
  await expect(page).toHaveURL(/#\/mfa\?required=1/, { timeout: 10_000 });
  await expect(page.getByTestId("mfa-required-note")).toBeVisible();
  await expect(page.getByTestId("mfa-required-note"))
    .toContainText(/потрібна двофакторна автентифікація|requires two-factor authentication/i);
});

test("enrolment: QR, manual key, a real TOTP code, done", async ({ page }) => {
  const ctl = await installAuth(page);
  await login(page);

  await page.goto("/#/mfa");
  await page.getByTestId("mfa-begin").click();
  await expect(page.getByTestId("mfa-enrol-step")).toBeVisible();
  expect(ctl.enrolCalls).toBe(1);

  // The QR is drawn client-side from the provisioning URI — dark modules on
  // the canvas mean a phone has something to scan. (An empty canvas would look
  // fine in a screenshot and be useless to the clinician holding a phone.)
  await expect.poll(async () => page.evaluate(() => {
    const c = document.querySelector("canvas.mfa-qr");
    if (!c) return 0;
    const px = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let dark = 0;
    for (let i = 0; i < px.length; i += 4) if (px[i] < 128) dark++;
    return dark;
  }), { timeout: 10_000 }).toBeGreaterThan(100);

  // The manual key is masked until asked for — this screen is often open on a
  // workstation in a shared room.
  const secretEl = page.getByTestId("mfa-secret");
  await expect(secretEl).toContainText("••••");
  await expect(secretEl).not.toContainText(SECRET.slice(0, 8));
  await page.getByRole("button", { name: /Показати|Show/ }).click();
  await expect(secretEl).toContainText(SECRET.slice(0, 4));

  // The code an authenticator app would be showing right now.
  await typeOtp(page, totpNow());

  await expect(page.getByTestId("mfa-done")).toBeVisible({ timeout: 10_000 });
  expect(ctl.verifyCalls).toBe(1);
  expect(ctl.enrolled).toBe(true);
});

test("six digits submit on their own — no reach for a button", async ({ page }) => {
  const ctl = await installAuth(page);
  await login(page);
  await page.goto("/#/mfa");
  await page.getByTestId("mfa-begin").click();
  await expect(page.getByTestId("mfa-enrol-step")).toBeVisible();

  await typeOtp(page, totpNow());
  await expect(page.getByTestId("mfa-done")).toBeVisible({ timeout: 10_000 });
  expect(ctl.verifyCalls).toBe(1);
});

test("a wrong code says what to check, and the next code still works", async ({ page }) => {
  await installAuth(page);
  await login(page);
  await page.goto("/#/mfa");
  await page.getByTestId("mfa-begin").click();
  await expect(page.getByTestId("mfa-enrol-step")).toBeVisible();

  await typeOtp(page, "000000");
  await expect(page.getByTestId("mfa-problem")).toContainText(/Невірний код|That code was not right/);
  // The clock, not the typing, is the usual culprit — say so.
  await expect(page.getByTestId("mfa-problem")).toContainText(/синхронізовано|synchronised/);

  await typeOtp(page, totpNow());
  await expect(page.getByTestId("mfa-done")).toBeVisible({ timeout: 10_000 });
});

test("the enrolment secret never reaches storage, the URL or the console", async ({ page }) => {
  const logs = [];
  page.on("console", (m) => logs.push(m.text()));

  await installAuth(page);
  await login(page);
  await page.goto("/#/mfa");
  await page.getByTestId("mfa-begin").click();
  await expect(page.getByTestId("mfa-enrol-step")).toBeVisible();
  await typeOtp(page, totpNow());
  await expect(page.getByTestId("mfa-done")).toBeVisible({ timeout: 10_000 });

  const leak = await page.evaluate((secret) => {
    const hit = [];
    const scan = (store, label) => {
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k.includes(secret) || String(store.getItem(k)).includes(secret)) hit.push(`${label}:${k}`);
      }
    };
    scan(localStorage, "localStorage");
    scan(sessionStorage, "sessionStorage");
    if (document.cookie.includes(secret)) hit.push("cookie");
    if (location.href.includes(secret)) hit.push("url");
    return hit;
  }, SECRET);

  expect(leak).toEqual([]);
  expect(logs.filter((l) => l.includes(SECRET))).toEqual([]);

  // …and it is gone from the screen once it has served its purpose: the done
  // state does not still have the key sitting on it.
  await expect(page.getByTestId("mfa-secret")).toHaveCount(0);
});

test("an already-enrolled account is sent to the admin reset, not round again", async ({ page }) => {
  const ctl = await installAuth(page, { enrolled: true });
  await login(page);
  await page.goto("/#/mfa");

  // The account already has a factor: this screen says so instead of offering
  // an enrolment that would 409.
  await expect(page.getByTestId("mfa-start")).toContainText(/увімкнена|is on/i);
  await expect(page.getByTestId("mfa-begin")).toHaveCount(0);
  expect(ctl.enrolCalls).toBe(0);

  // And the recovery answer is on screen without having to ask for it.
  await expect(page.getByText(/Скинути MFA|Reset MFA/)).toBeVisible();
});

test("a deployment with the endpoints switched off says so plainly", async ({ page }) => {
  await installAuth(page, { enrolFails: 403 });
  await login(page);
  await page.goto("/#/mfa");
  await page.getByTestId("mfa-begin").click();

  // Not "forbidden", not a raw problem body: nothing the user does will help,
  // and the copy has to say that rather than imply they got it wrong.
  await expect(page.getByTestId("mfa-problem"))
    .toContainText(/ще не увімкнена|not switched on yet/);
});

test("a dead key store is temporary, and reads as temporary", async ({ page }) => {
  await installAuth(page, { enrolFails: 503 });
  await login(page);
  await page.goto("/#/mfa");
  await page.getByTestId("mfa-begin").click();
  await expect(page.getByTestId("mfa-problem")).toContainText(/тимчасово недоступний|temporarily unavailable/);
});

test("a stale pending enrolment restarts instead of dead-ending", async ({ page }) => {
  const ctl = await installAuth(page, { verifyFails: 409 });
  await login(page);
  await page.goto("/#/mfa");
  await page.getByTestId("mfa-begin").click();
  await expect(page.getByTestId("mfa-enrol-step")).toBeVisible();

  await typeOtp(page, totpNow());
  await expect(page.getByTestId("mfa-problem")).toContainText(/почати спочатку|has to be restarted/);
  // Back at the start, with the button that fixes it.
  await expect(page.getByTestId("mfa-begin")).toBeVisible();

  ctl.verifyFails = null;
  await page.getByTestId("mfa-begin").click();
  await expect(page.getByTestId("mfa-enrol-step")).toBeVisible();
  await typeOtp(page, totpNow());
  await expect(page.getByTestId("mfa-done")).toBeVisible({ timeout: 10_000 });
});

// ══════════════════════════════════════════════════════════════════════
// 2. The login second step
// ══════════════════════════════════════════════════════════════════════

test("otp_required grows a code field; the right code signs in", async ({ page }) => {
  const ctl = await installAuth(page, { requireOtp: true, enrolled: true });

  await login(page, { challenge: true });
  // The first attempt went without a code — that is the contract, not a bug:
  // there is no endpoint that asks whether MFA is required.
  expect(ctl.loginBodies).toHaveLength(1);
  expect(ctl.loginBodies[0].otp).toBeNull();

  await typeOtp(page, totpNow());
  await expect(page.locator(".sb-brand")).toBeVisible({ timeout: 15_000 });

  // The password was NOT retyped — it is carried across the two calls.
  expect(ctl.loginBodies).toHaveLength(2);
  expect(ctl.loginBodies[1].otp).toBe(totpNow());
  expect(ctl.loginBodies[1].email).toBe(ACCOUNT);
});

test("a wrong code blames the code, not the password", async ({ page }) => {
  await installAuth(page, { requireOtp: true, enrolled: true });

  await login(page, { challenge: true });
  await typeOtp(page, "000000");

  const step = page.getByTestId("login-otp-step");
  await expect(step).toContainText(/Невірний код|That code was not right/);
  // Emphatically not "check your username and password" — theirs was right.
  await expect(page.locator(".mk-auth-form")).not.toContainText(/Перевірте логін|Check your username/);

  await typeOtp(page, totpNow());
  await expect(page.locator(".sb-brand")).toBeVisible({ timeout: 15_000 });
});

test("otp_unavailable does not ask for a code it can never check", async ({ page }) => {
  await installAuth(page, { requireOtp: true, enrolled: true, otpUnavailable: true });

  await login(page, { challenge: true });
  const step = page.getByTestId("login-otp-step");
  await expect(step).toContainText(/недоступна|unavailable/);
  await expect(step).toContainText(/адміністратора|administrator/);
  // The field is disabled: typing into it could only ever fail.
  await expect(page.getByTestId("otp-input").locator("input").first()).toBeDisabled();
});

test("a genuinely wrong password is still a wrong password", async ({ page }) => {
  await installAuth(page, { requireOtp: false });
  await page.route((u) => u.hostname === "localhost" && u.pathname.endsWith("/auth/login"), (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ detail: "invalid credentials" }) }));

  await page.goto("/#/login");
  await page.locator('input[type="email"]').fill(ACCOUNT);
  await page.locator('input[type="password"]').fill("wrong");
  await page.locator('button[type="submit"]').click();

  await expect(page.locator(".mk-auth-form")).toContainText(/Невірний логін|Invalid email or password/);
  // No code field: a 401 without an MFA signal is not a challenge.
  await expect(page.getByTestId("login-otp-step")).toHaveCount(0);
});

// ══════════════════════════════════════════════════════════════════════
// 3. The lost-phone path
// ══════════════════════════════════════════════════════════════════════

test("the enrolment screen always answers the lost-phone question", async ({ page }) => {
  await installAuth(page);
  await login(page);
  await page.goto("/#/mfa");

  // Before enrolling…
  await expect(page.getByText(/Втратили доступ до телефона|Lost access to your phone/)).toBeVisible();
  // …and the answer is the admin reset, stated with the reason there are no
  // printed recovery codes.
  await expect(page.getByText(/Резервних кодів немає|There are no recovery codes/)).toBeVisible();

  // …and still there after enrolling, which is when it is actually needed.
  await page.getByTestId("mfa-begin").click();
  await typeOtp(page, totpNow());
  await expect(page.getByTestId("mfa-done")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Втратили доступ до телефона|Lost access to your phone/)).toBeVisible();
});
