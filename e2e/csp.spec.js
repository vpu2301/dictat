// csp.spec.js — the app under the ENFORCED production policy (sprint 16).
//
// Runs against `vite preview` on :4173: the real production bundle, served
// with the exact headers vite.config.js emits into dist/_headers and
// dist/security-headers.nginx.conf. Not the dev server — the dev server hands
// Vite a nonce so its HMR style injection and react-refresh preamble survive,
// and a policy with a nonce in it is not the policy a clinic runs.
//
// The claim being proved is narrow and worth stating exactly: with
// `default-src 'self'` and no `unsafe-inline` anywhere, the product still
// works. Every capability the app depends on is exercised — the API, both
// WebSockets, blob-backed audio, a blob PDF download, the QR canvas, the
// Swagger iframe — and the violation log is asserted EMPTY. That log is the
// evidence; a spec that only checked "the page rendered" would pass against a
// policy that had silently stopped being applied at all, which is why the
// header itself is asserted too.

import { test, expect } from "@playwright/test";
import { collectCspViolations, cspViolations, parseCsp } from "./helpers/csp.js";

const PREVIEW = "http://localhost:4173";

test.use({ baseURL: PREVIEW });

// A TOTP test vector — RFC 6238's own base32 secret, so nothing here is a
// credential and the QR is reproducible.
const TEST_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
const PROVISIONING_URI =
  `otpauth://totp/Klarnote:doctor@clinic.example?secret=${TEST_SECRET}` +
  "&issuer=Klarnote&algorithm=SHA1&digits=6&period=30";

const TENANT = "00000000-0000-0000-0000-00000000000a";

function meBody() {
  return {
    claims: { sub: "user-123", tid: TENANT, roles: ["clinician"], scope: "openid", iss: "mock", mfa: false },
    db_user: { email: "doctor@clinic.example", display_name: "Dr Test", role: "clinician", status: "active" },
  };
}

// Every backend the SPA can reach, answered locally. The point is not to
// simulate the platform — it is that these requests must be ALLOWED to leave
// the page, which is a `connect-src` question the policy answers before any
// server does.
async function installBackend(page) {
  await page.route((url) => url.hostname === "localhost" && url.port !== "4173", async (route) => {
    const url = new URL(route.request().url());
    const json = (status, body) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (url.pathname.endsWith("/auth/login")) return json(200, { access_token: "tok", expires_in: 900, token_type: "Bearer" });
    if (url.pathname.endsWith("/auth/me")) return json(200, meBody());
    if (url.pathname.endsWith("/auth/refresh")) return json(401, { title: "no session" });
    if (url.pathname.endsWith("/auth/mfa/enrol")) {
      return json(200, {
        provisioning_uri: PROVISIONING_URI,
        secret: TEST_SECRET,
        issuer: "Klarnote",
        account: "doctor@clinic.example",
      });
    }
    if (url.pathname.endsWith("/readyz")) return json(200, { status: "ready" });
    return json(200, {});
  });
}

