// App.jsx — App shell, hash router, Tweaks
import React, { useState, useEffect, useMemo } from 'react';
import { I18nProvider, LANGS , tr, isRtl } from "./i18n.js";
import {
  useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakColor, TweakSelect, TweakToggle,
} from './components/TweaksPanel.jsx';
import { Icon, TopBar, Toast, Empty } from './components/UI.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { NotificationsProvider } from './notifications/store.jsx';
import { NotificationBell } from './components/NotificationBell.jsx';
import { NotificationToasts } from './components/NotificationToasts.jsx';
import NotificationPreferencesPage from './pages/NotificationPreferencesPage.jsx';
import { StudioWorkspace } from './studio/StudioWorkspace.jsx';
import { StudioHistoryPage } from './studio/StudioHistoryPage.jsx';
import { ReportsList, ReportView } from './components/Reports.jsx';
import { ScribeToday, ScribeConsult, ScribeNotes } from './components/Scribe.jsx';
import { PatientDirectory } from './patients/PatientDirectory.jsx';
import { PrivacyAdminPage } from './pages/PrivacyAdminPage.jsx';
import { ErasureRequestPage } from './pages/ErasureRequestPage.jsx';
import { EnhancedScribePatient } from './components/PatientProfile.jsx';
import { NoteEditorPage, QuickNoteModal, useQuickNoteHotkey } from './components/NoteEditor.jsx';
import { NoteReviewPage } from './components/NoteReview.jsx';
import { ConsentScreen, RecordingIndicator } from './components/ConsentFlow.jsx';
import { TemplatesPage } from './components/TemplatesPage.jsx';
import { ScribeNoteStructures } from './components/Scribe.jsx';
import { useAsync } from './api/useAsync.js';
import { listTemplates, createTemplate, toStudioTemplate } from './api/templates.js';

import { LandingPage } from './pages/LandingPage.jsx';
import { ContentPage } from './pages/marketing/ContentPage.jsx';
import { ApiDocsPage } from './pages/marketing/ApiDocsPage.jsx';
import { DevelopersPage } from './pages/marketing/DevelopersPage.jsx';
import { DocsPage } from './pages/marketing/DocsPage.jsx';
import { TemplatesMarketPage } from './pages/marketing/TemplatesMarketPage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { SignupFlow } from './pages/SignupFlow.jsx';
import { PricingPage } from './pages/PricingPage.jsx';
import { BlogPage } from './pages/BlogPage.jsx';
import { BlogPostPage } from './pages/BlogPostPage.jsx';
import { VerifyPage } from './pages/VerifyPage.jsx';
import { MfaPage } from './pages/MfaPage.jsx';
import { MePage } from './pages/MePage.jsx';
import { ProfilePage } from './pages/ProfilePage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { CompanyPage } from './company/CompanyPage.jsx';
import { CompanyLoginPage } from './company/CompanyLoginPage.jsx';
import { AdminUsersPage } from './pages/AdminUsersPage.jsx';
import { TenantSettingsPage } from './pages/TenantSettingsPage.jsx';
import { TenantMembersPage } from './pages/TenantMembersPage.jsx';
import { AuditEventsPage } from './pages/AuditEventsPage.jsx';
import { AuditVerifyPage } from './pages/AuditVerifyPage.jsx';
import { PhiAccessLogPage } from './pages/PhiAccessLogPage.jsx';
import { AccessReviewPage } from './pages/AccessReviewPage.jsx';
import { CompliancePage } from './pages/CompliancePage.jsx';
import { ForbiddenPage } from './pages/ForbiddenPage.jsx';
import { SettingsPage } from './pages/SettingsPage.jsx';
import { AsrJobsListPage } from './pages/AsrJobsListPage.jsx';
import { AsrJobDetailPage } from './pages/AsrJobDetailPage.jsx';
import { DocumentsPage, docPath, docTabFromRoute } from './pages/DocumentsPage.jsx';
import { TemplateLibraryPage, libPath, libTabFromRoute } from './pages/TemplateLibraryPage.jsx';
import { ChatHostRoute, CHAT_BASE_PATH } from './chat/host/ChatHostRoute.jsx';
import { EmbedHarness as ChatEmbedHarness } from './chat/EmbedHarness.jsx';
import { useSettings as useChatSettings } from './chat/settingsContract.js';
import { RequireAuth, RequireRole, RequireClinical } from './auth/RequireRole.jsx';
import { useAuth, hasAnyRole } from './auth/AuthContext.jsx';
import { PATIENT_ROLES, hasClinicalAccess, isAuditorOnly } from './auth/permissions.js';

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "lang": "uk",
  "density": "comfortable",
  "accent": "#0a8a7a"
}/*EDITMODE-END*/;

