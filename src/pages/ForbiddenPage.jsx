// ForbiddenPage.jsx — Renders when a role gate blocks the user.
//
// A sentence, set well. Nothing else.
//
// This screen has been through a card with two columns of chips and a
// fact-sheet table, and both were the same mistake in different clothes: they
// turned two short facts — what the page needs, what you have — into furniture
// that took more room and more reading than the facts do. A refusal is one
// thing to say. It should be said in one sentence, and the roles belong INSIDE
// that sentence, where they are read once, in the order they matter.
//
// So: no icon plate, no card, no border, no chips. Type, space, and two quiet
// ways out.
//
// It stays presentation only. The server refuses these calls regardless; this
// screen just gives an honest answer instead of a page that renders and then
// fills with 403s.
import React from "react";
import { Icon } from "../components/UI.jsx";
import { tr, useI18n } from "../i18n.js";
// Shared with the sidebar's account block — Keycloak's own housekeeping
// roles must not reach a human. See roles.js.
import { productRoles } from "../auth/roles.js";

// The wire values are snake_case identifiers. They are shown to clinicians and
// office staff, so they are named, not printed raw — and an unknown role falls
// through to its own value rather than vanishing.
function roleLabel(role, lang) {
  switch (role) {
    case "clinician": return tr(lang, "Лікар", "Clinician");
    case "nurse": return tr(lang, "Медсестра", "Nurse");
    case "tenant_admin": return tr(lang, "Адміністратор клініки", "Clinic administrator");
    case "super_admin": return tr(lang, "Суперадміністратор", "Super administrator");
    case "auditor": return tr(lang, "Аудитор", "Auditor");
    case "knowledge_admin": return tr(lang, "Адміністратор бази знань", "Knowledge administrator");
    default: return role;
  }
}

/**
 * Roles as a readable list, emphasised in place: "Clinician or Nurse".
 * The separator is a parameter because the required list is an OR — holding
 * ANY of them opens the page — while the list of what you hold is an AND.
 * Nodes rather than a string, so the names can carry weight without a second
 * pass of markup at the call site.
 */
function RoleList({ roles, lang, sep }) {
  return roles.map((r, i) => (
    <React.Fragment key={r}>
      {i > 0 && (i === roles.length - 1 ? ` ${sep} ` : ", ")}
      <b>{roleLabel(r, lang)}</b>
    </React.Fragment>
  ));
}

export function ForbiddenPage({ required = [], actual = [], navigate, lang }) {
  // `lang` is optional: RequireRole renders this from inside the app shell and
  // has no reason to know about locales, so the language comes from context
  // when it is not passed. Without this the denial screen was the one screen
  // in the app that stayed English.
  const ctx = useI18n();
  const L = lang || (ctx && ctx.lang) || "en";
  const T = (uk, en) => tr(L, uk, en);

  const have = productRoles(actual);

  return (
    <div className="page state-page" role="alert">
      <div className="state-card">
        <h1 className="state-title">{T("Доступ заборонено", "Access denied")}</h1>

        <p className="state-lead">
          {required.length > 0 && (
            <>
              {T("Ця сторінка потребує ролі ", "This page needs the role ")}
              <RoleList roles={required} lang={L} sep={T("або", "or")} />
              {". "}
            </>
          )}
          {have.length > 0
            ? (
              <>
                {T("Ви увійшли як ", "You are signed in as ")}
                <RoleList roles={have} lang={L} sep={T("і", "and")} />
                {"."}
              </>
            )
            : T("У вас немає жодної з них.", "You hold none of them.")}
        </p>

        <p className="state-note">
          {T(
            "Якщо доступ потрібен вам для роботи — зверніться до адміністратора клініки.",
            "If you need it for your work, ask a clinic administrator.",
          )}
        </p>

        {navigate && (
          <div className="state-actions">
            {/* Home is the PRIMARY, and it is the solid one — the single piece
                of chrome on the page, so the eye lands on it. It is also the
                only action guaranteed to work: a refusal often arrives from a
                pasted link, and in a fresh tab history.back() has nowhere to
                go. Back is the quieter alternative beside it, and it is not
                offered at all when there is no history behind this page. */}
            <button type="button" className="state-btn" onClick={() => navigate("/")}>
              {T("На головну", "Home")}
            </button>
            {typeof window !== "undefined" && window.history.length > 1 && (
              <button type="button" className="state-link" onClick={() => window.history.back()}>
                <Icon name="arrowLeft" size={13} /> {T("Назад", "Back")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
