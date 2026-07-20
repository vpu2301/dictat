// SettingsLayout.jsx — the shared chrome for /settings and its sub-pages.
//
// Extracted from SettingsPage so that the notification-preferences screen
// (/settings/notifications) renders as the same surface: sticky scroll-spy
// side menu on the left, stacked setting cards on the right.

import React from "react";
import { Icon } from "./UI.jsx";

// ── Scroll-spy: report which section is currently in view ─────────────────────
export function useScrollSpy(ids) {
  const [active, setActive] = React.useState(ids[0]);
  React.useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean);
    if (!els.length) return undefined;
    const obs = new IntersectionObserver(
      (entries) => {
        // The topmost section intersecting the upper band of the viewport wins.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      // Top inset clears the sticky topbar; bottom inset makes a section "active"
      // once its heading reaches roughly the top third of the viewport.
      { rootMargin: "-72px 0px -55% 0px", threshold: 0 },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [ids.join(",")]);
  return [active, setActive];
}

// ── Layout primitives ─────────────────────────────────────────────────────────
export function Section({ id, icon, title, children }) {
  return (
    <section id={id} className="card settings-card settings-section">
      <header className="settings-card-h">
        <Icon name={icon} size={14} />
        <h2>{title}</h2>
      </header>
      <div className="settings-card-body">{children}</div>
    </section>
  );
}

export function Row({ label, hint, children }) {
  return (
    <div className="settings-row">
      <div>
        <div className="settings-row-label">{label}</div>
        {hint && <div className="settings-row-hint">{hint}</div>}
      </div>
      <div className="settings-row-control">{children}</div>
    </div>
  );
}

/**
 * The sticky side menu. `sections` is [{id, icon, label}]; clicking scrolls the
 * matching section into view and pins the highlight there until the observer
 * catches up.
 */
export function SettingsNav({ sections, active, onJump, label }) {
  return (
    <nav className="settings-nav" aria-label={label}>
      {sections.map((s) => (
        <button
          key={s.id}
          className={"settings-nav-item" + (active === s.id ? " on" : "")}
          onClick={() => onJump(s.id)}
          aria-current={active === s.id ? "true" : undefined}
        >
          <Icon name={s.icon} size={14} />
          <span>{s.label}</span>
        </button>
      ))}
    </nav>
  );
}

/** Wire a section list to the scroll-spy + smooth-scroll jump behaviour. */
export function useSettingsSections(sections) {
  const ids = sections.map((s) => s.id);
  const [active, setActive] = useScrollSpy(ids);
  const jump = (id) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return { active, jump };
}

export function Toggle({ on, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!on}
      aria-label={label}
      disabled={disabled}
      className={"toggle" + (on ? " on" : "")}
      onClick={() => onChange(!on)}
    >
      <span />
    </button>
  );
}
