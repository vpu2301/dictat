// chat/ChatEmbed.jsx — the one component a host mounts.
//
//   <ChatEmbed
//     user={{ id, name, email, role }}          // host-provided, already authed
//     workspace={{ id, name }}
//     patient={patientOrUndefined}              // optional: host injects context
//     allowPatientImport                        // show import when none injected
//     basePath="/apps/evidence-chat"
//     path="/apps/evidence-chat/history"        // optional: host owns the URL
//     theme={{ mode: "light" | "dark", tokens }}
//     locale="en"
//     onNavigate={(path) => void}
//     onEvent={(evt) => void}
//     onRequestPatient={() => Promise<Patient|null>}   // delegate to host UI
//     onSearchPatients={(q) => Promise<Patient[]>}     // the host's real roster
//     onCreateDocument={(doc) => void}                 // note/plan leaves here
//     modalHost="panel" | "page"                       // where dialogs render
//   />
//
// What this component refuses to do, on purpose:
//  · read identity from storage or a cookie — `user`/`workspace` props only;
//  · discover a patient by guessing at host internals — context arrives via the
//    `patient` prop, `onRequestPatient`, or the module's own import dialog;
//  · render an <a href> that would reload the host page;
//  · position anything fixed to the viewport — the panel is the world;
//  · call an analytics SDK — telemetry leaves through `onEvent`.
//
// Two navigation modes, same screens. Give it `path` + `onNavigate` and the
// host owns the URL (deep links, Back button). Give it neither and it routes
// internally — that is how the harness runs it.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SessionProvider } from "./SessionContext.jsx";
import { EmbedProvider } from "./EmbedContext.jsx";
import { useSettings } from "./data/useSettings.js";
import { configureBackend, isLiveBackend } from "./data/backend.js";
import { fetchPatient } from "./data/hooks.js";
import { buildPath, parsePath } from "./routing.js";
import { ChatPage } from "./features/chat/ChatPage.jsx";
import { HistoryPanel } from "./features/history/HistoryPanel.jsx";
import { AgentsPanel } from "./features/agents/AgentsPanel.jsx";
import { ErrorState } from "./ui/States.jsx";
import { Icon } from "./ui/Icon.jsx";
import { t } from "./i18n.js";
import "./chat.css";

// A render-time crash in one screen must degrade to a message inside the panel,
// not a white page where the host used to be.
class PanelBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="ec-card">
          <ErrorState
            error={this.state.error}
            locale={this.props.locale}
            title={t(this.props.locale, "Модуль зупинився", "This module hit a snag")}
            onRetry={() => this.setState({ error: null })}
          />
        </div>
      );
    }
    return this.props.children;
  }
}

// Three sections. Settings AND connectors are deliberately absent: both live on
// the host's own settings page, rendered from this module's data.
const NAV = [
  { view: "chat", icon: "sparkle", uk: "Чат", en: "Chat" },
  { view: "history", icon: "history", uk: "Історія", en: "History" },
  { view: "agents", icon: "users", uk: "Агенти", en: "Agents" },
];

