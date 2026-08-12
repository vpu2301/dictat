// playwright.config.js — F-02 §4 / §11 auth E2E.
//
// The suite is hermetic: every backend call is route-mocked inside the spec
// (e2e/auth.spec.js), so it runs in CI without auth-service / Keycloak. It
// drives the REAL SPA built by `npm run dev`, exercising the actual
// src/api/client.js refresh machinery and src/auth/* gating.
import { defineConfig, devices } from "@playwright/test";

const PORT = 5173;
const BASE_URL = `http://localhost:${PORT}`;
// The production build, served with the production headers. e2e/csp.spec.js is
// the only spec that targets it — see the note on the second webServer below.
const PREVIEW_PORT = 4173;
export const PREVIEW_URL = `http://localhost:${PREVIEW_PORT}`;

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
  webServer: [
    {
      command: "npm run dev -- --port " + PORT,
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    // Sprint 16 — the PRODUCTION artifact, served by `vite preview` with the
    // exact headers a clinic gets (vite.config.js `configurePreviewServer`).
    //
    // Why a second server rather than testing the CSP on the dev one: the dev
    // server has to hand Vite a nonce, because Vite delivers stylesheets by
    // creating <style> elements and injects the react-refresh preamble inline.
    // A policy with a nonce in it is not the policy production enforces, so
    // proving "zero violations" there would prove the wrong thing. Every other
    // spec still runs under the dev policy — identical but for that nonce and
    // the HMR socket — so a connect-src, media-src or frame-src regression
    // fails the whole suite, not just this file.
    {
      command: "npm run build && npx vite preview --port " + PREVIEW_PORT,
      url: PREVIEW_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
