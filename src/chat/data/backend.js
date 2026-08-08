// chat/data/backend.js — which client the seam talks to.
//
// The module ships with a mock so it can be mounted, demoed and tested with no
// infrastructure at all. Given a backend by its host it uses that instead. The
// choice is made once, at mount, from a prop — not from an environment
// variable read inside the module, which would make the embed contract a
// suggestion.
//
// Anything the real backend does not serve yet falls through to the mock (see
// evidenceApi.js), so a partially-wired backend degrades feature by feature
// instead of taking the module down.

// Which of the two live clients is built is a `dialect`, because there are two
// answer APIs and they are not the same shape: `platform` is this product's own
// evidence-answer service (typed envelope, platform Keycloak); `evidenzai` is
// the separate product the chat borrowed before that existed (markdown answer,
// its own accounts). Default is the platform's own — a host that says nothing
// gets the service this product owns.

import { mockClient } from "./mockClient.js";
import { createEvidenceApi } from "./evidenceApi.js";
import { createPlatformApi } from "./platformApi.js";

const DIALECTS = {
  platform: createPlatformApi,
  evidenzai: createEvidenceApi,
};

let active = mockClient;
let signature = null;

/**
 * @param {object|null} config `{ baseUrl, getToken, locale, dialect }`, or null
 *                             for the mock.
 */
export function configureBackend(config) {
  const dialect = DIALECTS[config?.dialect] ? config.dialect : "platform";
  const next = config?.baseUrl && typeof config.getToken === "function"
    ? `${dialect}|${config.baseUrl}|${config.locale || "en"}`
    : null;
  // Rebuilding the client on every render would throw away the in-tab session
  // store with it, so the config is compared before it is applied.
  if (next === signature) return active;
  signature = next;
  active = next
    ? DIALECTS[dialect]({ ...config, fallback: mockClient })
    : mockClient;
  return active;
}

export function getClient() {
  return active;
}

/** True when answers come from a real backend. The disclaimer depends on it. */
export function isLiveBackend() {
  return active?.live === true;
}