export function ChatEmbed({
  user,
  workspace,
  patient: injectedPatient,
  allowPatientImport = false,
  basePath = "/chat",
  path,
  theme,
  locale = "en",
  onNavigate,
  onEvent,
  onRequestPatient,
  // The host's real patient roster. Given one, the import dialog searches THAT
  // instead of the module's fixtures — this is the door real patient data comes
  // through, and the only one.
  onSearchPatients,
  // Where a generated note/plan goes when the user sends it out of the module.
  onCreateDocument,
  // "panel" (default) dims the module only; "page" portals dialogs to <body>
  // and dims the viewport, for a host that owns the whole content area and
  // wants its own modal behaviour. See ui/ModalLayer.jsx.
  modalHost = "panel",
  // Where real answers come from: `{ baseUrl, getToken }`. Omit it and the
  // module answers from its fixtures — which is what the harness, the tests
  // and any host without an evidence backend get. The module never discovers
  // this for itself; a base URL and a token are host knowledge.
  backend = null,
  className = "",
}) {
  const mode = theme?.mode === "dark" ? "dark" : "light";
  // Applied during render, before any child can ask for data. Comparing the
  // config inside means a re-render does not rebuild the client.
  useMemo(() => configureBackend(backend && { ...backend, locale }), [backend, locale]);
  const live = isLiveBackend();
  const { settings, update: updateSettings, reset: resetSettings } = useSettings(workspace?.id);

  const [internalPath, setInternalPath] = useState(basePath);
  const currentPath = path != null ? path : internalPath;
  const route = useMemo(() => parsePath(currentPath, basePath), [currentPath, basePath]);

  const emit = useCallback((evt) => {
    if (typeof onEvent === "function") {
      onEvent({ at: new Date().toISOString(), workspaceId: workspace?.id, ...evt });
    }
  }, [onEvent, workspace?.id]);

  const navigate = useCallback((target) => {
    const next = typeof target === "string" ? target : buildPath(basePath, target);
    if (typeof onNavigate === "function") onNavigate(next);
    else setInternalPath(next);
  }, [basePath, onNavigate]);

  // ── patient context ─────────────────────────────────────────────────────
  // A host-injected patient wins and stays: `patientLocked` is what makes it
  // fixed for the session. Anything imported in-module lives in state and is
  // removable. Neither is ever written to storage.
  const [importedPatient, setImportedPatient] = useState(null);
  const patientLocked = !!injectedPatient;
  const patient = injectedPatient || importedPatient;

  // If the host swaps the injected patient (navigating between charts), drop
  // any imported one so the two can never disagree about who we are discussing.
  useEffect(() => {
    if (injectedPatient) setImportedPatient(null);
  }, [injectedPatient?.id]);

  const announcedRef = useRef(null);
  useEffect(() => {
    if (injectedPatient && announcedRef.current !== injectedPatient.id) {
      announcedRef.current = injectedPatient.id;
      emit({ name: "patient_context_attached", patientId: injectedPatient.id, via: "host_prop" });
    }
  }, [injectedPatient, emit]);

  const attachPatient = useCallback((next, { via = "import_dialog", silent = false } = {}) => {
    if (patientLocked || !next) return;
    setImportedPatient(next);
    if (!silent) emit({ name: "patient_context_attached", patientId: next.id, via });
  }, [patientLocked, emit]);

  const attachPatientById = useCallback(async (id, opts) => {
    if (patientLocked || !id) return;
    try {
      const found = await fetchPatient(id);
      if (found) attachPatient(found, { via: "session_resume", ...opts });
    } catch {
      /* resuming without the context is better than failing the resume */
    }
  }, [patientLocked, attachPatient]);

  const removePatient = useCallback(({ silent = false } = {}) => {
    if (patientLocked) return;
    const id = importedPatient?.id;
    setImportedPatient(null);
    if (!silent) emit({ name: "patient_context_removed", patientId: id });
  }, [patientLocked, importedPatient, emit]);

  const requestPatientFromHost = useCallback(async () => {
    if (typeof onRequestPatient !== "function") return null;
    emit({ name: "patient_picker_requested" });
    try {
      return await onRequestPatient();
    } catch {
      return null;
    }
  }, [onRequestPatient, emit]);

  // Host token overrides. Values may be plain colours or `var(--host-token)`
  // references — either way they win over the module's own defaults, and
  // swapping them (or `theme.mode`) restyles without remounting anything.
  const styleVars = useMemo(() => {
    const tokens = theme?.tokens || {};
    return Object.fromEntries(
      Object.entries(tokens).map(([k, v]) => [k.startsWith("--") ? k : `--ec-${k}`, v]),
    );
  }, [theme?.tokens]);

  const go = (view) => { emit({ name: "nav", view }); navigate({ view }); };

  return (
    <div className={`ec-root ${className}`} data-ec-theme={mode} style={styleVars}>
      <SessionProvider user={user} workspace={workspace}>
        <EmbedProvider
          value={{
            basePath, locale, navigate, emit, route, live,
            settings, updateSettings, resetSettings,
            patient, patientLocked, allowPatientImport,
            hasHostPicker: typeof onRequestPatient === "function",
            attachPatient, attachPatientById, removePatient, requestPatientFromHost,
            modal: { mode: modalHost, theme: mode, styleVars },
            searchPatients: typeof onSearchPatients === "function" ? onSearchPatients : null,
            onCreateDocument: typeof onCreateDocument === "function" ? onCreateDocument : null,
          }}
        >
          <div className="ec-topline">
            <nav className="ec-nav" aria-label={t(locale, "Розділи модуля", "Module sections")}>
              {NAV.map((n) => (
                <button
                  key={n.view}
                  type="button"
                  className={`ec-navbtn${route.view === n.view ? " on" : ""}`}
                  aria-current={route.view === n.view ? "page" : undefined}
                  onClick={() => go(n.view)}
                >
                  <Icon name={n.icon} size={13} />
                  <span>{t(locale, n.uk, n.en)}</span>
                </button>
              ))}
            </nav>
            {workspace && (
              <div className="ec-ws" title={t(locale, "Простір надано хостом", "Workspace injected by the host")}>
                <span className="ec-ws-name">{workspace.name}</span>
              </div>
            )}
          </div>

          <PanelBoundary locale={locale}>
            {route.view === "chat" && <ChatPage key={route.sessionId || "new"} sessionId={route.sessionId} />}
            {route.view === "history" && <HistoryPanel />}
            {route.view === "agents" && <AgentsPanel />}
          </PanelBoundary>
        </EmbedProvider>
      </SessionProvider>
    </div>
  );
}

export default ChatEmbed;
