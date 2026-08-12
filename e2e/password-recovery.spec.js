// password-recovery.spec.js — forgot / reset / lockdown, and the
// change-password control in settings.
//
// Against auth-service's contract as built (routers/password.py):
//
//   POST /auth/password/forgot   → 202 {status:"accepted"} ALWAYS
//   POST /auth/password/reset    → 204 | 400 invalid_reset_token
//                                      | 422 weak_password {reasons,min_length}
//   POST /auth/password/change   → 204 | 401 | 422
//   POST /auth/security/lockdown → 200 {reset_token, expires_in, sessions_revoked}
//   GET  /auth/password/policy   → {min_length, max_length}
//
// Two assertions here are about security properties rather than UI, and
// they are the reason the file exists:
//
//   1. The confirmation screen is byte-identical for a known and an
//      unknown address. The backend refuses to be an enumeration oracle
//      and the UI must not reintroduce one.
//   2. The reset token is scrubbed from the URL, and never reaches
//      localStorage, sessionStorage or a cookie. It is a credential; it
//      belongs in memory for the life of the form and nowhere else.

import { test, expect } from "@playwright/test";

const AUTH = "http://localhost:8000";
const RESET_TOKEN = "reset-token-abcdefghijklmnop";
const LOCKDOWN_TOKEN = "lockdown-token-abcdefghijk";
const GOOD_PASSWORD = "correct horse battery staple";

/** Route-mock the password endpoints. `state` records what was called. */
async function installPasswordMocks(page, { weak = false, invalidToken = false } = {}) {
  const state = { forgot: [], reset: [], lockdown: 0, change: [] };

  await page.route(`${AUTH}/auth/password/policy`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ min_length: 12, max_length: 128 }) }),
  );

  await page.route(`${AUTH}/auth/password/forgot`, async (route) => {
    state.forgot.push(JSON.parse(route.request().postData() || "{}"));
    // Uniform 202 — the endpoint never says whether the account exists.
    await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ status: "accepted" }) });
  });

  await page.route(`${AUTH}/auth/password/reset`, async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    state.reset.push(body);
    if (invalidToken) {
      return route.fulfill({
        status: 400,
        contentType: "application/problem+json",
        body: JSON.stringify({ title: "invalid", code: "invalid_reset_token" }),
      });
    }
    if (weak) {
      return route.fulfill({
        status: 422,
        contentType: "application/problem+json",
        body: JSON.stringify({ title: "weak", code: "weak_password", reasons: ["common"], min_length: 12 }),
      });
    }
    return route.fulfill({ status: 204, body: "" });
  });

  await page.route(`${AUTH}/auth/security/lockdown`, async (route) => {
    state.lockdown += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ reset_token: RESET_TOKEN, expires_in: 1800, sessions_revoked: true }),
    });
  });

  return state;
}

