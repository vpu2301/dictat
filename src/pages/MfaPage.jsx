// MfaPage.jsx — TOTP enrolment scaffold. Sprint 16 ships the backend
// endpoints (/auth/mfa/{enroll,verify,recovery-codes,recovery-redeem}).
// Until then, this page renders an explanatory placeholder + the empty
// 6-digit field, so wiring is a one-line flag flip once the API lands.

import React, { useRef, useState } from "react";
import { Icon } from "../components/UI.jsx";
import { FEATURES } from "../api/services.js";

export function MfaPage({ lang = "en" }) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const refs = useRef([]);

  const setAt = (i, v) => {
    const onlyDigit = String(v).replace(/\D/g, "").slice(0, 1);
    setDigits((d) => {
      const n = [...d]; n[i] = onlyDigit; return n;
    });
    if (onlyDigit && refs.current[i + 1]) refs.current[i + 1].focus();
  };

  const onPaste = (e) => {
    const txt = (e.clipboardData || window.clipboardData).getData("text") || "";
    const cleaned = txt.replace(/\D/g, "").slice(0, 6);
    if (cleaned.length === 6) {
      e.preventDefault();
      setDigits(cleaned.split(""));
      refs.current[5] && refs.current[5].blur();
    }
  };

  if (!FEATURES.mfaEnrolment) {
    return (
      <div className="page">
        <div className="page-h">
          <div>
            <h1>{lang === "uk" ? "Двофакторна автентифікація" : "Multi-factor authentication"}</h1>
            <div className="muted" style={{ marginTop: 4 }}>
              {lang === "uk"
                ? "MFA наразі не вимагається. Підключення TOTP заплановане на спринт 16."
                : "MFA is not required yet. TOTP enrolment ships in sprint 16."}
            </div>
          </div>
        </div>
        <div className="card" style={{ padding: 16, maxWidth: 480 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Icon name="shield" size={14} />
            <strong>{lang === "uk" ? "Готовий каркас" : "Scaffold only"}</strong>
          </div>
          <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
            {lang === "uk"
              ? "Бекенд ще не випустив ендпоінти /auth/mfa/{enroll,verify,...}. Поле нижче готове до підключення; коли бекенд увімкне MDX_REQUIRE_MFA, перемикач функцій активує цю форму."
              : "Backend has not shipped /auth/mfa/{enroll,verify,...} yet. The field below is wired up; flipping VITE_FEAT_MFA_ENROLMENT (and the matching MDX_REQUIRE_MFA on the backend) will activate the form."}
          </p>
          <div className="mfa-row" style={{ display: "flex", gap: 8, marginTop: 12 }} onPaste={onPaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => (refs.current[i] = el)}
                value={d}
                onChange={(e) => setAt(i, e.target.value)}
                inputMode="numeric"
                maxLength={1}
                disabled
                aria-label={`digit ${i + 1}`}
                style={{
                  width: 36, height: 44, textAlign: "center",
                  fontSize: 18, fontVariantNumeric: "tabular-nums",
                  borderRadius: 6, border: "1px solid var(--line)", background: "var(--surface-2)",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Live path — left intentionally minimal. Once sprint 16 ships, replace
  // this branch with the real verify call.
  return (
    <div className="page">
      <div className="page-h"><h1>{lang === "uk" ? "Підтвердьте код" : "Verify code"}</h1></div>
      <div className="card" style={{ padding: 16, maxWidth: 480 }}>
        <div style={{ display: "flex", gap: 8 }} onPaste={onPaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => (refs.current[i] = el)}
              value={d}
              onChange={(e) => setAt(i, e.target.value)}
              inputMode="numeric"
              maxLength={1}
              autoFocus={i === 0}
              style={{
                width: 36, height: 44, textAlign: "center",
                fontSize: 18, fontVariantNumeric: "tabular-nums",
                borderRadius: 6, border: "1px solid var(--line)", background: "var(--surface)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
