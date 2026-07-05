// signing.spec.js — sprint 09 E2E: sign a finalized report with the file KEP
// key (test-CA fixture container) and via Дія; drive the real SPA against
// contract-accurate route mocks (hermetic, like auth.spec.js).
//
// Flows covered:
//   1. finalized → file-key sign (bad password first, then success) → КЕП
//      badge → verify page renders → signed-PDF downloads;
//   2. Дія: initiate → QR → poll (awaiting_user → verifying → signed) → КЕП
//      badge; plus the expired-session retry state;
//   3. account password: dev_password advertised → password flow →
//      non-qualified badge.
import { test, expect } from "@playwright/test";

const TENANT_A = "00000000-0000-0000-0000-00000000000a";
const TEMPLATE_ID = "22222222-2222-2222-2222-222222222222";
const REPORT_ID = "33333333-3333-3333-3333-333333333333";
const VERSION_ID = "44444444-4444-4444-4444-444444444444";
const SESSION_ID = "55555555-5555-5555-5555-555555555555";
const ENVELOPE_ID = "66666666-6666-6666-6666-666666666666";
const VERIFY_TOKEN = "tok_e2e_qualified_0001";
const SIGNED_AT = "2026-07-03T10:15:00+00:00";
const SIGNER = "Др. Олена Шевченко";

// Test-CA fixture container: opaque bytes standing in for a КНЕДП Key-6.dat.
const KEY_CONTAINER = Buffer.from("TEST-CA-FIXTURE-KEY-CONTAINER-\x01\x02\x03\x04", "latin1");
const KEY_PASSWORD = "test-ca-key-password";

function meBody(roles = ["clinician"]) {
  return {
    claims: { sub: "user-123", tid: TENANT_A, roles, scope: "openid", iss: "mock", mfa: false },
    db_user: { email: "user@tenant-a.example", display_name: SIGNER, role: roles[0], status: "active" },
  };
}

const TEMPLATE_SUMMARY = {
  id: TEMPLATE_ID, code: "MRI-BRAIN", name: "MRI Brain", specialty: "radiology",
  is_system: true, status: "active", language: "uk", schema_version: 1,
};

function reportEnvelope(status) {
  return {
    id: REPORT_ID, code: "RPT-2026-0042", status,
    current_version_id: VERSION_ID, current_version_number: 1,
    primary_author_id: "user-123", co_author_ids: [],
    patient_id: null, patient_name_redacted: "І. П.",
    title: "МРТ головного мозку", icd10_codes: [], encounter_date: "2026-07-01",
    created_at: "2026-07-01T09:00:00+00:00", updated_at: "2026-07-02T09:00:00+00:00",
    finalized_at: "2026-07-02T09:00:00+00:00",
    signed_at: status === "signed" ? SIGNED_AT : null, cancelled_at: null,
    content: {
      template_id: TEMPLATE_ID, template_schema_version: 1,
      sections: [{ section_key: "findings", text: "Вогнищевих змін не виявлено." }],
    },
    section_labels: [{ section_key: "findings", name: { uk: "Результати", en: "Findings" } }],
  };
}

const INLINE_ENVELOPE = {
  envelope_id: ENVELOPE_ID, signature_level: "qualified",
  verification_token: VERIFY_TOKEN, signed_at: SIGNED_AT,
  signer_full_name: SIGNER, is_qualified: true, report_status: "signed",
};

const PUBLIC_VERIFY_BODY = {
  status: "valid", signature_level: "qualified", provider: "file_key",
  resource_type: "report", signed_at: SIGNED_AT, signer_full_name: SIGNER,
  is_qualified: true, certificate_issuer_cn: "Тестовий КНЕДП (test CA)",
  certificate_serial: "3ED59A0001", signature_algorithm: "DSTU4145",
  document_hash_sha256_hex: "ab".repeat(32), valid: true,
  verification_token: VERIFY_TOKEN,
};