test.describe("the app under an enforced CSP", () => {
  test("the production server sends the strict policy, enforcing", async ({ request }) => {
    const res = await request.get(`${PREVIEW}/`, { headers: { Accept: "text/html" } });
    const headers = res.headers();

    // Enforcing, not reporting. A report-only header would let every other
    // assertion in this file pass while blocking nothing.
    expect(headers["content-security-policy-report-only"]).toBeUndefined();
    const csp = parseCsp(headers["content-security-policy"]);

    expect(csp["default-src"]).toEqual(["'self'"]);
    expect(csp["script-src"]).toEqual(["'self'"]);
    expect(csp["style-src"]).toEqual(["'self'"]);
    expect(csp["font-src"]).toEqual(["'self'"]);
    expect(csp["object-src"]).toEqual(["'none'"]);
    expect(csp["frame-ancestors"]).toEqual(["'none'"]);
    expect(csp["base-uri"]).toEqual(["'self'"]);
    expect(csp["form-action"]).toEqual(["'self'"]);

    const whole = headers["content-security-policy"];
    expect(whole).not.toContain("unsafe-inline");
    expect(whole).not.toContain("unsafe-eval");
    // No nonce: the dev nonce is a constant, and a constant nonce in a served
    // production policy is a permanent bypass of script-src.
    expect(whole).not.toContain("nonce-");

    // The companions the sprint asked for.
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-frame-options"]).toBe("DENY");
    // Dictation needs the microphone; nothing else is granted.
    expect(headers["permissions-policy"]).toContain("microphone=(self)");
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["permissions-policy"]).toContain("geolocation=()");
  });

  test("login, then the workspace, with zero violations", async ({ page }) => {
    await collectCspViolations(page);
    await installBackend(page);

    await page.goto("/#/login");
    await page.getByLabel(/Email|Електронна пошта/i).fill("doctor@clinic.example");
    await page.locator('input[type="password"]').first().fill("hunter2");
    await page.getByRole("button", { name: /Sign in|Увійти/i }).click();

    await expect(page).toHaveURL(/#\/(?!login)/, { timeout: 15_000 });
    await page.waitForTimeout(1500);

    expect(await cspViolations(page)).toEqual([]);
  });

  test("the self-hosted fonts load — no third-party origin is even attempted", async ({ page }) => {
    await collectCspViolations(page);
    await installBackend(page);

    const external = [];
    page.on("request", (r) => {
      const host = new URL(r.url()).hostname;
      if (host !== "localhost" && host !== "127.0.0.1") external.push(r.url());
    });

    await page.goto("/#/welcome");
    await page.evaluate(() => document.fonts.ready);

    // The families are present, from this origin.
    const loaded = await page.evaluate(() =>
      [...document.fonts].map((f) => f.family).filter((v, i, a) => a.indexOf(v) === i));
    expect(loaded).toContain("Geist");

    expect(external).toEqual([]);
    expect(await cspViolations(page)).toEqual([]);
  });

  test("the TipTap editor's stylesheet is a file, not an injected <style>", async ({ page }) => {
    await collectCspViolations(page);
    await installBackend(page);
    await page.goto("/#/welcome");

    // @tiptap/core's default is to build a <style> element and set innerHTML.
    // `injectCSS: false` plus src/prosemirror.css replaces that; if a version
    // bump ever turns it back on, this catches it before a clinician does.
    expect(await page.locator("style[data-tiptap-style]").count()).toBe(0);
    // …and the rules it would have injected are present, from the bundle.
    const hasRule = await page.evaluate(() =>
      [...document.styleSheets].some((sheet) => {
        try {
          return [...sheet.cssRules].some((r) => r.selectorText === ".ProseMirror-gapcursor");
        } catch { return false; }
      }));
    expect(hasRule).toBe(true);
    expect(await cspViolations(page)).toEqual([]);
  });

  test("both WebSockets are permitted by connect-src", async ({ page }) => {
    await collectCspViolations(page);
    await page.goto("/#/welcome");

    // A refused CONNECTION is not a violation — the sockets have no server
    // here and are expected to fail. What is being asserted is that the
    // browser was willing to try, i.e. that ws://…:8002 (dictation, sprint 04)
    // and ws://…:8004 (notifications, sprint 12) are in connect-src. A policy
    // that omitted them would throw on construction instead.
    const result = await page.evaluate(() => {
      const attempt = (url) => {
        try { new WebSocket(url); return "allowed"; }
        catch (e) { return `blocked: ${e.name}`; }
      };
      return {
        dictation: attempt("ws://localhost:8002/v1/dictation/stream"),
        notifications: attempt("ws://localhost:8004/ws/notifications"),
      };
    });
    expect(result).toEqual({ dictation: "allowed", notifications: "allowed" });

    await page.waitForTimeout(500);
    expect(await cspViolations(page)).toEqual([]);
  });

  test("blob-backed audio playback and a blob PDF download both work", async ({ page }) => {
    await collectCspViolations(page);
    await page.goto("/#/welcome");

    // This is precisely how the app plays a clip (src/api/audioClips.js): the
    // tokenised clip URL still needs the bearer, so the bytes are fetched and
    // handed to <audio> as an object URL. media-src must admit blob:.
    const played = await page.evaluate(async () => {
      const url = URL.createObjectURL(new Blob([new Uint8Array([0x4f, 0x67, 0x67, 0x53])], { type: "audio/ogg" }));
      const el = document.createElement("audio");
      el.src = url;
      document.body.appendChild(el);
      await new Promise((r) => setTimeout(r, 200));
      const ok = el.src.startsWith("blob:");
      el.remove();
      URL.revokeObjectURL(url);
      return ok;
    });
    expect(played).toBe(true);

    // …and the PDF path (src/api/reports.js): blob → <a download> → click.
    const downloaded = await page.evaluate(async () => {
      const url = URL.createObjectURL(new Blob(["%PDF-1.4"], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url; a.download = "report.pdf";
      document.body.appendChild(a);
      const ok = a.href.startsWith("blob:");
      a.remove();
      URL.revokeObjectURL(url);
      return ok;
    });
    expect(downloaded).toBe(true);

    await page.waitForTimeout(300);
    expect(await cspViolations(page)).toEqual([]);
  });

  test("the MFA QR renders to a canvas under the policy", async ({ page }) => {
    await collectCspViolations(page);
    await installBackend(page);

    // Sign in first — enrolment is an authenticated call.
    await page.goto("/#/login");
    await page.getByLabel(/Email|Електронна пошта/i).fill("doctor@clinic.example");
    await page.locator('input[type="password"]').first().fill("hunter2");
    await page.getByRole("button", { name: /Sign in|Увійти/i }).click();
    await expect(page).toHaveURL(/#\/(?!login)/, { timeout: 15_000 });

    await page.goto("/#/mfa");
    await page.getByTestId("mfa-begin").click();
    await expect(page.getByTestId("mfa-enrol-step")).toBeVisible({ timeout: 15_000 });

    // The `qrcode` module is a lazy chunk — this is also the assertion that
    // dynamic import works under `script-src 'self'`. A blank canvas would
    // mean the QR silently failed and the clinician is left with manual entry.
    await expect.poll(async () => page.evaluate(() => {
      const c = document.querySelector("canvas.mfa-qr");
      if (!c) return 0;
      const px = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let dark = 0;
      for (let i = 0; i < px.length; i += 4) if (px[i] < 128) dark++;
      return dark;
    }), { timeout: 15_000 }).toBeGreaterThan(100);

    expect(await cspViolations(page)).toEqual([]);
  });

  test("the API-docs iframe is permitted by frame-src", async ({ page }) => {
    await collectCspViolations(page);
    await installBackend(page);

    // Easy directive to forget: this page embeds each service's own Swagger UI
    // at {base}/docs, and without frame-src the pane just goes blank with no
    // console error a reviewer would notice.
    await page.goto("/#/developers/api");
    await expect(page.locator("iframe").first()).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1000);

    const violations = await cspViolations(page);
    expect(violations.filter((v) => v.directive.startsWith("frame"))).toEqual([]);
    expect(violations).toEqual([]);
  });
});
