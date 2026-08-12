// chat/host/ChatHostRoute.jsx — the adapter, and the ONLY file in the module
// that is allowed to know this particular host exists.
//
// It reads the app's session and theme and hands them to <ChatEmbed> as plain
// props. Everything below the embed — every screen, hook and primitive — stays
// host-agnostic, which is what makes the "no auth / no shell / no account
// imports" rule checkable rather than aspirational. There is a tripwire test
// for it: src/chat/noHostImports.test.js.
//
// ── The patient roster is real ───────────────────────────────────────────
// `onSearchPatients` hands the module this tenant's actual roster (GET
// /patients), so the import dialog searches real people rather than fixtures.
// Three things that follow from that, all of them deliberate:
//
//  1. Only what the roster list returns crosses over — name, year of birth,
//     sex, MRN, tags, summary. No diagnoses, medication, labs or ІПН: those
//     live behind per-patient endpoints and the module has no reason to read
//     them to hold a conversation.
//  2. Nothing is persisted. The attached patient lives in memory for the
//     session; the module's storage holds settings only.
//  3. `patient_context_attached` / `_removed` are emitted on every attach and
//     detach — that is the hook the host's audit log wires into, and it should
//     be wired before this ships to a real clinic (see src/chat/README.md).
//
// ── The answers are real when a backend is configured ────────────────────
// `backend` (below) points the module at an answer API — by default this
// platform's own `evidence-answer` (:8013), under the session's own Keycloak
// token. Given one, answers are model-generated from retrieved sources and the
// disclaimer under every answer changes to say so; given none, the module stays
// on its fixtures and the disclaimer says that instead. Which backend, and why
// there is more than one candidate, is src/api/evidenceChat.js `chatBackend()`.
//
// NOTE, while `evidence-answer` serves quick-search only: its request body has
// no patient field, so an attached patient does NOT reach it. That is not
// silent — the answer carries a line saying its data was not used (see
// data/platformMapping.js NOTES). The de-identifying mapper that the other
// backend needs is still the only door out for patient data:
// src/chat/data/answerMapping.js toPatientContext.

import React, { useCallback, useMemo } from "react";
import { ChatEmbed } from "../ChatEmbed.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";
import { listPatients, displayName } from "../../api/patients.js";
import { chatBackend } from "../../api/evidenceChat.js";

export const CHAT_BASE_PATH = "/chat";

