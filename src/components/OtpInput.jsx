// OtpInput.jsx — the six-digit TOTP field, used by both places that ask for
// one: the login form's second step and the enrolment screen (sprint 16).
//
// It exists as a component because the two screens must behave identically.
// A clinician types this code twice a day for the rest of their working life;
// if the boxes advance differently, or one accepts a paste and the other does
// not, that is a papercut repeated thousands of times.
//
// The behaviours that matter, and are easy to get wrong:
//
//   · PASTE. Authenticator apps put the code on the clipboard, and people use
//     it. A paste anywhere in the row fills the whole row and submits.
//   · BACKSPACE on an empty box steps back and clears the previous one, which
//     is what every OS-level code field does.
//   · ARROWS move without editing, so a mistyped third digit is a two-key fix.
//   · autocomplete="one-time-code" lets iOS/Android offer the SMS/TOTP code.
//   · The value is a plain string, owned by the parent. This component keeps
//     no state of its own beyond focus — the code is a credential, and a
//     credential should live in exactly one place.

import React, { useEffect, useRef } from "react";

const LENGTH = 6;

export function OtpInput({
  value = "",
  onChange,
  onComplete,
  disabled = false,
  autoFocus = false,
  invalid = false,
  label,
  id = "otp",
}) {
  const refs = useRef([]);
  const digits = String(value).replace(/\D/g, "").slice(0, LENGTH).padEnd(LENGTH, " ").split("");

  useEffect(() => {
    if (autoFocus && refs.current[0]) refs.current[0].focus();
  }, [autoFocus]);

  const emit = (next) => {
    const clean = next.replace(/\D/g, "").slice(0, LENGTH);
    onChange?.(clean);
    if (clean.length === LENGTH) onComplete?.(clean);
    return clean;
  };

  const setAt = (i, raw) => {
    const typed = String(raw).replace(/\D/g, "");
    if (!typed) return;
    // Typing (or an autofilled code landing in one box) may deliver several
    // digits at once — spread them from here rather than dropping all but one.
    const chars = value.replace(/\D/g, "").split("");
    for (let k = 0; k < typed.length && i + k < LENGTH; k++) chars[i + k] = typed[k];
    const next = emit(chars.join("").slice(0, LENGTH));
    const focusAt = Math.min(i + typed.length, LENGTH - 1);
    if (next.length < LENGTH) refs.current[focusAt]?.focus();
    else refs.current[LENGTH - 1]?.blur();
  };

  const onKeyDown = (i) => (e) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const chars = value.replace(/\D/g, "").split("");
      if (chars[i]) {
        chars[i] = "";
        emit(chars.join(""));
      } else if (i > 0) {
        chars[i - 1] = "";
        emit(chars.join(""));
        refs.current[i - 1]?.focus();
      }
      return;
    }
    if (e.key === "ArrowLeft" && i > 0) { e.preventDefault(); refs.current[i - 1]?.focus(); }
    if (e.key === "ArrowRight" && i < LENGTH - 1) { e.preventDefault(); refs.current[i + 1]?.focus(); }
  };

  const onPaste = (e) => {
    const text = (e.clipboardData || window.clipboardData)?.getData("text") || "";
    const cleaned = text.replace(/\D/g, "").slice(0, LENGTH);
    if (!cleaned) return;
    e.preventDefault();
    emit(cleaned);
    refs.current[Math.min(cleaned.length, LENGTH - 1)]?.focus();
  };

  return (
    <div
      className={"otp-row" + (invalid ? " otp-invalid" : "")}
      onPaste={onPaste}
      role="group"
      aria-label={label}
      data-testid="otp-input"
    >
      {digits.map((d, i) => (
        <input
          key={i}
          id={i === 0 ? id : undefined}
          ref={(el) => { refs.current[i] = el; }}
          className="otp-box"
          value={d.trim()}
          onChange={(e) => setAt(i, e.target.value)}
          onKeyDown={onKeyDown(i)}
          onFocus={(e) => e.target.select()}
          type="text"
          inputMode="numeric"
          // Six single-character inputs would otherwise each get their own
          // browser autofill dropdown; one-time-code makes the platform treat
          // the row as the single code it is.
          autoComplete={i === 0 ? "one-time-code" : "off"}
          pattern="[0-9]*"
          maxLength={1}
          disabled={disabled}
          aria-label={`${label || "code"} ${i + 1}/${LENGTH}`}
          aria-invalid={invalid || undefined}
        />
      ))}
    </div>
  );
}

export const OTP_LENGTH = LENGTH;