// ctl.providers — what /readyz advertises; ctl.signPlan — scripted responses
// for successive POST /sign calls; ctl.sessionPlan — successive poll bodies.
async function installMocks(page, ctl, calls) {
  const isApi = (url) =>
    url.hostname === "localhost" &&
    ["8000", "8001", "8002", "8003", "8005", "8006", "8007", "8008"].includes(url.port);

  await page.route(isApi, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();
    const json = (status, body) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    // ── auth ──
    if (path.endsWith("/auth/login") && method === "POST") {
      ctl.sessionOpen = true;
      return json(200, { access_token: "tok", expires_in: 300, token_type: "Bearer", user: { email: "user@tenant-a.example" } });
    }
    if (path.endsWith("/auth/refresh") && method === "POST") {
      if (!ctl.sessionOpen) return json(401, { title: "refresh_failed" });
      return json(200, { access_token: "tok" });
    }
    if (path.endsWith("/auth/logout")) { ctl.sessionOpen = false; return route.fulfill({ status: 204, body: "" }); }
    if (path.endsWith("/auth/me")) {
      if (!ctl.sessionOpen) return json(401, { title: "expired" });
      return json(200, meBody());
    }

    // ── signing-service (:8008) ──
    if (url.port === "8008") {
      if (path === "/readyz") return json(200, { status: "ok", providers: ctl.providers, trust_anchors: 3 });
      if (path === `/signing/sessions/${SESSION_ID}` && method === "GET") {
        calls.polls++;
        const body = ctl.sessionPlan[Math.min(calls.polls - 1, ctl.sessionPlan.length - 1)];
        return json(200, body);
      }
      if (path === `/signing/sessions/${SESSION_ID}` && method === "DELETE") {
        calls.cancels++;
        return json(200, { status: "cancelled" });
      }
      if (path === `/verify/${VERIFY_TOKEN}` && method === "GET") {
        calls.verifies++;
        return json(200, ctl.verifyBody || PUBLIC_VERIFY_BODY);
      }
      if (path === `/verify/${VERIFY_TOKEN}/pdf` && method === "GET") {
        return route.fulfill({
          status: 200, contentType: "application/pdf",
          headers: { "Content-Disposition": `attachment; filename="report-${VERIFY_TOKEN}.pdf"` },
          body: Buffer.from("%PDF-1.7\n% signed fixture\n%%EOF"),
        });
      }
    }
    if (path.endsWith("/readyz") || path.endsWith("/healthz")) return json(200, { status: "ok" });

    // ── report-service (:8006) ──
    if (path === "/templates" && method === "GET") return json(200, { items: [TEMPLATE_SUMMARY] });
    if (path === `/v1/reports/${REPORT_ID}/sign` && method === "POST") {
      calls.signBodies.push(req.postDataJSON());
      const step = ctl.signPlan[Math.min(calls.signBodies.length - 1, ctl.signPlan.length - 1)];
      if (step.status === 200 && step.body.report_status) ctl.reportStatus = step.body.report_status;
      return json(step.status, step.body);
    }
    if (path === `/v1/reports/${REPORT_ID}` && method === "GET") {
      return json(200, reportEnvelope(ctl.reportStatus));
    }
    if (path === `/v1/reports/${REPORT_ID}/versions` && method === "GET") {
      return json(200, {
        items: [{
          version_number: 1, is_amendment: false, created_at: "2026-07-01T09:00:00+00:00",
          signed_at: ctl.reportStatus === "signed" ? SIGNED_AT : null,
          signed_by: ctl.reportStatus === "signed" ? "user-123" : null,
        }],
      });
    }

    return json(200, { items: [] });
  });
}

async function login(page) {
  await page.goto("/#/login");
  await page.locator('input[type="email"]').fill("user@tenant-a.example");
  await page.locator('input[type="password"]').fill("login-password");
  await page.locator('button[type="submit"]').click();
  await expect(page.locator(".sb-brand")).toBeVisible();
}

async function openSignDialog(page) {
  await page.goto(`/#/dictate/reports/${REPORT_ID}`);
  await page.getByTestId("sign-report").click();
  await expect(page.getByTestId("sign-continue")).toBeVisible();
}

