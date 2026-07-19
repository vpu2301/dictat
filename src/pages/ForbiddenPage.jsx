// ForbiddenPage.jsx — Renders when a role gate blocks the user.
import React from "react";
import { Empty } from "../components/UI.jsx";
import { tr } from "../i18n.js";

export function ForbiddenPage({ required = [], actual = [], navigate, lang = "en" }) {
  return (
    <div className="page">
      <Empty
        icon="shield"
        title={tr(lang, "Доступ заборонено", "Access denied")}
        body={
          (lang === "uk"
            ? `Потрібна роль: ${required.join(" або ")}. Ваші ролі: ${actual.join(", ") || "—"}.`
            : `Required role: ${required.join(" or ")}. You have: ${actual.join(", ") || "—"}.`)
        }
        action={navigate ? (
          <button className="btn" onClick={() => navigate("/")}>{tr(lang, "На головну", "Home")}</button>
        ) : null}
      />
    </div>
  );
}