test.describe("forgot password", () => {
  test("a real and an unknown address produce the identical screen", async ({ page }) => {
    const state = await installPasswordMocks(page);

    await page.goto("/#/forgot-password");
    await page.fill('input[type="email"]', "olena@clinic.example");
    await page.getByTestId("forgot-submit").click();
    await expect(page.getByTestId("forgot-sent")).toBeVisible();
    const known = await page.getByTestId("forgot-sent").innerText();

    // Same hash → page.goto is a no-op and the component would still be
    // on the sent screen. Reload to get a fresh mount.
    await page.reload();
    await page.fill('input[type="email"]', "nobody@nowhere.example");
    await page.getByTestId("forgot-submit").click();
    await expect(page.getByTestId("forgot-sent")).toBeVisible();
    const unknown = await page.getByTestId("forgot-sent").innerText();

    // The body text differs only by the echoed address, which the user
    // typed. The confirmation itself must be word-for-word the same.
    expect(unknown).toBe(known);
    expect(state.forgot).toHaveLength(2);
  });

  test("the login page links here", async ({ page }) => {
    await installPasswordMocks(page);
    await page.goto("/#/login");
    await page.getByTestId("forgot-password-link").click();
    await expect(page).toHaveURL(/#\/forgot-password/);
  });

  test("a malformed address never reaches the network", async ({ page }) => {
    const state = await installPasswordMocks(page);
    await page.goto("/#/forgot-password");
    await page.fill('input[type="email"]', "not-an-email");
    await page.getByTestId("forgot-submit").click();
    await expect(page.locator(".mk-auth-err")).toBeVisible();
    expect(state.forgot).toHaveLength(0);
  });
});

test.describe("reset password", () => {
  test("sets a new password and scrubs the token from the URL", async ({ page }) => {
    const state = await installPasswordMocks(page);
    await page.goto(`/#/reset-password?token=${RESET_TOKEN}`);

    // The credential is out of the address bar before anything is typed.
    await expect(page).toHaveURL(/#\/reset-password$/);

    await page.fill('input[type="password"]', GOOD_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page.getByTestId("reset-done")).toBeVisible();

    // The scrubbed token still reached the API — it was kept in memory.
    expect(state.reset[0].token).toBe(RESET_TOKEN);
    expect(state.reset[0].new_password).toBe(GOOD_PASSWORD);
  });

  test("the token never lands in storage or a cookie", async ({ page }) => {
    await installPasswordMocks(page);
    await page.goto(`/#/reset-password?token=${RESET_TOKEN}`);
    await page.fill('input[type="password"]', GOOD_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page.getByTestId("reset-done")).toBeVisible();

    const leaked = await page.evaluate((tok) => {
      const hay = [];
      for (let i = 0; i < localStorage.length; i += 1) hay.push(localStorage.getItem(localStorage.key(i)));
      for (let i = 0; i < sessionStorage.length; i += 1) hay.push(sessionStorage.getItem(sessionStorage.key(i)));
      hay.push(document.cookie, location.href);
      return hay.filter(Boolean).some((v) => String(v).includes(tok));
    }, RESET_TOKEN);
    expect(leaked).toBe(false);
  });

  test("a weak password is refused with a readable reason and no navigation", async ({ page }) => {
    await installPasswordMocks(page, { weak: true });
    await page.goto(`/#/reset-password?token=${RESET_TOKEN}`);
    // Long enough to pass the client mirror, refused by the server.
    await page.fill('input[type="password"]', "Zx9 quiet harbour lantern");
    await page.click('button[type="submit"]');
    await expect(page.locator(".pw-reason.bad")).toBeVisible();
    await expect(page.getByTestId("reset-done")).toHaveCount(0);
  });

  test("an expired link offers a new one", async ({ page }) => {
    await installPasswordMocks(page, { invalidToken: true });
    await page.goto(`/#/reset-password?token=${RESET_TOKEN}`);
    await page.fill('input[type="password"]', GOOD_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page.getByTestId("request-new-link")).toBeVisible();
  });

  test("a link with no token explains itself instead of erroring", async ({ page }) => {
    await installPasswordMocks(page);
    await page.goto("/#/reset-password");
    await expect(page.getByTestId("request-new-link")).toBeVisible();
  });

  test("the client blocks an obviously weak password before submitting", async ({ page }) => {
    const state = await installPasswordMocks(page);
    await page.goto(`/#/reset-password?token=${RESET_TOKEN}`);
    await page.fill('input[type="password"]', "password1234");
    await expect(page.locator(".pw-reason.bad")).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
    expect(state.reset).toHaveLength(0);
  });
});

test.describe("account lockdown — 'this wasn't me'", () => {
  test("does NOT fire on page load — a mail scanner must not sign the user out", async ({ page }) => {
    const state = await installPasswordMocks(page);
    await page.goto(`/#/account-recovery?token=${LOCKDOWN_TOKEN}`);
    await expect(page.getByTestId("lockdown-confirm")).toBeVisible();
    // The whole point: opening the link is not consenting to it.
    expect(state.lockdown).toBe(0);
  });

  test("confirming revokes sessions and goes straight to a new password", async ({ page }) => {
    const state = await installPasswordMocks(page);
    await page.goto(`/#/account-recovery?token=${LOCKDOWN_TOKEN}`);
    await page.getByTestId("lockdown-confirm-btn").click();

    // Hands off to the reset form with the returned token, no second email.
    await expect(page.locator('input[type="password"]')).toBeVisible();
    expect(state.lockdown).toBe(1);

    await page.fill('input[type="password"]', GOOD_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page.getByTestId("reset-done")).toBeVisible();
    expect(state.reset[0].token).toBe(RESET_TOKEN);
  });

  test("a link with no token explains itself", async ({ page }) => {
    await installPasswordMocks(page);
    await page.goto("/#/account-recovery");
    await expect(page.getByTestId("goto-forgot")).toBeVisible();
  });
});
