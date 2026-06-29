// App.jsx — App shell, hash router, Tweaks
import React, { useState, useEffect, useMemo } from 'react';
import { I18nProvider } from './i18n.js';
import {
  useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakColor, TweakSelect, TweakToggle,
} from './components/TweaksPanel.jsx';
import { Icon, TopBar, Toast, Empty } from './components/UI.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { DictationStudio } from './components/Studio.jsx';
import { ReportsList, ReportView } from './components/Reports.jsx';
import { ScribeToday, ScribePatients, ScribeConsult, ScribeNotes } from './components/Scribe.jsx';
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
import { LoginPage } from './pages/LoginPage.jsx';
import { SignupPage } from './pages/SignupPage.jsx';
import { VerifyPage } from './pages/VerifyPage.jsx';
import { MfaPage } from './pages/MfaPage.jsx';
import { MePage } from './pages/MePage.jsx';
import { ProfilePage } from './pages/ProfilePage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { AdminUsersPage } from './pages/AdminUsersPage.jsx';
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
  const templatesReq = useAsync(() => listTemplates({ limit: 200 }), []);
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
  const MARKETING_EXACT = ["/about", "/contact", "/careers", "/blog", "/features", "/security"];
  const isMarketing = MARKETING_EXACT.includes(route)
    || route.startsWith("/legal/") || route.startsWith("/features/") || route.startsWith("/product/");
  const isPublicRoute = isAuthRoute || isLanding || isMarketing || route.startsWith("/verify/");
  const gateToLogin   = !auth && !isPublicRoute;   // protected route, no session → login
  const gateToHome    = !!auth && isAuthRoute;      // already signed in → leave the auth screens

  // Keep the URL hash in sync with the gate decision.
  useEffect(() => {
    if (gateToLogin) navigate("/login");
    else if (gateToHome) navigate("/");
  }, [gateToLogin, gateToHome]);

  // Tenant admins land on their dashboard. When an authenticated owner hits the
  // bare root (post-login or "Dictator" brand click), send them to #/dashboard.
  const isTenantAdmin = hasAnyRole(auth?.claims, ["tenant_admin"]);
  useEffect(() => {
    if (auth && isTenantAdmin && (route === "/" || route === "")) navigate("/dashboard");
  }, [auth, isTenantAdmin, route]);

  // Theme + density + accent
  useEffect(() => {
    document.documentElement.dataset.theme = tweaks.theme;
    document.documentElement.dataset.density = tweaks.density;
    document.documentElement.style.setProperty("--accent", tweaks.accent);
  }, [tweaks.theme, tweaks.density, tweaks.accent]);

  // Keyboard: N → new consultation in scribe; D → studio
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.matches("input, textarea, [contenteditable]")) return;
      if (e.key === "n" && !e.metaKey && !e.ctrlKey) { e.preventDefault(); navigate("/scribe/consult/new"); }
      if (e.key === "d" && !e.metaKey && !e.ctrlKey) { e.preventDefault(); navigate("/dictate"); }
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
    title = lang === "uk" ? "Сьогодні" : "Today";
  }
  // ── auth routes ────────────────────────────────────────────
  else if (r === "/login") {
    view = <LoginPage navigate={navigate} lang={lang} />;
    fullBleed = true;
  }
  // ── signup (request-access lead — admin-invite-only, doc 03 §4.1) ──
  else if (r === "/signup") {
    view = <SignupPage navigate={navigate} lang={lang} />;
    fullBleed = true;
  }
  // ── public landing (marketing) ─────────────────────────────
  else if (r === "/welcome" || ((r === "/" || r === "") && !auth)) {
    view = <LandingPage navigate={navigate} lang={lang} tweaks={tweaks} setTweak={setTweak} />;
    fullBleed = true;
  }
  // ── public marketing sub-pages (footer + features/products/security) ─
  else if (
    ["/about", "/contact", "/careers", "/blog", "/features", "/security"].includes(r)
    || r.startsWith("/legal/") || r.startsWith("/features/") || r.startsWith("/product/")
  ) {
    view = <ContentPage slug={r.replace(/^\//, "")} navigate={navigate} lang={lang} tweaks={tweaks} setTweak={setTweak} />;
    fullBleed = true;
  }
  // ── mfa scaffold (sprint 16; flag-off path today) ───────────
  else if (r === "/mfa") {
    view = <MfaPage lang={lang} />;
    crumbs = [{ label: lang === "uk" ? "Безпека" : "Security" }, { label: "MFA" }];
  }
  // ── scribe ─────────────────────────────────────────────────
  else if (r === "/scribe" || r === "/" || r === "") {
    view = <ScribeToday navigate={navigate} lang={lang} />;
    title = lang === "uk" ? "Сьогодні" : "Today";
  } else if (r === "/scribe/patients") {
    view = <ScribePatients navigate={navigate} lang={lang} />;
    crumbs = [{ label: "Scribe", path: "/scribe", onClick: () => navigate("/scribe") }, { label: lang === "uk" ? "Пацієнти" : "Patients" }];
  } else if (r.startsWith("/scribe/patients/")) {
    const id = r.split("/")[3];
    view = <EnhancedScribePatient id={id} navigate={navigate} lang={lang} />;
    crumbs = [
      { label: "Scribe", path: "/scribe", onClick: () => navigate("/scribe") },
      { label: lang === "uk" ? "Пацієнти" : "Patients", path: "/scribe/patients", onClick: () => navigate("/scribe/patients") },
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
    crumbs = [{ label: "Scribe", path: "/scribe", onClick: () => navigate("/scribe") }, { label: lang === "uk" ? "Нотатки" : "Notes" }];
  } else if (r === "/scribe/templates") {
    view = <ScribeNoteStructures lang={lang} />;
    crumbs = [{ label: "Scribe", path: "/scribe", onClick: () => navigate("/scribe") }, { label: lang === "uk" ? "Шаблони" : "Templates" }];
  }
  // ── dictate ────────────────────────────────────────────────
  else if (r === "/dictate" || r === "/dictate/") {
    view = <DictationStudio lang={lang}
             templatesMap={templatesMap} onAddTemplate={handleAddTemplate} />;
    showTopbar = false;
  } else if (r === "/dictate/reports") {
    view = <ReportsList lang={lang} navigate={navigate} />;
    crumbs = [{ label: "Dictate", path: "/dictate", onClick: () => navigate("/dictate") }, { label: lang === "uk" ? "Звіти" : "Reports" }];
  } else if (r.startsWith("/dictate/reports/")) {
    const id = r.split("/")[3];
    view = <ReportView id={id} lang={lang} navigate={navigate} />;
    crumbs = [{ label: "Dictate", path: "/dictate", onClick: () => navigate("/dictate") }, { label: lang === "uk" ? "Звіти" : "Reports", path: "/dictate/reports", onClick: () => navigate("/dictate/reports") }, { label: id }];
  } else if (r === "/dictate/templates") {
    view = <TemplatesPage lang={lang} navigate={navigate} />;
    crumbs = [{ label: "Dictate", path: "/dictate", onClick: () => navigate("/dictate") }, { label: lang === "uk" ? "Шаблони" : "Templates" }];
  }
  // ── asr (batch transcription) ──────────────────────────────
  else if (r === "/asr" || r === "/asr/jobs") {
    view = (
      <RequireAuth navigate={navigate}>
        <AsrJobsListPage lang={lang} navigate={navigate} />
      </RequireAuth>
    );
    crumbs = [{ label: lang === "uk" ? "Транскрипція" : "Transcription" }, { label: lang === "uk" ? "Завдання" : "Jobs" }];
  } else if (r === "/asr/new") {
    view = (
      <RequireAuth navigate={navigate}>
        <AsrSubmitPage lang={lang} navigate={navigate} onToast={fireToast} />
      </RequireAuth>
    );
    crumbs = [
      { label: lang === "uk" ? "Транскрипція" : "Transcription", path: "/asr/jobs", onClick: () => navigate("/asr/jobs") },
      { label: lang === "uk" ? "Нове" : "New" },
    ];
  } else if (r.startsWith("/asr/jobs/")) {
    const jid = r.split("/")[3];
    view = (
      <RequireAuth navigate={navigate}>
        <AsrJobDetailPage id={jid} lang={lang} navigate={navigate} onToast={fireToast} />
      </RequireAuth>
    );
    crumbs = [
      { label: lang === "uk" ? "Транскрипція" : "Transcription", path: "/asr/jobs", onClick: () => navigate("/asr/jobs") },
      { label: lang === "uk" ? "Завдання" : "Jobs", path: "/asr/jobs", onClick: () => navigate("/asr/jobs") },
      { label: String(jid).slice(0, 8) + "…" },
    ];
  }
  // ── settings ───────────────────────────────────────────────
  else if (r === "/settings") {
    view = <SettingsPage lang={lang} tweaks={tweaks} setTweak={setTweak} />;
    crumbs = [{ label: lang === "uk" ? "Налаштування" : "Settings" }];
  }
  // ── business-owner dashboard (tenant_admin) ────────────────
  else if (r === "/dashboard") {
    view = (
      <RequireRole any={["tenant_admin"]} navigate={navigate}>
        <DashboardPage lang={lang} navigate={navigate} />
      </RequireRole>
    );
    crumbs = [{ label: lang === "uk" ? "Панель" : "Dashboard" }];
  }
  // ── account / profile ──────────────────────────────────────
  else if (r === "/profile") {
    view = <RequireAuth navigate={navigate}><ProfilePage lang={lang} navigate={navigate} /></RequireAuth>;
    crumbs = [{ label: lang === "uk" ? "Профіль" : "Profile" }];
  }
  // ── account / identity (token inspector) ───────────────────
  else if (r === "/me") {
    view = <RequireAuth navigate={navigate}><MePage lang={lang} /></RequireAuth>;
    crumbs = [{ label: lang === "uk" ? "Ідентичність" : "Identity" }];
  }
  // ── admin ──────────────────────────────────────────────────
  else if (r === "/admin/users") {
    view = (
      <RequireRole any={["tenant_admin"]} navigate={navigate}>
        <AdminUsersPage lang={lang} onToast={fireToast} />
      </RequireRole>
    );
    crumbs = [{ label: lang === "uk" ? "Адмін" : "Admin" }, { label: lang === "uk" ? "Користувачі" : "Users" }];
  }
  // ── audit ──────────────────────────────────────────────────
  else if (r === "/audit/events") {
    view = (
      <RequireRole any={["auditor", "tenant_admin"]} navigate={navigate}>
        <AuditEventsPage lang={lang} />
      </RequireRole>
    );
    crumbs = [{ label: lang === "uk" ? "Аудит" : "Audit" }, { label: lang === "uk" ? "Події" : "Events" }];
  } else if (r === "/audit/verify") {
    view = (
      <RequireRole any={["auditor", "tenant_admin"]} navigate={navigate}>
        <AuditVerifyPage lang={lang} />
      </RequireRole>
    );
    crumbs = [{ label: lang === "uk" ? "Аудит" : "Audit" }, { label: lang === "uk" ? "Перевірка" : "Verify" }];
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
        <Empty icon="search" title={lang === "uk" ? "Сторінку не знайдено" : "Page not found"} body={r} action={<button className="btn" onClick={() => navigate("/scribe")}>{lang === "uk" ? "На головну" : "Go home"}</button>} />
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
        options={[{ value: "uk", label: "Українська" }, { value: "en", label: "English" }]}
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
          onNewDictation={() => navigate("/dictate")}
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
