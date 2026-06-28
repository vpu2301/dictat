// playwright.config.js — F-02 §4 / §11 auth E2E.
//
// The suite is hermetic: every backend call is route-mocked inside the spec
// (e2e/auth.spec.js), so it runs in CI without auth-service / Keycloak. It
// drives the REAL SPA built by `npm run dev`, exercising the actual
// src/api/client.js refresh machinery and src/auth/* gating.
import { defineConfig, devices } from "@playwright/test";

const PORT = 5173;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --port " + PORT,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
