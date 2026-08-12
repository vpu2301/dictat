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
  // A click-to-jump pins the highlight briefly: the smooth scroll fires many
  // observer callbacks on the way, and the last one would otherwise land on
  // whichever section is topmost mid-flight rather than the one asked for.
  const pinnedUntil = React.useRef(0);
  React.useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean);
    if (!els.length) return undefined;
    const obs = new IntersectionObserver(
      (entries) => {
        if (Date.now() < pinnedUntil.current) return;
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
  return [active, setActive, pinnedUntil];
}

// ── Layout primitives ─────────────────────────────────────────────────────────
// `action` renders on the right of the header (an Edit button, a badge…);
// `className` lets a page tint one section (e.g. the profile danger zone).
export function Section({ id, icon, title, action, className, children }) {
  return (
    <section id={id} className={"card settings-card settings-section" + (className ? " " + className : "")}>
      <header className="settings-card-h">
        <Icon name={icon} size={14} />
        <h2>{title}</h2>
        {action && <div className="settings-card-h-action">{action}</div>}
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
/**
 * `initial` deep-links a section: /settings?s=account scrolls straight to
 * "Account & security" instead of dropping the reader at the top of a page
 * whose seventh card is the one they asked for. Runs once, and only for an
 * id this page actually has — a stale link scrolls nowhere rather than
 * throwing.
 */
export function useSettingsSections(sections, initial) {
  const ids = sections.map((s) => s.id);
  const [active, setActive, pinnedUntil] = useScrollSpy(ids);
  const jumped = React.useRef(false);
  const jump = (id) => {
    // Hold the highlight for the length of the smooth scroll. Matters most for
    // the last section, which can never become the topmost intersecting one.
    pinnedUntil.current = Date.now() + 900;
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  React.useEffect(() => {
    if (jumped.current || !initial || !ids.includes(initial)) return;
    // The sections mount with the page; one frame is enough for the target to
    // have a position to scroll to.
    const t = setTimeout(() => {
      jumped.current = true;
      jump(initial);
    }, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, ids.join(",")]);

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
