// SocialCallbackPage.jsx — the moment the browser comes back from Google or Apple.
//
// auth-service has already done everything that matters by the time this
// renders: brokered the provider through Keycloak, matched the identity to a
// user, and set the `mdx_rt` refresh cookie the password path sets. This screen
// exists only to turn that cookie into a live session in THIS tab — it calls
// `me()`, hands the profile to the auth context, and gets out of the way.
//
// It is a screen rather than a silent effect for one reason: the round trip can
// take a second on a slow connection, and a blank page during an authentication
// hand-off is where users press the back button and start again mid-flow.
//
// FAILURES DO NOT RENDER HERE. auth-service sends failures back with
// `?social=error&reason=…`, and App routes those to /login, which owns the
// explanation and the "request access" link (this platform is invite-only, so
// `no_account` is the common case and it needs somewhere to go, not just an
// apology). Reaching this component with a failed marker means something
// upstream mis-routed; it falls through to the same place rather than showing
// a dead end.

import React, { useEffect, useState } from "react";
import { Icon } from "../components/UI.jsx";
import { me as apiMe } from "../api/endpoints.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { clearSocialCallback, readSocialCallback } from "../auth/socialLogin.js";
import { tr } from "../i18n.js";

export function SocialCallbackPage({ navigate, lang = "en" }) {
  const { setState } = useAuth();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    const back = readSocialCallback();
    /* Strip the marker before anything async: a reload mid-exchange must not
       run the whole hand-off a second time. */
    clearSocialCallback();

    if (!back || !back.ok) { navigate("/login"); return undefined; }

    (async () => {
      try {
        /* Exactly the shape the password path stores (LoginPage.submit).
           A second session shape is how half the app starts reading a field
           that is only ever set on one of the two routes in. */
        const meBody = await apiMe();
        if (!live) return;
        setState({ claims: meBody.claims, dbUser: meBody.db_user });
        navigate("/");
      } catch {
        /* The cookie is missing, expired, or auth-service disagrees. Nothing
           this screen can fix — send them to the form that can. */
        if (live) { setFailed(true); navigate("/login"); }
      }
    })();

    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="lp mk-auth-shell">
      <div className="mk-auth" data-testid="social-callback">
        <span className="lp-brand-name">Klarnote</span>
        <h1 className="mk-auth-title">
          {tr(lang, "Завершуємо вхід…", "Finishing sign-in…")}
        </h1>
        <p className="mk-auth-sub">
          {failed
            ? tr(lang, "Не вдалося. Повертаємо вас до входу.", "That didn't work. Taking you back to sign-in.")
            : tr(lang, "Хвилинку — перевіряємо ваш обліковий запис.", "One moment — checking your account.")}
        </p>
        <p className="mk-auth-hint" aria-live="polite">
          <Icon name="refresh" size={15} /> {tr(lang, "Зачекайте", "Please wait")}
        </p>
      </div>
    </div>
  );
}