export function ChatHostRoute({ route, navigate, lang = "en", theme = "light", onEvent, onToast }) {
  const { state } = useAuth();
  const claims = state?.claims;
  const dbUser = state?.dbUser;

  // Roster search, mapped to the shape the module's patient context expects.
  // `dob` is only present on the detail record — the list carries it as null by
  // design (PHI minimisation), so the panel shows what it has and no more.
  const searchPatients = useCallback(async (query) => {
    const page = await listPatients({ query: query || undefined, limit: 25 });
    return (page?.items || []).map((p) => ({
      id: p.id,
      name: displayName(p, lang),
      dob: p.dob || null,
      sex: (p.sex || "").toLowerCase() === "m" ? "m" : (p.sex || "").toLowerCase() === "f" ? "f" : null,
      mrn: p.mrn || null,
      // The roster's free-text summary is the closest thing to a problem list
      // the list endpoint carries; tags stand in for diagnoses until the module
      // is allowed to read the clinical record itself.
      summary: p.summary ? (p.summary[lang] || p.summary.en || p.summary.uk || "") : "",
      diagnoses: (p.tags || []).map((tag) => ({ code: "", label: tag })),
      medications: [],
      labs: [],
      allergies: [],
      source: "host",
    }));
  }, [lang]);

  // A generated note/plan leaves the module here. Until the report editor has
  // an "insert draft" entry point, the honest handoff is the clipboard plus a
  // toast that says where it went — not a fake save that produces nothing.
  const createDocument = useCallback(async (doc) => {
    try {
      await navigator.clipboard?.writeText(doc.body);
      onToast?.(lang === "uk"
        ? `${doc.title.split(":")[0]} скопійовано — вставте у звіт`
        : `${doc.title.split(":")[0]} copied — paste it into a report`);
    } catch {
      onToast?.(lang === "uk" ? "Не вдалося скопіювати" : "Couldn’t copy the document");
    }
  }, [lang, onToast]);

  const user = {
    id: claims?.sub || "unknown",
    name: dbUser?.display_name || claims?.sub || "—",
    email: dbUser?.email || "",
    role: (claims?.roles || [])[0] || "viewer",
  };

  const workspace = {
    id: claims?.tid || "unknown",
    name: dbUser?.tenant_name || claims?.tenant_name || (lang === "uk" ? "Ваша клініка" : "Your clinic"),
  };

  // The answer backend, when this environment has one configured AND can
  // authenticate against it (src/api/evidenceChat.js). Null everywhere else,
  // and null is not a failure state: the module answers from its fixtures and
  // says so in the disclaimer under every answer.
  const backend = useMemo(() => chatBackend(), []);

  return (
    // `wide` + the host class: the answer wants the height and the width of
    // the whole content area, not the 1280px reading column a form page uses.
    // The module keeps its own measure inside — see --ec-measure.
    <div className="page wide chat-host-page">
      <ChatEmbed
        user={user}
        workspace={workspace}
        backend={backend}
        allowPatientImport
        basePath={CHAT_BASE_PATH}
        path={route}
        locale={lang}
        // Mode drives the module's own token set; the overrides below pin the
        // few tokens where looking native matters more than looking neutral.
        // They are `var()` references, so the app's theme switch repaints the
        // module without it re-rendering at all.
        theme={{
          mode: theme === "dark" ? "dark" : "light",
          tokens: {
            // NOT var(--bg): that is the flat ground, and the shell paints a
            // wash over it (.app, styles.css). Handing the module the flat
            // colour made it repaint a plain slab across the middle of a lit
            // page — a rectangle with visible edges where the wash stopped.
            // Transparent lets the same light fall across the panel.
            bg: "transparent",
            // The dock needs no ground of its own HERE: `fill` below gives the
            // module a fixed height and the thread scrolls inside .ec-scroll,
            // so nothing ever passes under the composer. An opaque dock just
            // stamped a second rectangle across the bottom of the page — the
            // composer is already a card with its own surface and shadow.
            "dock-bg": "transparent",
            surface: "var(--surface)",
            "surface-2": "var(--surface-2)",
            hover: "var(--surface-hover)",
            text: "var(--text-1)",
            "text-2": "var(--text-2)",
            muted: "var(--muted)",
            line: "var(--line)",
            "line-2": "var(--line-2)",
            accent: "var(--accent)",
            "accent-soft": "var(--accent-soft)",
            radius: "var(--radius)",
            shadow: "var(--shadow-1)",
            // This host owns the content area, so it can say how tall that is
            // and let the module fill it — the ask box then sits at the bottom
            // of the page rather than at the bottom of a guessed box. The
            // viewport maths lives here, in the adapter, not in the module.
            //
            // The budget, measured rather than guessed (the old 152 was short
            // by ~14px, which is why the pane itself used to scroll):
            //   52  app topbar
            //   10  .chat-host-page padding-top
            //   51  the module's own nav row (42 + its 9px margin)
            //   12  .chat-host-page padding-bottom
            //    6  slack, so a rounding error cannot start a scrollbar
            // Every one of those but the topbar is set in app-extra.css
            // (.chat-host-page) or chat.css (.ec-topline) — change a number
            // there and change this.
            fill: "calc(100vh - 131px)",
          },
        }}
        // This host owns the content area, so the module's dialogs behave like
        // every other modal in Klarnote: portalled out and dimming the page.
        modalHost="page"
        onSearchPatients={searchPatients}
        onCreateDocument={createDocument}
        onNavigate={navigate}
        onEvent={(evt) => {
          // The host owns telemetry. Patient-context events are the ones a real
          // host must route to its audit log — that wiring belongs to the same
          // sprint as real patient data, and lands here, not in the module.
          if (onEvent) onEvent(evt);
          else if (import.meta.env?.DEV) console.debug("[evidence-chat]", evt);
        }}
      />
    </div>
  );
}