// A route that only forwards. Used for paths that were real screens once and
// are now folded into another one — the hash changes on mount, so the address
// bar and the back button agree with what is on screen.
function RouteRedirect({ to, navigate }) {
  useEffect(() => { navigate(to); }, [to, navigate]);
  return null;
}

// The four capture screens became four modes of /studio. Forward the old paths
// with their context intact — a patient card's "dictate" link, a notification's
// deep link and a year of bookmarks all point at them.
function studioRedirect(mode, query) {
  const q = new URLSearchParams({ mode });
  for (const k of ["patient", "encounter", "template", "report", "session", "job", "note"]) {
    const v = query.get(k);
    if (v) q.set(k, v);
  }
  return `/studio?${q}`;
}

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = useState(() => location.hash.replace(/^#/, "") || "/");
  const [toast, setToast] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);
  const [activeRecording, setActiveRecording] = useState(null);
  const lang = tweaks.lang;
  const { state: auth } = useAuth();
  // The evidence-chat module is a fixture-data demo behind a settings gate
  // ("Show the module" in /settings). While OFF, its sidebar block is hidden
  // (Sidebar.jsx) and its routes fall through to the 404 — a bookmarked /chat
  // must not resurrect a module the workspace has switched off.
  const chatModuleEnabled = !!useChatSettings(auth?.claims?.tid).settings.moduleEnabled;

  // Every recording/authoring shortcut is clinical: an auditor or an
  // admin-only account pressing them would land on a forbidden page.
  const clinical = hasClinicalAccess(auth?.claims);

  // Quick note hotkey
  useQuickNoteHotkey(() => { if (clinical) setQuickNoteOpen(true); });

  const fireToast = (msg) => setToast({ msg });

  // Shared template summaries — feed the dictation Studio's template picker.
  // The Templates admin page (/dictate/templates) self-manages its own data.
  // Summaries carry no schema_jsonb (no sections); the Studio fetches detail
  // for the active template. Adapt the backend shape to the legacy Studio shape.
  // Keyed on auth: when the app boots logged-out (no refresh cookie) and the
  // user signs in afterwards, this must re-fetch — otherwise the one mount-time
  // call fired without a bearer token, failed, and the Studio would forever show
  // "No templates available". Gated so we don't fire it while unauthenticated.
  const templatesReq = useAsync(
    () => listTemplates({ limit: 200 }),
    [auth],
    { enabled: !!auth },
  );
  const templatesMap = useMemo(() => {
    const list = Array.isArray(templatesReq.data)
      ? templatesReq.data
      : (templatesReq.data?.items || []);
    return Object.fromEntries(list.map((t) => {
      const adapted = toStudioTemplate(t);
      return [adapted.id, adapted];
    }));
  }, [templatesReq.data]);
  // Create-from-scratch (Studio "new template" dialog). Returns the new id so
  // the Studio can select it; the detail fetch then loads its sections.
  const handleAddTemplate = async (definition) => {
    const res = await createTemplate(definition);
    await templatesReq.reload();
    return res?.id ?? null;
  };

  // Hash router
  useEffect(() => {
    const onHash = () => setRoute(location.hash.replace(/^#/, "") || "/");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const navigate = (p) => { location.hash = p; };

  // ── Auth gate ───────────────────────────────────────────────
  // Routes reachable without a session: the auth screens and the
  // public signature-verification deep link. Everything else needs login.
  const isAuthRoute   = route === "/login" || route === "/signup";
  // Landing is public: /welcome always, and the bare root only when signed out
  // (authenticated users at "/" land on their workspace instead).
  const isLanding     = route === "/welcome" || ((route === "/" || route === "") && !auth);
  // Public marketing sub-pages (footer + feature/product/security content).
  const MARKETING_EXACT = ["/about", "/contact", "/careers", "/blog", "/features", "/security", "/pricing", "/templates"];
  const isMarketing = MARKETING_EXACT.includes(route)
    || route.startsWith("/legal/") || route.startsWith("/features/") || route.startsWith("/product/")
    || route.startsWith("/templates/")
    || route.startsWith("/blog/") || route === "/developers" || route === "/developers/api"
    || route.startsWith("/developers/api/") || route === "/docs" || route.startsWith("/docs/");
  // The Klarnote staff console self-gates. It is listed here not because it is
  // public — it is the most private surface in the app — but because the shared
  // gate below redirects to /login, and bouncing our own team to the clinic's
  // front desk is the one thing this console must never do. CompanyPage and
  // CompanyLoginPage own the redirect, and send unauthenticated visitors to
  // /company/login instead.
  const isCompanyRoute = route === "/company" || route.startsWith("/company/");
  // The evidence-chat embed harness is a dev-only fake host running on
  // fixtures — no session, no backend, no patient data to protect. Sending it
  // to /login would defeat the one thing it exists for: reviewing the module in
  // isolation from this app.
  const isEmbedHarness = !!import.meta.env?.DEV && route === "/chat/harness";
  const isPublicRoute = isAuthRoute || isLanding || isMarketing || isCompanyRoute
    || isEmbedHarness || route.startsWith("/verify/");
  const gateToLogin   = !auth && !isPublicRoute;   // protected route, no session → login
  const gateToHome    = !!auth && isAuthRoute;      // already signed in → leave the auth screens

  // Keep the URL hash in sync with the gate decision.
  useEffect(() => {
    if (gateToLogin) navigate("/login");
    else if (gateToHome) navigate("/");
  }, [gateToLogin, gateToHome]);

  // Tenant admins land on their dashboard. When an authenticated owner hits the
  // bare root (post-login or "Klarnote" brand click), send them to #/dashboard.
  const isTenantAdmin = hasAnyRole(auth?.claims, ["tenant_admin"]);
  useEffect(() => {
    if (auth && isTenantAdmin && (route === "/" || route === "")) navigate("/dashboard");
  }, [auth, isTenantAdmin, route]);

  // Same for an auditor-only account: the root renders the clinical queue,
  // which for them is a forbidden page. Land them on the trail instead.
  const auditorOnly = isAuditorOnly(auth?.claims);
  useEffect(() => {
    if (auth && auditorOnly && (route === "/" || route === "")) navigate("/audit/events");
  }, [auth, auditorOnly, route]);

  // Theme + density + accent + document language
  useEffect(() => {
    document.documentElement.dataset.theme = tweaks.theme;
    document.documentElement.dataset.density = tweaks.density;
    document.documentElement.style.setProperty("--accent", tweaks.accent);
    document.documentElement.lang = tweaks.lang;
    // Arabic (and any future RTL language) flips the whole document.
    document.documentElement.dir = isRtl(tweaks.lang) ? "rtl" : "ltr";
  }, [tweaks.theme, tweaks.density, tweaks.accent, tweaks.lang]);

  // Keyboard: N → new consultation in scribe; D → studio
  useEffect(() => {
    if (!clinical) return;
    const onKey = (e) => {
      if (e.target.matches("input, textarea, [contenteditable]")) return;
      if (e.key === "n" && !e.metaKey && !e.ctrlKey) { e.preventDefault(); navigate("/scribe/consult/new"); }
      if (e.key === "d" && !e.metaKey && !e.ctrlKey) { e.preventDefault(); navigate("/studio"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clinical]);

  // Parse route → view
  let view;
  let crumbs = null;
  let showTopbar = true;
  let title = "";
  let fullBleed = false; // /login uses no sidebar

  const r = route;
  // Path/query split for routes that deep-link with a hash query string, e.g.
  // "/audit/events?from_seq=42". NOTE: `r` deliberately keeps the query — the
  // studio route regex-matches patient/template/report/encounter out of it.
  const [routePath, routeSearch] = route.split("?");
  const routeQuery = new URLSearchParams(routeSearch || "");

  // ── auth gate (render the right view synchronously to avoid a flash) ─
  if (gateToLogin) {
    view = <LoginPage navigate={navigate} lang={lang} />;
    fullBleed = true;
  } else if (gateToHome) {
    view = <ScribeToday navigate={navigate} lang={lang} />;
    title = tr(lang, "Завдання", "Tasks");
  }
  // ── auth routes ────────────────────────────────────────────
  else if (r === "/login") {
    view = <LoginPage navigate={navigate} lang={lang} />;
    fullBleed = true;
  }
  // ── signup (Heidi-style entry: create account or book a demo) ──
  else if (r === "/signup") {
    view = <SignupFlow navigate={navigate} lang={lang} />;
    fullBleed = true;
  }
  // ── public landing (marketing) ─────────────────────────────
  else if (r === "/welcome" || ((r === "/" || r === "") && !auth)) {
    view = <LandingPage navigate={navigate} lang={lang} tweaks={tweaks} setTweak={setTweak} />;
    fullBleed = true;
  }
  // ── public marketing sub-pages (footer + features/products/security) ─
  else if (r === "/pricing") {
    view = <PricingPage navigate={navigate} lang={lang} tweaks={tweaks} setTweak={setTweak} />;
    fullBleed = true;
  }
  else if (r === "/blog") {
    view = <BlogPage navigate={navigate} lang={lang} tweaks={tweaks} setTweak={setTweak} />;
    fullBleed = true;
  }
  else if (r.startsWith("/blog/")) {
    view = <BlogPostPage slug={r.replace(/^\/blog\//, "")} navigate={navigate} lang={lang} tweaks={tweaks} setTweak={setTweak} />;
    fullBleed = true;
  }
  else if (r === "/developers/api" || r.startsWith("/developers/api/")) {
    view = <ApiDocsPage svc={r.replace(/^\/developers\/api\/?/, "")} navigate={navigate} lang={lang} tweaks={tweaks} setTweak={setTweak} />;
    fullBleed = true;
  }
  else if (r === "/developers") {
    view = <DevelopersPage navigate={navigate} lang={lang} tweaks={tweaks} setTweak={setTweak} />;
    fullBleed = true;
  }
  else if (r === "/docs" || r.startsWith("/docs/")) {
    view = <DocsPage slug={r.replace(/^\/docs\/?/, "")} navigate={navigate} lang={lang} tweaks={tweaks} setTweak={setTweak} />;
    fullBleed = true;
  }
  else if (r === "/templates" || r.startsWith("/templates/")) {
    view = <TemplatesMarketPage slug={r.replace(/^\/templates\/?/, "")} navigate={navigate} lang={lang} tweaks={tweaks} setTweak={setTweak} />;
    fullBleed = true;
  }
  else if (
    ["/about", "/contact", "/careers", "/features", "/security"].includes(r)
    || r.startsWith("/legal/") || r.startsWith("/features/") || r.startsWith("/product/")
  ) {
    view = <ContentPage slug={r.replace(/^\//, "")} navigate={navigate} lang={lang} tweaks={tweaks} setTweak={setTweak} />;
    fullBleed = true;
  }
  // ── mfa scaffold (sprint 16; flag-off path today) ───────────
  else if (r === "/mfa") {
    view = <MfaPage lang={lang} />;
    crumbs = [{ label: tr(lang, "Безпека", "Security") }, { label: "MFA" }];
  }
  // ── scribe ─────────────────────────────────────────────────
  else if (r === "/scribe" || r === "/" || r === "") {
    // S14 — the day's clinical queue. Admin-only accounts get the standard
    // forbidden state rather than a page of failing requests.
    view = <RequireClinical navigate={navigate}><ScribeToday navigate={navigate} lang={lang} /></RequireClinical>;
    title = tr(lang, "Завдання", "Tasks");
  } else if (r === "/scribe/patients" || r === "/patients") {
    // /patients is the sprint-11 canonical alias; both render the directory.
    // Role-gated since the auditor split: `patients.read` admits clinician /
    // nurse / tenant_admin, and a deep link from anyone else gets the standard
    // forbidden state instead of a roster of failing requests.
    view = (
      <RequireRole any={PATIENT_ROLES} navigate={navigate}>
        <PatientDirectory navigate={navigate} lang={lang} />
      </RequireRole>
    );
    crumbs = [{ label: "Scribe", path: "/scribe", onClick: () => navigate("/scribe") }, { label: tr(lang, "Пацієнти", "Patients") }];
  } else if (r.startsWith("/patients/") && r.endsWith("/erasure-request")) {
    // S11 step 06 — the weighty full-screen erasure request (admin-only,
    // deep-link-safe: RequireRole renders the standard forbidden state)
    const pid = r.split("/")[2];
    view = (
      <RequireRole any={["tenant_admin", "super_admin"]} navigate={navigate}>
        <ErasureRequestPage patientId={pid} lang={lang} navigate={navigate} />
      </RequireRole>
    );
    crumbs = [{ label: tr(lang, "Приватність", "Privacy") }, { label: tr(lang, "Запит на видалення", "Erasure request") }];
  } else if (r.startsWith("/scribe/patients/") || r.startsWith("/patients/")) {
    // ?tab= is the one allowed (enum) param on this route — strip it from the id
    const id = r.split("/")[r.startsWith("/scribe/") ? 3 : 2]?.split("?")[0];
    view = (
      <RequireRole any={PATIENT_ROLES} navigate={navigate}>
        <EnhancedScribePatient id={id} navigate={navigate} lang={lang} />
      </RequireRole>
    );
    crumbs = [
      { label: "Scribe", path: "/scribe", onClick: () => navigate("/scribe") },
      { label: tr(lang, "Пацієнти", "Patients"), path: "/scribe/patients", onClick: () => navigate("/scribe/patients") },
      { label: id },
    ];
  } else if (r.startsWith("/scribe/notes/new") || r === "/scribe/notes/new") {
    // The note/consult/consent surfaces write clinical records — same gate as
    // the notes list above, so a non-clinical deep link stops at the door.
    const m = r.match(/patient=([\w-]+)/);
    view = <RequireClinical navigate={navigate}><NoteEditorPage patientId={m?.[1]} lang={lang} navigate={navigate} /></RequireClinical>;
    showTopbar = false;
  } else if (r.startsWith("/scribe/notes/") && r.split("/").length >= 4 && r.split("/")[3] !== "new") {
    const noteId = r.split("/")[3];
    view = <RequireClinical navigate={navigate}><NoteEditorPage noteId={noteId} lang={lang} navigate={navigate} /></RequireClinical>;
    showTopbar = false;
  } else if (r.startsWith("/scribe/review/")) {
    const sessionId = r.split("/")[3];
    view = <RequireClinical navigate={navigate}><NoteReviewPage sessionId={sessionId} lang={lang} navigate={navigate} /></RequireClinical>;
    showTopbar = false;
  } else if (r.startsWith("/scribe/consent/new") || r === "/scribe/consent/new") {
    const m = r.match(/patient=([\w-]+)/);
    view = <RequireClinical navigate={navigate}><ConsentScreen patientId={m?.[1]} lang={lang} navigate={navigate} /></RequireClinical>;
    showTopbar = false;
  } else if (r === "/scribe/consult/new" || r.startsWith("/scribe/consult/")) {
    const m = r.match(/patient=([\w-]+)/);
    const idMatch = r.match(/^\/scribe\/consult\/([^?]+)/);
    view = (
      <RequireClinical navigate={navigate}>
        <ScribeConsult id={idMatch?.[1]} patientHint={m?.[1]} navigate={navigate} lang={lang} onRecordingChange={setActiveRecording} />
      </RequireClinical>
    );
    showTopbar = false;
  } else if (r === "/scribe/notes") {
    // The three document lists live on one page now; the old paths forward.
    view = <RouteRedirect to={docPath("notes")} navigate={navigate} />;
  } else if (r === "/scribe/templates") {
    // Both libraries live on one page now; the old paths forward.
    view = <RouteRedirect to={libPath("notes")} navigate={navigate} />;
  }
  // ── dictate ────────────────────────────────────────────────
  // /dictate was the second landing, behind the Scribe/Dictate product switch.
  // Both switch and landing are gone: one home page at /scribe now shows the
  // day and the documents together, so this path only forwards bookmarks and
  // old links there. The recording Studio keeps its own route below.
  else if (r === "/dictate" || r === "/dictate/") {
    view = <RouteRedirect to="/scribe" navigate={navigate} />;
    title = tr(lang, "Завдання", "Tasks");
  } else if (r === "/dictate/studio" || r.startsWith("/dictate/studio?") || r.startsWith("/dictate?")) {
    // S16: the Studio is a MODE of the workspace now, not a screen of its own.
    // Old links (patient cards, notifications, bookmarks) keep working — their
    // params carry straight over.
    view = <RouteRedirect to={studioRedirect("dictate", routeQuery)} navigate={navigate} />;
  } else if (r === "/dictate/conversation" || r.startsWith("/dictate/conversation?")) {
    // Conversation mode kept its own component — it is a live two-voice
    // transcript, not a section editor — but no longer its own route: it is the
    // workspace's "scribe" mode, which is where the clinician looks for it.
    view = <RouteRedirect to={studioRedirect("scribe", routeQuery)} navigate={navigate} />;
  } else if (r === "/dictate/reports") {
    view = <RouteRedirect to={docPath("reports")} navigate={navigate} />;
  } else if (r.startsWith("/dictate/reports/")) {
    const id = r.split("/")[3];
    view = <ReportView id={id} lang={lang} navigate={navigate} />;
    crumbs = [{ label: "Scribe", path: "/scribe", onClick: () => navigate("/scribe") }, { label: tr(lang, "Звіти", "Reports"), path: docPath("reports"), onClick: () => navigate(docPath("reports")) }, { label: id }];
  } else if (r === "/dictate/templates") {
    view = <RouteRedirect to={libPath("reports")} navigate={navigate} />;
  }
  // ── studio workspace (S16) ─────────────────────────────────
  // One room for dictation, smart dictation, the recorded consultation and
  // uploaded audio. Everything it needs rides in the hash query, so a session
  // is a link: /studio?mode=smart&patient=…&report=…
  // The full work list, opened in its own browser tab from the sidebar. Its own
  // route (not a Studio mode) precisely because it is NOT a document: it is the
  // index of them, and it must be linkable and openable alongside one.
  else if (routePath === "/studio/history") {
    view = (
      <RequireClinical navigate={navigate}>
        <StudioHistoryPage lang={lang} navigate={navigate} />
      </RequireClinical>
    );
    crumbs = [
      { label: "Scribe", path: "/scribe", onClick: () => navigate("/scribe") },
      { label: tr(lang, "Студія", "Studio"), path: "/studio", onClick: () => navigate("/studio") },
      { label: tr(lang, "Історія", "History") },
    ];
  }
  else if (routePath === "/studio") {
    view = (
      <RequireClinical navigate={navigate}>
        <StudioWorkspace
          lang={lang}
          navigate={navigate}
          mode={routeQuery.get("mode") || undefined}
          patientId={routeQuery.get("patient") || undefined}
          encounterId={routeQuery.get("encounter") || undefined}
          templateId={routeQuery.get("template") || undefined}
          reportId={routeQuery.get("report") || undefined}
          sessionId={routeQuery.get("session") || undefined}
          jobId={routeQuery.get("job") || undefined}
          noteId={routeQuery.get("note") || undefined}
          tabId={routeQuery.get("t") || undefined}
          templatesMap={templatesMap}
          onAddTemplate={handleAddTemplate}
          templatesLoading={templatesReq.loading}
          templatesError={templatesReq.error}
          onRetryTemplates={templatesReq.reload}
          onToast={fireToast}
        />
      </RequireClinical>
    );
    showTopbar = false;
  }
  // ── evidence chat (embedded module, mock data only) ────────
  // Dev-only fake host for the module (§6 B-05). Checked BEFORE the module's
  // own base path, which would otherwise swallow /chat/harness as a route
  // belonging to the embed's scoped router. Never routed in a build.
  else if (r === "/chat/harness" && import.meta.env?.DEV) {
    view = <ChatEmbedHarness />;
    crumbs = [{ label: tr(lang, "Доказовий чат", "Evidence chat") }, { label: "Embed harness" }];
  }
  // Mounted, not imported screen by screen: the host hands it identity, theme,
  // locale and the URL, and owns navigation. Everything under the base path
  // belongs to the module's own scoped router.
  else if (chatModuleEnabled && (routePath === CHAT_BASE_PATH || routePath.startsWith(`${CHAT_BASE_PATH}/`))) {
    view = (
      <RequireClinical navigate={navigate}>
        <ChatHostRoute route={r} navigate={navigate} lang={lang} theme={tweaks.theme} onToast={fireToast} />
      </RequireClinical>
    );
    crumbs = [{ label: tr(lang, "Доказовий чат", "Evidence chat") }];
  }
  // ── asr (batch transcription) ──────────────────────────────
  else if (r === "/asr" || r === "/asr/jobs") {
    view = <RouteRedirect to={docPath("transcripts")} navigate={navigate} />;
  } else if (r === "/asr/new" || r.startsWith("/asr/new?")) {
    // Uploading audio is the workspace's "audio" mode — same form, but the
    // queued job lands next to the drafts it will become.
    view = <RouteRedirect to={studioRedirect("audio", routeQuery)} navigate={navigate} />;
  } else if (r.startsWith("/asr/jobs/")) {
    const jid = r.split("/")[3];
    view = (
      <RequireAuth navigate={navigate}>
        <AsrJobDetailPage id={jid} lang={lang} navigate={navigate} onToast={fireToast} />
      </RequireAuth>
    );
    crumbs = [
      { label: "Scribe", path: "/scribe", onClick: () => navigate("/scribe") },
      { label: tr(lang, "Транскрипції", "Transcriptions"), path: docPath("transcripts"), onClick: () => navigate(docPath("transcripts")) },
      { label: String(jid).slice(0, 8) + "…" },
    ];
  }
  // ── documents (reports + notes + transcriptions, one page) ─
  else if (r === "/documents" || r.startsWith("/documents/")) {
    view = (
      <RequireClinical navigate={navigate}>
        <DocumentsPage tab={docTabFromRoute(routePath)} navigate={navigate} lang={lang} />
      </RequireClinical>
    );
    crumbs = [
      { label: "Scribe", path: "/scribe", onClick: () => navigate("/scribe") },
      { label: tr(lang, "Документи", "Documents") },
    ];
  }
  // ── templates (report templates + note structures, one page) ─
  else if (r === "/library" || r.startsWith("/library/")) {
    view = (
      <RequireAuth navigate={navigate}>
        <TemplateLibraryPage tab={libTabFromRoute(routePath)} navigate={navigate} lang={lang} />
      </RequireAuth>
    );
    crumbs = [
      { label: "Scribe", path: "/scribe", onClick: () => navigate("/scribe") },
      { label: tr(lang, "Шаблони", "Templates") },
    ];
  }
  // ── settings ───────────────────────────────────────────────
  else if (r === "/settings") {
    view = <SettingsPage lang={lang} tweaks={tweaks} setTweak={setTweak} navigate={navigate} />;
    crumbs = [{ label: tr(lang, "Налаштування", "Settings") }];
  }
  // ── notifications (sprint 12) ──────────────────────────────
  else if (r === "/settings/notifications" || r === "/notifications") {
    view = <NotificationPreferencesPage lang={lang} navigate={navigate} />;
    crumbs = [
      { label: tr(lang, "Налаштування", "Settings"), path: "/settings", onClick: () => navigate("/settings") },
      { label: tr(lang, "Сповіщення", "Notifications") },
    ];
  }
  // ── business-owner dashboard (tenant_admin) ────────────────
  else if (r === "/dashboard") {
    view = (
      <RequireRole any={["tenant_admin"]} navigate={navigate}>
        <DashboardPage lang={lang} navigate={navigate} />
      </RequireRole>
    );
    crumbs = [{ label: tr(lang, "Панель", "Dashboard") }];
  }
  // ── Klarnote platform-owner console (vendor, not customer) ──
  // The staff door. Public like /login — it IS a login — and deliberately not
  // the clinic's: /company must never bounce our own team to the tenant sign-in.
  else if (r === "/company/login") {
    view = <CompanyLoginPage lang={lang} navigate={navigate} />;
    fullBleed = true;
  }
  // The console itself. No RequireAuth wrapper: that redirects to /login, which
  // is exactly the bounce we are avoiding. CompanyPage owns its own gate and
  // sends an unauthenticated visitor to /company/login instead — the backend is
  // still the authority on every byte it renders (see company/ownerAccess.js).
  // Full-bleed on purpose: a Klarnote staff console framed by a clinician's
  // sidebar ("New consultation", "Patients", "Notes") reads as a tenant screen,
  // which is the confusion the separate door exists to remove. The console
  // carries its own sign-out and its own way back to the clinical workspace.
  else if (r === "/company" || r.startsWith("/company/")) {
    const tab = r.split("/")[2] || "overview";
    view = <CompanyPage lang={lang} navigate={navigate} tab={tab} />;
    fullBleed = true;
  }
  // ── account / profile ──────────────────────────────────────
  else if (r === "/profile") {
    view = <RequireAuth navigate={navigate}><ProfilePage lang={lang} navigate={navigate} /></RequireAuth>;
    crumbs = [{ label: tr(lang, "Профіль", "Profile") }];
  }
  // ── account / identity (token inspector) ───────────────────
  else if (r === "/me") {
    view = <RequireAuth navigate={navigate}><MePage lang={lang} /></RequireAuth>;
    crumbs = [{ label: tr(lang, "Ідентичність", "Identity") }];
  }
  // ── admin ──────────────────────────────────────────────────
  else if (r === "/admin/privacy") {
    view = (
      <RequireRole any={["tenant_admin", "super_admin"]} navigate={navigate}>
        <PrivacyAdminPage lang={lang} navigate={navigate} />
      </RequireRole>
    );
    crumbs = [{ label: tr(lang, "Адмін", "Admin") }, { label: tr(lang, "Приватність", "Privacy") }];
  }
  else if (r === "/admin/users") {
    view = (
      <RequireRole any={["tenant_admin"]} navigate={navigate}>
        <AdminUsersPage lang={lang} onToast={fireToast} />
      </RequireRole>
    );
    crumbs = [{ label: tr(lang, "Адмін", "Admin") }, { label: tr(lang, "Користувачі", "Users") }];
  }
  // ── clinic / tenant ────────────────────────────────────────
  else if (r === "/tenant" || r === "/tenant/settings") {
    view = <RequireAuth navigate={navigate}><TenantSettingsPage lang={lang} onToast={fireToast} /></RequireAuth>;
    crumbs = [{ label: tr(lang, "Клініка", "Clinic") }, { label: tr(lang, "Налаштування", "Settings") }];
  } else if (r === "/tenant/members") {
    view = <RequireAuth navigate={navigate}><TenantMembersPage lang={lang} onToast={fireToast} /></RequireAuth>;
    crumbs = [{ label: tr(lang, "Клініка", "Clinic") }, { label: tr(lang, "Учасники", "Members") }];
  }
  // ── audit ──────────────────────────────────────────────────
  else if (routePath === "/audit/events") {
    view = (
      <RequireRole any={["auditor", "tenant_admin"]} navigate={navigate}>
        <AuditEventsPage lang={lang} initialFromSeq={routeQuery.get("from_seq") || ""} />
      </RequireRole>
    );
    crumbs = [{ label: tr(lang, "Комплаєнс", "Compliance") }, { label: tr(lang, "Події", "Events") }];
  } else if (r === "/audit/verify") {
    view = (
      <RequireRole any={["auditor", "tenant_admin"]} navigate={navigate}>
        <AuditVerifyPage lang={lang} navigate={navigate} />
      </RequireRole>
    );
    crumbs = [{ label: tr(lang, "Комплаєнс", "Compliance") }, { label: tr(lang, "Перевірка", "Verify") }];
  } else if (r === "/audit/phi-access") {
    // `phi_access.read` admits auditor + tenant_admin (src/auth/roles.js) — the
    // same pair the rest of /audit is gated on.
    view = (
      <RequireRole any={["auditor", "tenant_admin"]} navigate={navigate}>
        <PhiAccessLogPage lang={lang} />
      </RequireRole>
    );
    crumbs = [{ label: tr(lang, "Комплаєнс", "Compliance") }, { label: tr(lang, "Break-glass", "Break-glass") }];
  } else if (r === "/audit/access") {
    // `user.read` is granted to auditor server-side (libs/auth/perms.py) —
    // this is the read-only half of /admin/users, which stays tenant_admin.
    view = (
      <RequireRole any={["auditor", "tenant_admin"]} navigate={navigate}>
        <AccessReviewPage lang={lang} />
      </RequireRole>
    );
    crumbs = [{ label: tr(lang, "Комплаєнс", "Compliance") }, { label: tr(lang, "Огляд доступів", "Access review") }];
  } else if (r === "/audit/compliance") {
    view = (
      <RequireRole any={["auditor", "tenant_admin"]} navigate={navigate}>
        <CompliancePage lang={lang} navigate={navigate} />
      </RequireRole>
    );
    crumbs = [{ label: tr(lang, "Комплаєнс", "Compliance") }, { label: tr(lang, "Докази для аудиту", "Audit evidence") }];
  } else if (r === "/forbidden") {
    view = <ForbiddenPage navigate={navigate} lang={lang} />;
    showTopbar = false;
  }
  // ── Sprint 09: public signature verification (no auth) ─────────────
  else if (r.startsWith("/verify/")) {
    const envelopeId = r.split("/")[2];
    view = <VerifyPage envelopeId={envelopeId} lang={lang} />;
    showTopbar = false;
    fullBleed = true;
  }
  // ── 404 ────────────────────────────────────────────────────
  else {
    view = (
      <div className="page">
        <Empty icon="search" title={tr(lang, "Сторінку не знайдено", "Page not found")} body={r} action={<button className="btn" onClick={() => navigate("/")}>{tr(lang, "На головну", "Go home")}</button>} />
      </div>
    );
  }

  const tweaksPanel = (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Display" />
      <TweakRadio label="Theme" value={tweaks.theme}
        options={["light", "dark"]}
        onChange={(v) => setTweak("theme", v)} />
      <TweakRadio label="Density" value={tweaks.density}
        options={["comfortable", "compact"]}
        onChange={(v) => setTweak("density", v)} />
      <TweakRadio label="UI language" value={tweaks.lang}
        options={LANGS.map((l) => ({ value: l.code, label: l.label }))}
        onChange={(v) => setTweak("lang", v)} />
      <TweakColor label="Accent" value={tweaks.accent}
        options={["#0a8a7a", "#2563eb", "#7c3aed", "#0f172a", "#dc2626"]}
        onChange={(v) => setTweak("accent", v)} />
    </TweaksPanel>
  );

  // Full-bleed routes (login) skip the app chrome.
  if (fullBleed) {
    return (
      <I18nProvider lang={lang}>
        {view}
        {toast && <Toast message={toast.msg} action={toast.action} onAction={toast.onAction} onClose={() => setToast(null)} />}
      </I18nProvider>
    );
  }

  return (
    <I18nProvider lang={lang}>
      {/* Sprint 12. Mounted only on the authenticated shell: the socket
          needs a session, and the marketing/login shells (fullBleed,
          above) have no chrome to hang a bell off. */}
      <NotificationsProvider>
      <div className={`app${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
        <Sidebar
          route={route}
          navigate={navigate}
          lang={lang}
          setLang={(v) => setTweak("lang", v)}
          tweaks={tweaks}
          setTweak={setTweak}
          onNewSession={() => navigate("/scribe/consult/new")}
          onNewDictation={() => navigate("/dictate/studio")}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(c => !c)}
          onToast={fireToast}
        />
        <main className="app-main">
          {activeRecording && !r.startsWith("/scribe/consult/") && (
            <RecordingIndicator
              session={activeRecording}
              lang={lang}
              onPause={() => setActiveRecording(prev => prev ? { ...prev, paused: !prev.paused } : null)}
              onStop={() => setActiveRecording(null)}
              navigate={navigate}
            />
          )}
          {showTopbar && (
            <TopBar
              crumbs={crumbs}
              title={title}
              lang={lang}
              right={<NotificationBell lang={lang} navigate={navigate} />}
            />
          )}
          {view}
          {toast && <Toast message={toast.msg} action={toast.action} onAction={toast.onAction} onClose={() => setToast(null)} />}
          {/* Rendered irrespective of showTopbar: focused routes (Studio,
              note editor, consult) hide the chrome and therefore the
              bell, but a signing failure still has to reach the user. */}
          <NotificationToasts lang={lang} navigate={navigate} />
          {tweaksPanel}
        </main>
        {quickNoteOpen && (
          <QuickNoteModal
            lang={lang}
            navigate={navigate}
            onClose={() => setQuickNoteOpen(false)}
          />
        )}
      </div>
      </NotificationsProvider>
    </I18nProvider>
  );
}

export default App;
