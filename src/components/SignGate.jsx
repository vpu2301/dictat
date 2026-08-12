// SignGate.jsx — the one place that decides who may sign, and what everyone
// else sees instead.
//
// A qualified electronic signature is a doctor's legal act: it attests that
// THIS clinician takes responsibility for the content, which is why the law
// binds it to a personal KEP. Nurse, tenant_admin and auditor were all being
// offered it — on the report screen, in the Studio preview, on the note
// editor, and as the КЕП option in the consent sheet.
//
// Three exports, because "hide the button" is only a third of the job:
//
//   canSign()               — the predicate (re-exported from auth/roles.js)
//   <SignedBadge/>          — what a non-clinician sees on a SIGNED document:
//                             the signature status, read-only. Removing the
//                             action must not remove the fact.
//   signingForbiddenMessage — what a 403 on a signing call reads as, for the
//                             stale tab and the deep link.
//
// The FE gate is advisory. docs/auth/permissions.csv still grants nurse
// `report.write`, which is what the signing-service checks, so today the
// server would accept a nurse's signing session — the backend half of this
// hotfix closes that. Everything here is written for the world where the
// server refuses: the 403 renders as a sentence, not a stack trace.

import React from "react";

import { Icon } from "./UI.jsx";
import { canSign, isSigningForbidden } from "../auth/roles.js";
import { tr } from "../i18n.js";

export { canSign, isSigningForbidden };

/**
 * The sentence a refused signing act gets. Never a raw error: the person did
 * nothing wrong — their role does not carry the act — and an alarming red
 * failure would send them to support over a rule working as designed.
 */
export function signingForbiddenMessage(lang) {
  return tr(lang,
    "Підписання доступне лише лікарю.",
    "Only a physician can sign.");
}

/**
 * `null` when the error is not a signing refusal, so a caller can write
 *   const msg = signingErrorMessage(err, lang) ?? genericMessage(err)
 * and keep real failures loud.
 */
export function signingErrorMessage(err, lang) {
  return isSigningForbidden(err) ? signingForbiddenMessage(lang) : null;
}

/**
 * The read-only signature status. This is what replaces the action for
 * everyone who may not perform it — a nurse must still be able to SEE that a
 * report is signed, and by whom, or the removal of the button would read as
 * the removal of the signature.
 */
export function SignedBadge({ signedAt, signer, lang = "uk", className = "" }) {
  const when = signedAt
    ? new Date(signedAt).toLocaleDateString(lang === "uk" ? "uk-UA" : lang, {
        day: "numeric", month: "long", year: "numeric",
      })
    : "";
  return (
    <span className={`sign-badge ${className}`.trim()} data-testid="sign-status-badge">
      <Icon name="shield" size={12} />
      <span>{tr(lang, "Підписано", "Signed")}</span>
      {signer && <span className="sign-badge-who">{signer}</span>}
      {when && <span className="sign-badge-when">{when}</span>}
    </span>
  );
}

/**
 * Render `children` only for a signer; render the read-only badge for
 * everyone else when the document is already signed, and nothing at all when
 * it is not. One component so no call site has to remember the second half.
 */
export function SignAction({ claims, signed, signedAt, signer, lang = "uk", children }) {
  if (canSign(claims)) return children;
  if (signed) return <SignedBadge signedAt={signedAt} signer={signer} lang={lang} />;
  return null;
}
