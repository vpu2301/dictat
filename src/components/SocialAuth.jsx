// SocialAuth.jsx — the "Continue with Google / Apple" pair.
//
// One component for both pages. /login and /signup previously would have owned
// a copy each; signup already had a set of these buttons whose onClick advanced
// its own wizard, which looked like federated sign-in and was not. Two copies
// of an auth control is how one of them ends up wired to nothing.
//
// The flow itself lives in auth/socialLogin.js — read the header there for why
// the redirect goes to auth-service rather than to Keycloak.
//
// ── The label is the same on both pages, deliberately ─────────────────────
// "Continue with", not "Sign up with". This platform is invite-only: there is
// no self-serve account creation (services.js, ACCESS_REQUEST_EMAIL), so a
// Google button cannot conjure an account. On /signup it proves who you are
// and looks you up; if there is no user, the callback comes back
// `no_account` and the UI offers to request access. A button that says "Sign
// up with Google" and then cannot sign anyone up is a worse lie than no
// button at all.

import React, { useState } from "react";
import { SOCIAL_PROVIDERS, startSocialLogin } from "../auth/socialLogin.js";

/* Provider marks. Inline rather than icon-map entries because both are
   trademarked lock-ups with mandated colour: Google's four-colour G may not be
   recoloured, and Apple's mark must be a single flat fill that takes the
   button's foreground. Neither can inherit from the app's icon system. */
export function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.8-2 5.1-4.4 6.7v5.6h7.1c4.2-3.8 6.6-9.5 6.6-16.3z" />
      <path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.4l-7.1-5.6c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.7-3.9-12.4-9.1H4.3v5.7C7.9 41.1 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.6 27.9c-.4-1.3-.7-2.6-.7-4s.2-2.7.7-4v-5.7H4.3C2.8 17.1 2 20.4 2 24s.8 6.9 2.3 9.7l7.3-5.8z" />
      <path fill="#EA4335" d="M24 10.9c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.5 30 2 24 2 15.4 2 7.9 6.9 4.3 14.3l7.3 5.7C13.3 14.8 18.2 10.9 24 10.9z" />
    </svg>
  );
}

export function AppleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M16.365 1.43c0 1.14-.42 2.2-1.12 3.02-.85.99-2.24 1.76-3.4 1.66a3.6 3.6 0 0 1-.03-.43c0-1.09.5-2.24 1.2-3.02.79-.9 2.14-1.57 3.28-1.62.02.13.07.26.07.39zM20.9 17.1c-.55 1.27-.82 1.84-1.53 2.96-.99 1.56-2.39 3.5-4.12 3.51-1.54.02-1.94-1-4.03-.99-2.09.01-2.53 1.01-4.07.99-1.73-.01-3.06-1.76-4.05-3.32C.32 15.9-.02 10.78 1.79 8.06c1.28-1.93 3.3-3.06 5.2-3.06 1.94 0 3.16 1.06 4.76 1.06 1.56 0 2.5-1.06 4.75-1.06 1.7 0 3.5.93 4.78 2.53-4.2 2.3-3.52 8.29.62 9.57z" />
    </svg>
  );
}

const MARK = { google: GoogleMark, apple: AppleMark };

/* Per-provider label, in every language the site ships. `label` on the
   provider record carries the brand name, which is never translated. */
const CONTINUE = {
  uk: (p) => `Продовжити з ${p}`,
  en: (p) => `Continue with ${p}`,
  pl: (p) => `Kontynuuj przez ${p}`,
  de: (p) => `Mit ${p} fortfahren`,
  ro: (p) => `Continuați cu ${p}`,
  cs: (p) => `Pokračovat přes ${p}`,
  sr: (p) => `Nastavite preko ${p}`,
  hu: (p) => `Folytatás: ${p}`,
  ar: (p) => `المتابعة باستخدام ${p}`,
  es: (p) => `Continuar con ${p}`,
  pt: (p) => `Continuar com ${p}`,
};

const OR = {
  uk: "або", en: "or", pl: "lub", de: "oder", ro: "sau", cs: "nebo",
  sr: "ili", hu: "vagy", ar: "أو", es: "o", pt: "ou",
};

/**
 * @param lang     current UI language
 * @param divider  render the "or" rule above the buttons
 * @param onStart  told which provider was chosen, before the page navigates
 *                 away — the caller uses it to show a pending state, since the
 *                 redirect can take a moment on a slow connection
 */
export function SocialAuthButtons({ lang = "en", divider = true, onStart }) {
  /* Which button was pressed. The page is about to be replaced by the
     provider's, so this is only ever visible for the moment in between — but
     without it a slow redirect looks like a dead button and gets clicked
     twice, which restarts the flow and loses the first `state`. */
  const [pending, setPending] = useState("");
  const label = CONTINUE[lang] ?? CONTINUE.en;

  const go = (p) => () => {
    if (pending) return;
    setPending(p.key);
    if (onStart) onStart(p.key);
    startSocialLogin(p.key);
  };

  return (
    <>
      {divider && <div className="mk-auth-or"><span>{OR[lang] ?? OR.en}</span></div>}
      {SOCIAL_PROVIDERS.map((p) => {
        const Mark = MARK[p.key];
        return (
          <button
            key={p.key}
            type="button"
            className="mk-auth-btn soft"
            onClick={go(p)}
            disabled={!!pending}
            aria-busy={pending === p.key ? "true" : undefined}
          >
            <Mark /> {label(p.label)}
          </button>
        );
      })}
    </>
  );
}