function newCtl(overrides = {}) {
  return {
    sessionOpen: false,
    reportStatus: "finalized",
    providers: ["diia", "file_key"],
    signPlan: [{ status: 200, body: INLINE_ENVELOPE }],
    sessionPlan: [],
    ...overrides,
  };
}
const newCalls = () => ({ signBodies: [], polls: 0, cancels: 0, verifies: 0 });

test("file key: bad password → precise error; retry → КЕП badge, verify page, PDF download", async ({ page }) => {
  const ctl = newCtl({
    signPlan: [
      { status: 400, body: { detail: { error: "key_container_rejected", detail: "key container could not be opened" } } },
      { status: 200, body: INLINE_ENVELOPE },
    ],
  });
  const calls = newCalls();
  await installMocks(page, ctl, calls);
  await login(page);
  await openSignDialog(page);

  // file_key is the default method
  await page.getByTestId("sign-continue").click();
  await expect(page.getByTestId("file-key-sign")).toBeVisible();

  const fillAndSubmit = async () => {
    await page.setInputFiles('[data-testid="key-file-input"]', {
      name: "Key-6.dat", mimeType: "application/octet-stream", buffer: KEY_CONTAINER,
    });
    await page.getByTestId("key-password-input").fill(KEY_PASSWORD);
    await page.getByTestId("file-key-submit").click();
  };

  // attempt 1 → 400 → the precise Ukrainian message
  await fillAndSubmit();
  await expect(page.getByTestId("sign-error")).toHaveText(
    "Не вдалося відкрити контейнер ключа: невірний файл або хибний пароль до ключа.");
  await expect(page.getByTestId("key-password-input")).toHaveValue("");

  // attempt 2 → 200 envelope → КЕП badge from the API's signature_level
  await fillAndSubmit();
  await expect(page.getByTestId("sign-success")).toBeVisible();
  const badge = page.getByTestId("sign-success").locator('[data-signature-level="qualified"]');
  await expect(badge).toBeVisible();
  await expect(badge).toContainText("КЕП");

  // the request carried the container base64 + password — and nothing else did
  const okBody = calls.signBodies[1];
  expect(okBody.provider).toBe("file_key");
  expect(Buffer.from(okBody.key_container_b64, "base64").equals(KEY_CONTAINER)).toBe(true);
  expect(okBody.key_password).toBe(KEY_PASSWORD);

  // signed-PDF download from the success screen
  const downloadP = page.waitForEvent("download");
  await page.getByTestId("signed-pdf-download").click();
  const download = await downloadP;
  expect(download.suggestedFilename()).toContain(".pdf");

  // close → report screen shows the signed banner with the envelope badge
  await page.locator(".modal-foot").getByRole("button", { name: "Готово" }).click();
  await expect(page.getByTestId("signed-banner")).toBeVisible();
  await expect(page.getByTestId("signed-banner").locator('[data-signature-level="qualified"]')).toContainText("КЕП");

  // public verify page renders the envelope verbatim
  await page.goto(`/#/verify/${VERIFY_TOKEN}`);
  await expect(page.getByText("Підпис дійсний")).toBeVisible();
  await expect(page.locator('[data-signature-level="qualified"]')).toContainText("КЕП");
  await expect(page.getByTestId("verify-pdf-download")).toBeVisible();
  expect(calls.verifies).toBeGreaterThan(0);
});

