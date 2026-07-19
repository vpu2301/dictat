// App.jsx — App shell, hash router, Tweaks
import React, { useState, useEffect, useMemo } from 'react';
import { I18nProvider, LANGS , tr } from "./i18n.js";
import {
  useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakColor, TweakSelect, TweakToggle,
} from './components/TweaksPanel.jsx';
import { Icon, TopBar, Toast, Empty } from './components/UI.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { DictationStudio } from './components/Studio.jsx';
import { DictateToday } from './components/DictateHome.jsx';
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
import { AdminUsersPage } from './pages/AdminUsersPage.jsx';
import { TenantSettingsPage } from './pages/TenantSettingsPage.jsx';
import { TenantMembersPage } from './pages/TenantMembersPage.jsx';
import { AuditEventsPage } from './pages/AuditEventsPage.jsx';
import { AuditVerifyPage } from './pages/AuditVerifyPage.jsx';
import { ForbiddenPage } from './pages/ForbiddenPage.jsx';
import { SettingsPage } from './pages/SettingsPage.jsx';
import { AsrSubmitPage } from './pages/AsrSubmitPage.jsx';
import { AsrJobsListPage } from './pages/AsrJobsListPage.jsx';
import { AsrJobDetailPage } from './pages/AsrJobDetailPage.jsx';
import { RequireAuth, RequireRole } from './auth/RequireRole.jsx';
import { useAuth, hasAnyRole } from './auth/AuthContext.jsx';

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "lang": "uk",
  "density": "comfortable",
  "accent": "#0a8a7a"
}/*EDITMODE-END*/;

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = useState(() => location.hash.replace(/^#/, "") || "/");
  const [toast, setToast] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);
  const [activeRecording, setActiveRecording] = useState(null);
  const lang = tweaks.lang;
  const { state: auth } = useAuth();

  // Quick note hotkey
  useQuickNoteHotkey(() => setQuickNoteOpen(true));

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
  const isPublicRoute = isAuthRoute || isLanding || isMarketing || route.startsWith("/verify/");
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

  // Theme + density + accent + document language
  useEffect(() => {
    document.documentElement.dataset.theme = tweaks.theme;
    document.documentElement.dataset.density = tweaks.density;
    document.documentElement.style.setProperty("--accent", tweaks.accent);
    document.documentElement.lang = tweaks.lang;
  }, [tweaks.theme, tweaks.density, tweaks.accent, tweaks.lang]);

  // Keyboard: N → new consultation in scribe; D → studio
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.matches("input, textarea, [contenteditable]")) return;
      if (e.key === "n" && !e.metaKey && !e.ctrlKey) { e.preventDefault(); navigate("/scribe/consult/new"); }
      if (e.key === "d" && !e.metaKey && !e.ctrlKey) { e.preventDefault(); navigate("/dictate/studio"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Parse route → view
  let view;
  let crumbs = null;
  let showTopbar = true;
  let title = "";
  let fullBleed = false; // /login uses no sidebar

  const r = route;

  // ── auth gate (render the right view synchronously to avoid a flash) ─
  if (gateToLogin) {
    view = <LoginPage navigate={navigate} lang={lang} />;
    fullBleed = true;
  } else if (gateToHome) {
    view = <ScribeToday navigate={navigate} lang={lang} />;
    title = tr(lang, "Сьогодні", "Today");
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
    view = <ScribeToday navigate={navigate} lang={lang} />;
    title = tr(lang, "Сьогодні", "Today");
  } else if (r === "/scribe/patients" || r === "/patients") {
    // /patients is the sprint-11 canonical alias; both render the directory.
    view = <PatientDirectory navigate={navigate} lang={lang} />;
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
    view = <EnhancedScribePatient id={id} navigate={navigate} lang={lang} />;
    crumbs = [
      { label: "Scribe", path: "/scribe", onClick: () => navigate("/scribe") },
      { label: tr(lang, "Пацієнти", "Patients"), path: "/scribe/patients", onClick: () => navigate("/scribe/patients") },
      { label: id },
    ];
  } else if (r.startsWith("/scribe/notes/new") || r === "/scribe/notes/new") {
    const m = r.match(/patient=([\w-]+)/);
    view = <NoteEditorPage patientId={m?.[1]} lang={lang} navigate={navigate} />;
    showTopbar = false;
  } else if (r.startsWith("/scribe/notes/") && r.split("/").length >= 4 && r.split("/")[3] !== "new") {
    const noteId = r.split("/")[3];
    view = <NoteEditorPage noteId={noteId} lang={lang} navigate={navigate} />;
    showTopbar = false;
  } else if (r.startsWith("/scribe/review/")) {
    const sessionId = r.split("/")[3];
    view = <NoteReviewPage sessionId={sessionId} lang={lang} navigate={navigate} />;
    showTopbar = false;
  } else if (r.startsWith("/scribe/consent/new") || r === "/scribe/consent/new") {
    const m = r.match(/patient=([\w-]+)/);
    view = <ConsentScreen patientId={m?.[1]} lang={lang} navigate={navigate} />;
    showTopbar = false;
  } else if (r === "/scribe/consult/new" || r.startsWith("/scribe/consult/")) {
    const m = r.match(/patient=([\w-]+)/);
    const idMatch = r.match(/^\/scribe\/consult\/([^?]+)/);
    view = <ScribeConsult id={idMatch?.[1]} patientHint={m?.[1]} navigate={navigate} lang={lang} onRecordingChange={setActiveRecording} />;
    showTopbar = false;
  } else if (r === "/scribe/notes") {
    view = <ScribeNotes navigate={navigate} lang={lang} />;
    crumbs = [{ label: "Scribe", path: "/scribe", onClick: () => navigate("/scribe") }, { label: tr(lang, "Нотатки", "Notes") }];
  } else if (r === "/scribe/templates") {
    view = <ScribeNoteStructures lang={lang} />;
    crumbs = [{ label: "Scribe", path: "/scribe", onClick: () => navigate("/scribe") }, { label: tr(lang, "Шаблони", "Templates") }];
  }
  // ── dictate ────────────────────────────────────────────────
  // /dictate is the product landing (overview); the recording Studio lives at
  // /dictate/studio so switching products doesn't drop straight into recording.
  else if (r === "/dictate" || r === "/dictate/") {
    view = <DictateToday lang={lang} navigate={navigate} />;
    title = tr(lang, "Диктування", "Dictation");
  } else if (r === "/dictate/studio" || r.startsWith("/dictate/studio?") || r.startsWith("/dictate?")) {
    const pm = r.match(/patient=([\w-]+)/);
    const tm = r.match(/template=([\w-]+)/);
    const rm = r.match(/report=([\w-]+)/);
    const em = r.match(/encounter=([\w-]+)/);
    view = <DictationStudio lang={lang} patientId={pm?.[1]} encounterId={em?.[1]} initialTemplateId={tm?.[1]} reportId={rm?.[1]}
             templatesMap={templatesMap} onAddTemplate={handleAddTemplate}
             templatesLoading={templatesReq.loading} templatesError={templatesReq.error}
             onRetryTemplates={templatesReq.reload} />;
    showTopbar = false;
  } else if (r === "/dictate/reports") {
    view = <ReportsList lang={lang} navigate={navigate} />;
    crumbs = [{ label: "Dictate", path: "/dictate", onClick: () => navigate("/dictate") }, { label: tr(lang, "Звіти", "Reports") }];
  } else if (r.startsWith("/dictate/reports/")) {
    const id = r.split("/")[3];
    view = <ReportView id={id} lang={lang} navigate={navigate} />;
    crumbs = [{ label: "Dictate", path: "/dictate", onClick: () => navigate("/dictate") }, { label: tr(lang, "Звіти", "Reports"), path: "/dictate/reports", onClick: () => navigate("/dictate/reports") }, { label: id }];
  } else if (r === "/dictate/templates") {
    view = <TemplatesPage lang={lang} navigate={navigate} />;
    crumbs = [{ label: "Dictate", path: "/dictate", onClick: () => navigate("/dictate") }, { label: tr(lang, "Шаблони", "Templates") }];
  }
  // ── asr (batch transcription) ──────────────────────────────
  else if (r === "/asr" || r === "/asr/jobs") {
    view = (
      <RequireAuth navigate={navigate}>
        <AsrJobsListPage lang={lang} navigate={navigate} />
      </RequireAuth>
    );
    crumbs = [{ label: tr(lang, "Транскрипція", "Transcription") }, { label: tr(lang, "Завдання", "Jobs") }];
  } else if (r === "/asr/new") {
    view = (
      <RequireAuth navigate={navigate}>
        <AsrSubmitPage lang={lang} navigate={navigate} onToast={fireToast} />
      </RequireAuth>
    );
    crumbs = [
      { label: tr(lang, "Транскрипція", "Transcription"), path: "/asr/jobs", onClick: () => navigate("/asr/jobs") },
      { label: tr(lang, "Нове", "New") },
    ];
  } else if (r.startsWith("/asr/jobs/")) {
    const jid = r.split("/")[3];
    view = (
      <RequireAuth navigate={navigate}>
        <AsrJobDetailPage id={jid} lang={lang} navigate={navigate} onToast={fireToast} />
      </RequireAuth>
    );
    crumbs = [
      { label: tr(lang, "Транскрипція", "Transcription"), path: "/asr/jobs", onClick: () => navigate("/asr/jobs") },
      { label: tr(lang, "Завдання", "Jobs"), path: "/asr/jobs", onClick: () => navigate("/asr/jobs") },
      { label: String(jid).slice(0, 8) + "…" },
    ];
  }
  // ── settings ───────────────────────────────────────────────
  else if (r === "/settings") {
    view = <SettingsPage lang={lang} tweaks={tweaks} setTweak={setTweak} />;
    crumbs = [{ label: tr(lang, "Налаштування", "Settings") }];
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
  else if (r === "/audit/events") {
    view = (
      <RequireRole any={["auditor", "tenant_admin"]} navigate={navigate}>
        <AuditEventsPage lang={lang} />
      </RequireRole>
    );
    crumbs = [{ label: tr(lang, "Аудит", "Audit") }, { label: tr(lang, "Події", "Events") }];
  } else if (r === "/audit/verify") {
    view = (
      <RequireRole any={["auditor", "tenant_admin"]} navigate={navigate}>
        <AuditVerifyPage lang={lang} />
      </RequireRole>
    );
    crumbs = [{ label: tr(lang, "Аудит", "Audit") }, { label: tr(lang, "Перевірка", "Verify") }];
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
        <Empty icon="search" title={tr(lang, "Сторінку не знайдено", "Page not found")} body={r} action={<button className="btn" onClick={() => navigate("/scribe")}>{tr(lang, "На головну", "Go home")}</button>} />
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
          {showTopbar && <TopBar crumbs={crumbs} title={title} lang={lang} />}
          {view}
          {toast && <Toast message={toast.msg} action={toast.action} onAction={toast.onAction} onClose={() => setToast(null)} />}
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
    </I18nProvider>
  );
}

export default App;
