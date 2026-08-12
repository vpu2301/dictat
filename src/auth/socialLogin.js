// socialLogin.js — "Continue with Google / Apple", brokered through the backend.
//
// ── Why this cannot be done in the browser ────────────────────────────────
// The obvious implementation is an OIDC authorization-code + PKCE flow from
// the SPA straight to Keycloak, which is what most React apps do. It is the
// wrong answer here, and would be a security regression:
//
// This app's session is NOT held in JavaScript. `POST /auth/login` returns an
// access token and auth-service sets `mdx_rt`, an HttpOnly refresh cookie
// scoped to /auth (see api/endpoints.js). A browser-side PKCE exchange would
// hand the SPA its own pair of tokens with no such cookie — a second, parallel
// session model with a refresh token readable by any script on the page, in an
// application that holds patient records.
//
// So the redirect goes to auth-service, not to Keycloak. auth-service brokers
// to the identity provider (Keycloak `kc_idp_hint`), and on the way back sets
// exactly the same cookie the password path sets. The SPA never sees a code, a
// verifier or a token — it lands on #/auth/callback, calls `me()`, and is
// either signed in or not.
//
// ── The contract this expects ─────────────────────────────────────────────
//   GET  {AUTH}/auth/social/{provider}/start?redirect_uri={absolute}
//        302 → the provider, via Keycloak. `state` is minted and verified by
//        auth-service; the SPA holds no part of it, because a value this side
//        can read is a value an injected script can read.
//   GET  {AUTH}/auth/social/callback?...   (the provider returns here)
//        Sets mdx_rt, then 302 → {redirect_uri}?social=ok
//        On failure                  302 → {redirect_uri}?social=error&reason=…
//
// `redirect_uri` must be allow-listed by auth-service against its configured
// origins. It is sent because the SPA is deployed at several (localhost, the
// staging host, the clinic's own domain) and the service cannot guess which.
//
// ── Invite-only ───────────────────────────────────────────────────────────
// There is no self-serve account creation on this platform: users are created
// by an admin invite, and /signup collects a request (services.js,
// ACCESS_REQUEST_EMAIL). A Google account with no matching user must therefore
// come back `reason=no_account`, and the UI sends that person to request
// access rather than silently creating one. "Sign up with Google" cannot mean
// "and an account appears" here — it means "prove who you are, then we look
// you up".

import { SERVICES } from "../api/services.js";

/* The providers, in the order they render. `hint` is the Keycloak identity
   provider alias auth-service is expected to pass as `kc_idp_hint`. */
export const SOCIAL_PROVIDERS = [
  { key: "google", hint: "google", label: "Google" },
  { key: "apple", hint: "apple", label: "Apple" },
];

export const isSocialProvider = (key) => SOCIAL_PROVIDERS.some((p) => p.key === key);

/* Where the provider sends the browser back to. Hash-routed, so the SPA's own
   route lives after the '#' and the query auth-service appends has to go
   BEFORE it — `?social=ok#/auth/callback`, not `#/auth/callback?social=ok`.
   A query inside the hash is part of the route string and would 404. */
export function socialRedirectUri(loc = window.location) {
  return `${loc.origin}${loc.pathname}`;
}

export function socialStartUrl(provider, loc = window.location) {
  if (!isSocialProvider(provider)) throw new Error(`unknown provider: ${provider}`);
  const base = String(SERVICES.auth || "").replace(/\/+$/, "");
  const back = encodeURIComponent(socialRedirectUri(loc));
  return `${base}/auth/social/${provider}/start?redirect_uri=${back}`;
}

/* A full-page navigation, not fetch(): the whole point is that the browser —
   not this script — carries the session cookie and follows the redirects. */
export function startSocialLogin(provider, loc = window.location) {
  loc.assign(socialStartUrl(provider, loc));
}

/* ── Coming back ───────────────────────────────────────────────────────────
   auth-service appends ?social=ok|error to the redirect_uri. Parsed from
   `search`, not from the hash, for the reason above. */
export function readSocialCallback(search = window.location.search) {
  const q = new URLSearchParams(search);
  const status = q.get("social");
  if (!status) return null;
  return { ok: status === "ok", reason: q.get("reason") || "" };
}

/* Strip the marker so a reload — or the browser's back button — does not
   replay a stale result. History is REPLACED, not pushed: the callback is not
   a place the user should be able to navigate back into. */
export function clearSocialCallback(win = window) {
  try {
    const url = new URL(win.location.href);
    url.searchParams.delete("social");
    url.searchParams.delete("reason");
    win.history.replaceState({}, "", url.toString());
  } catch { /* no History API — the marker is harmless, just untidy */ }
}

/* The reasons auth-service may send back, mapped to what the user is told and
   what they can do next. Anything unrecognised falls back to `failed`: a
   reason string this build has never heard of must not render as a blank
   error, and must never be echoed to the page — it arrives in a URL. */
export const SOCIAL_ERRORS = {
  no_account: {
    uk: "Ми не знайшли акаунта для цієї адреси. Klarnote — платформа за запрошенням: попросіть доступ, і адміністратор вашого закладу вас додасть.",
    en: "We couldn't find an account for that address. Klarnote is invite-only — request access and your organisation's administrator will add you.",
    action: "request",
  },
  email_not_verified: {
    uk: "Постачальник не підтвердив цю електронну адресу. Підтвердьте її та спробуйте ще раз.",
    en: "The provider hasn't verified that email address. Verify it and try again.",
    action: "retry",
  },
  cancelled: {
    uk: "Вхід скасовано.",
    en: "Sign-in was cancelled.",
    action: "retry",
  },
  failed: {
    uk: "Не вдалося завершити вхід через постачальника. Спробуйте ще раз або увійдіть з паролем.",
    en: "We couldn't complete sign-in with that provider. Try again, or sign in with your password.",
    action: "retry",
  },
};

export function socialErrorFor(reason, lang = "en") {
  const e = SOCIAL_ERRORS[reason] || SOCIAL_ERRORS.failed;
  return { message: e[lang] ?? e.en, action: e.action };
}
