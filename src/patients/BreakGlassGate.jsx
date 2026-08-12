// BreakGlassGate.jsx — the interstitial that stands in FRONT of clinical data.
//
// The rule it enforces is a negative, and the reason it is a component rather
// than an `if` inside a page is that a negative needs somewhere to be tested:
// when the server answers 403 `phi_access_required`, the record must not be
// rendered — not underneath the modal, not blurred, not present-and-hidden.
// `children` is a function, not an element, so the record's JSX is not even
// CONSTRUCTED while the gate is up. An element passed as a prop would have had
// its props evaluated already, which for a screen that interpolates patient
// names is the difference between "not shown" and "not built".
//
// The backend is the truth. This renders in response to ITS refusal — never to
// a client-side guess about who is related to whom. A guess would challenge the
// treating clinician on a slow relationship lookup and wave through anyone
// whose stale token happened to look right.
//
// WHICH refusal screen it is, though, IS a role question (2026-08-09). Only an
// administrator can mint a grant: a clinical role holds `patient.read_full`
// and `report.read` outright, so a 403 reaching a clinician is a stale token
// or a deep link into another tenant — never an invitation to justify
// themselves. They get the closed door and a way back, not a form.

import React, { useState } from "react";

import { Icon } from "../components/UI.jsx";
import { RequestAccessModal } from "../components/RequestAccessModal.jsx";
import { isPhiAccessRequired } from "../api/phiAccess.js";
import { useClaims } from "../auth/AuthContext.jsx";
import { canRequestPhiAccess } from "../auth/roles.js";
import { tr } from "../i18n.js";

export function BreakGlassGate({
  error,
  lang = "uk",
  resourceKind = "patient",
  resourceId,
  patientLabel,
  reportCode,
  title,
  body,
  onGranted,
  onLeave,
  children,
}) {
  const [open, setOpen] = useState(false);
  const claims = useClaims();
  if (!isPhiAccessRequired(error)) return typeof children === "function" ? children() : children;

  const isPatient = resourceKind === "patient";
  const mayRequest = canRequestPhiAccess(claims);

  // A role with no grant-minting power gets the plain closed door. Naming the
  // administrator is the whole content of this screen: it is the only next
  // step that exists, and "Forbidden" would leave the user guessing at one.
  if (!mayRequest) {
    return (
      <div className="page wide bg-gate" data-testid="break-glass-gate">
        <div className="bg-gate-card">
          <div className="bg-gate-badge quiet"><Icon name="shield" size={20} /></div>
          <h2 className="bg-gate-title">
            {tr(lang, "Немає доступу до цього запису", "You do not have access to this record")}
          </h2>
          <p className="bg-gate-body">
            {tr(lang,
              "Ваша роль не передбачає запиту доступу в режимі «розбити скло». Якщо цей запис потрібен вам для роботи — зверніться до адміністратора клініки.",
              "Your role does not include requesting break-glass access. If you need this record for your work, ask a clinic administrator.")}
          </p>
          {onLeave && (
            <div className="bg-gate-actions">
              <button className="btn" data-testid="bg-leave" onClick={onLeave}>
                {tr(lang, "Повернутися", "Go back")}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="page wide bg-gate" data-testid="break-glass-gate">
      <div className="bg-gate-card">
        <div className="bg-gate-badge"><Icon name="shield" size={20} /></div>
        <h2 className="bg-gate-title">
          {title || (isPatient
            ? tr(lang, "Картку пацієнта захищено", "This patient record is protected")
            : tr(lang, "Потрібен дозвіл на доступ", "Access request required"))}
        </h2>
        <p className="bg-gate-body">
          {body || (isPatient
            ? tr(lang,
              "Ви відкриваєте медичні дані пацієнта, з яким не пов'язані лікуванням. Доступ буде зафіксовано. Щоб продовжити — вкажіть причину та обґрунтування.",
              "You are opening the medical data of a patient you have no treatment relationship with. This access will be recorded. To continue, state a reason and a justification.")
            : tr(lang,
              "Ви відкриваєте медичний запис, до якого не маєте постійного доступу. Доступ буде зафіксовано.",
              "You are opening a clinical record you hold no standing access to. This access will be recorded."))}
        </p>

        {/* The three consequences, before the button rather than after it.
            They are the same three the dialog restates — a person who reads
            only this screen should already know what they are agreeing to. */}
        <ul className="bg-gate-facts">
          <li>
            <Icon name="clock" size={14} />
            <span>{isPatient
              ? tr(lang, "Доступ буде тимчасовим і лише до цієї картки.",
                "Access is temporary and covers this one record.")
              : tr(lang, "Доступ буде тимчасовим і лише до цього запису.",
                "Access is temporary and covers this one record.")}</span>
          </li>
          <li>
            <Icon name="history" size={14} />
            <span>{tr(lang,
              "Ваше ім'я, причину та час буде записано в журнал аудиту.",
              "Your name, your stated reason and the time enter the audit trail.")}</span>
          </li>
          <li>
            <Icon name="shield" size={14} />
            <span>{tr(lang,
              "Потрібно підтвердити дію паролем.",
              "You will be asked to confirm with your password.")}</span>
          </li>
        </ul>

        <div className="bg-gate-actions">
          <button className="btn accent" data-testid="bg-request" onClick={() => setOpen(true)}>
            <Icon name="shield" size={13} />
            {tr(lang, "Запитати доступ", "Request access")}
          </button>
          {/* Leaving must be as easy as entering — a gate with only one door
              is a nudge, and this decision should not be nudged. */}
          {onLeave && (
            <button className="btn" data-testid="bg-leave" onClick={onLeave}>
              {tr(lang, "Повернутися", "Go back")}
            </button>
          )}
        </div>
      </div>
      {open && (
        <RequestAccessModal
          lang={lang}
          resourceKind={resourceKind}
          resourceId={resourceId}
          patientLabel={patientLabel}
          reportCode={reportCode}
          onClose={() => setOpen(false)}
          onGranted={(grant, entry) => {
            setOpen(false);
            onGranted?.(grant, entry);
          }}
        />
      )}
    </div>
  );
}
