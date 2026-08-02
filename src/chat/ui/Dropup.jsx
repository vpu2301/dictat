// chat/ui/Dropup.jsx — a menu that opens UPWARD from a control in the ask box.
//
// Upward because the ask box is docked at the bottom of the panel: a dropdown
// would open into the host's page or off the module entirely. Absolute, not
// fixed — it belongs to the module's box like every other layer here (§5).
//
// The trigger IS the state, and it only spends width when it has something to
// say. Idle it is an icon (the name is in the tooltip and the accessible
// name); once something is attached the pill opens up and shows it — "Context"
// becomes the patient's name — instead of a chip appearing beside a button that
// still says "Context". One control, one place to look, and the tool row stays
// quiet until it is carrying something.
//
// `onClear` turns the pill into two buttons inside one shape (a nested button
// would be invalid HTML): the label opens the menu, the × detaches.

import React, { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon.jsx";

export function Dropup({
  label, icon, title, children, align = "left",
  activeLabel, activeTitle, onClear, badge,
}) {
  const [open, setOpen] = useState(false);
  // Where it actually fits. The module is a panel, not a page: a menu tall
  // enough to escape the panel's top edge would render over the host's chrome,
  // so it is measured against `.ec-root` and flipped or clipped to stay inside.
  const [placement, setPlacement] = useState({ side: "up", maxHeight: 340 });
  const wrapRef = useRef(null);

  const place = () => {
    const el = wrapRef.current;
    const root = el?.closest(".ec-root");
    if (!el || !root) return;
    const trigger = el.getBoundingClientRect();
    const box = root.getBoundingClientRect();
    const above = trigger.top - box.top - 12;
    const below = box.bottom - trigger.bottom - 12;
    setPlacement(above >= 180 || above >= below
      ? { side: "up", maxHeight: Math.max(140, Math.min(340, above)) }
      : { side: "down", maxHeight: Math.max(140, Math.min(340, below)) });
  };

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = !!activeLabel;

  return (
    <div className="ec-dropup" ref={wrapRef}>
      <div className={`ec-tool${active ? " on" : ""}${open ? " open" : ""}`}>
        <button
          type="button"
          className="ec-tool-main"
          onClick={() => { if (!open) place(); setOpen((v) => !v); }}
          aria-haspopup="menu"
          aria-expanded={open}
          title={active ? (activeTitle || activeLabel) : (title || label)}
          aria-label={active ? `${label}: ${activeLabel}` : label}
        >
          <Icon name={icon} size={15} />
          {active && <span className="ec-tool-label">{activeLabel}</span>}
          {badge && <span className="ec-tool-badge">{badge}</span>}
          {/* The chevron only earns its width while the menu is open. An
              active pill already reads as interactive — it has a name and a ×. */}
          {open && <Icon name="chevDown" size={11} />}
        </button>
        {active && onClear && (
          <button type="button" className="ec-tool-x" onClick={onClear} aria-label={`${activeLabel} — ✕`}>
            <Icon name="x" size={11} />
          </button>
        )}
      </div>

      {open && (
        <div
          className={`ec-dropup-menu ec-dropup-${align}`}
          data-side={placement.side}
          style={{ maxHeight: placement.maxHeight }}
          role="menu"
        >
          {typeof children === "function" ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}

export function DropupItem({ icon, label, hint, onClick, disabled, badge }) {
  return (
    <button type="button" className="ec-dropup-item" role="menuitem" onClick={onClick} disabled={disabled}>
      {icon && <Icon name={icon} size={14} />}
      <span className="ec-dropup-item-body">
        <span>{label}</span>
        {hint && <span className="ec-dropup-item-hint">{hint}</span>}
      </span>
      {badge && <span className="ec-pill">{badge}</span>}
    </button>
  );
}

export const DropupLabel = ({ children }) => <div className="ec-dropup-label">{children}</div>;
export const DropupSep = () => <div className="ec-dropup-sep" role="separator" />;