test("Дія: initiate → QR → poll to signed → КЕП badge", async ({ page }) => {
  const expiresAt = new Date(Date.now() + 90_000).toISOString();
  const sessionBase = {
    session_id: SESSION_ID, provider: "diia", expires_at: expiresAt,
    redirect_url: "https://diia.app/sign/abc", qr_payload: "diia://sign?sid=abc",
  };
  const ctl = newCtl({
    signPlan: [{
      status: 202,
      body: { session_id: SESSION_ID, provider: "diia", expires_at: expiresAt, redirect_url: "https://diia.app/sign/abc", qr_payload: "diia://sign?sid=abc" },
    }],
    sessionPlan: [
      { ...sessionBase, status: "awaiting_user" },
      { ...sessionBase, status: "verifying" },
      {
        ...sessionBase, status: "signed", signed_envelope_id: ENVELOPE_ID,
        verification_token: VERIFY_TOKEN, signed_at: SIGNED_AT, signer_full_name: SIGNER,
      },
    ],
    verifyBody: { ...PUBLIC_VERIFY_BODY, provider: "diia" },
  });
  const calls = newCalls();
  await installMocks(page, ctl, calls);
  await login(page);
  await openSignDialog(page);

  // radio inputs are CSS-hidden — click the option label
  await page.locator(".sign-method-opt", { hasText: "Дія.Підпис" }).click();
  await page.getByTestId("sign-continue").click();

  await expect(page.getByTestId("diia-qr")).toBeVisible();
  await expect(page.getByTestId("diia-status")).toContainText("Відскануйте QR-код");

  // live state advances with the poll: verifying → signed → success badge
  await expect(page.getByTestId("diia-status")).toContainText("Перевірка підпису", { timeout: 15_000 });
  await expect(page.getByTestId("sign-success")).toBeVisible({ timeout: 15_000 });
  const badge = page.getByTestId("sign-success").locator('[data-signature-level="qualified"]');
  await expect(badge).toContainText("КЕП");
  expect(calls.polls).toBeGreaterThanOrEqual(3);
  expect(calls.verifies).toBeGreaterThan(0); // level fetched from the API, not assumed
  expect(calls.signBodies[0].provider).toBe("diia");
});

test("Дія: expired session renders the retry state and re-initiates", async ({ page }) => {
  const expiresAt = new Date(Date.now() + 90_000).toISOString();
  const sessionBase = {
    session_id: SESSION_ID, provider: "diia", expires_at: expiresAt,
    redirect_url: "https://diia.app/sign/abc", qr_payload: "diia://sign?sid=abc",
  };
  const ctl = newCtl({
    signPlan: [{ status: 202, body: sessionBase }],
    sessionPlan: [
      { ...sessionBase, status: "awaiting_user" },
      { ...sessionBase, status: "expired" },
    ],
  });
  const calls = newCalls();
  await installMocks(page, ctl, calls);
  await login(page);
  await openSignDialog(page);

  await page.locator(".sign-method-opt", { hasText: "Дія.Підпис" }).click();
  await page.getByTestId("sign-continue").click();

  await expect(page.getByTestId("diia-expired")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("diia-expired")).toContainText("Сесія прострочена");

  // retry starts a fresh session
  await page.getByTestId("diia-retry").click();
  await expect.poll(() => calls.signBodies.length, { timeout: 10_000 }).toBe(2);
  await expect(page.getByTestId("diia-qr")).toBeVisible();
});

test("account password: advertised provider signs with the non-qualified badge", async ({ page }) => {
  const ctl = newCtl({
    providers: ["diia", "file_key", "dev_password"],
    signPlan: [{
      status: 200,
      body: { ...INLINE_ENVELOPE, signature_level: "dev", is_qualified: false },
    }],
  });
  const calls = newCalls();
  await installMocks(page, ctl, calls);
  await login(page);
  await openSignDialog(page);

  await page.locator(".sign-method-opt", { hasText: "Пароль облікового запису" }).click();
  await page.getByTestId("sign-continue").click();

  await expect(page.getByTestId("account-password-sign")).toContainText("не є кваліфікованим");
  await page.getByTestId("account-password-input").fill("my-account-password");
  await page.getByTestId("account-password-submit").click();

  await expect(page.getByTestId("sign-success")).toBeVisible();
  const badge = page.getByTestId("sign-success").locator('[data-signature-level="dev"]');
  await expect(badge).toBeVisible();
  await expect(badge).toContainText("не є юридичним підписом");
  // a non-qualified envelope can never render the КЕП mark
  await expect(page.getByTestId("sign-success").locator(".sig-badge-mark")).not.toHaveText("КЕП");
  expect(calls.signBodies[0].provider).toBe("dev_password");
  expect(calls.signBodies[0].password).toBe("my-account-password");
});
