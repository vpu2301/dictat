// chat/EmbedHarness.jsx — dev-only fake host.
//
// Mounts the embed with fixture props and nothing else: no auth provider, no
// app sidebar, no router. If the module renders here, it renders anywhere — and
// if it ever starts needing something the host didn't pass, this page is where
// that breaks first.
//
// It mounts the module twice, because the two patient-context paths are
// genuinely different products:
//   1. no injected patient → the module offers its own import dialog;
//   2. host-injected patient → context is fixed for the session.
// The third switch delegates picking back to the host (`onRequestPatient`),
// which is what a real host with its own patient picker would do.
//
// Reachable at #/chat/harness while running `npm run dev`.

import React, { useState } from "react";
import { ChatEmbed } from "./ChatEmbed.jsx";
import { demoUser, demoWorkspace, demoPatients } from "./data/fixtures.js";
import { getMockConfig, setMockConfig } from "./data/mockClient.js";

const BASE = "/apps/evidence-chat";

export function EmbedHarness() {
  const [path, setPath] = useState(BASE);
  const [mode, setMode] = useState("light");
  const [locale, setLocale] = useState("en");
  const [delegate, setDelegate] = useState(false);
  const [events, setEvents] = useState([]);
  // The host's own picker: a promise the harness resolves when the "host UI"
  // below is used. This is the shape a real host implements.
  const [pending, setPending] = useState(null);
  // Demo switches used to live in the module's own settings screen. That screen
  // is gone — settings belong to the host's settings page now — and these never
  // belonged in a clinician's preferences anyway: "simulate API failure" is a
  // property of the FAKE BACKEND, so the fake host owns it.
  const [mock, setMock] = useState(getMockConfig);
  const flip = (patch) => { setMockConfig(patch); setMock(getMockConfig()); };

  const log = (e) => setEvents((prev) => [e, ...prev].slice(0, 10));

  const requestPatient = () => new Promise((resolve) => {
    setPending(() => (picked) => { setPending(null); resolve(picked); });
  });

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1>Evidence chat — embed harness</h1>
          <p className="sub">
            Dev-only fake host. Each panel below is the module, mounted with fixture props.
          </p>
        </div>
      </div>

      <div style={{
        display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
        padding: "10px 12px", marginBottom: 16,
        border: "1px dashed var(--line)", borderRadius: 10, background: "var(--surface-2)",
      }}>
        <strong style={{ fontSize: 12 }}>Host controls</strong>
        <button className="btn small" onClick={() => setMode(mode === "dark" ? "light" : "dark")}>
          theme.mode: {mode}
        </button>
        <button className="btn small" onClick={() => setLocale(locale === "uk" ? "en" : "uk")}>
          locale: {locale}
        </button>
        <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 12 }}>
          <input type="checkbox" checked={delegate} onChange={(e) => setDelegate(e.target.checked)} />
          <span>onRequestPatient (host owns the picker)</span>
        </label>
        <button className="btn small" onClick={() => setPath(BASE)}>reset path</button>
        <code style={{ fontSize: 12, color: "var(--muted)" }}>{path}</code>
      </div>

      {/* Mock backend controls — every loading, empty and error state in the
          module is reachable from here without editing code. */}
      <div style={{
        display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap",
        padding: "10px 12px", marginBottom: 16,
        border: "1px dashed var(--line)", borderRadius: 10, background: "var(--surface-2)",
      }}>
        <strong style={{ fontSize: 12 }}>Mock backend</strong>
        <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 12 }}>
          <input type="checkbox" checked={mock.fail} onChange={(e) => flip({ fail: e.target.checked })} />
          <span>simulate API failure</span>
        </label>
        <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 12 }}>
          <input type="checkbox" checked={mock.empty} onChange={(e) => flip({ empty: e.target.checked })} />
          <span>simulate empty data</span>
        </label>
        <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 12 }}>
          <span>latency</span>
          <input type="range" min="0" max="2000" step="50" value={mock.latencyMs}
                 onChange={(e) => flip({ latencyMs: Number(e.target.value) })} />
          <code style={{ fontSize: 11 }}>{mock.latencyMs}ms</code>
        </label>
        <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 12 }}>
          <span>stream</span>
          <input type="range" min="0" max="200" step="10" value={mock.chunkMs}
                 onChange={(e) => flip({ chunkMs: Number(e.target.value) })} />
          <code style={{ fontSize: 11 }}>{mock.chunkMs}ms</code>
        </label>
      </div>

      {/* The host's patient picker — deliberately outside the module. */}
      {pending && (
        <div style={{
          padding: 12, marginBottom: 16, borderRadius: 10,
          border: "1px solid var(--accent)", background: "var(--surface)",
        }}>
          <div style={{ fontSize: 12, marginBottom: 8 }}>
            <strong>Host picker</strong> — the module asked the host for a patient.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {demoPatients.map((p) => (
              <button key={p.id} className="btn small" onClick={() => pending(p)}>{p.name}</button>
            ))}
            <button className="btn small" onClick={() => pending(null)}>Cancel</button>
          </div>
        </div>
      )}

      <section style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 13, margin: "0 0 8px" }}>
          1 · Without injected patient {delegate ? "(host picker)" : "(in-module import)"}
        </h3>
        <div style={{ padding: 16, border: "1px solid var(--line)", borderRadius: 12, background: "var(--bg)" }}>
          <ChatEmbed
            user={demoUser}
            workspace={demoWorkspace}
            allowPatientImport
            basePath={BASE}
            path={path}
            theme={{ mode }}
            locale={locale}
            onNavigate={setPath}
            onEvent={log}
            onRequestPatient={delegate ? requestPatient : undefined}
          />
        </div>
      </section>

      <section style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 13, margin: "0 0 8px" }}>
          2 · With host-injected patient (opened from a patient chart)
        </h3>
        {/* No `path`/`onNavigate` here on purpose: this mount exercises the
            module's in-memory router, the mode a host that doesn't own the URL
            would use. */}
        <div style={{ maxWidth: 760, padding: 16, border: "1px solid var(--line)", borderRadius: 12, background: "var(--bg)" }}>
          <ChatEmbed
            user={demoUser}
            workspace={demoWorkspace}
            patient={demoPatients[0]}
            basePath={BASE}
            theme={{ mode }}
            locale={locale}
            onEvent={log}
          />
        </div>
      </section>

      <div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
          onEvent stream (last {events.length})
        </div>
        <pre style={{
          margin: 0, padding: 12, maxHeight: 180, overflow: "auto",
          background: "var(--surface-2)", borderRadius: 8, fontSize: 11.5,
        }}>
          {events.length ? events.map((e) => JSON.stringify(e)).join("\n") : "— interact with a module —"}
        </pre>
      </div>
    </div>
  );
}

export default EmbedHarness;
