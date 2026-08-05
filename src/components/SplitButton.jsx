// SplitButton.jsx — one primary action plus a caret that opens its alternates,
// joined as a single control. Use it where a footer would otherwise line up
// three or four competing buttons: the main path stays obvious, the rest move
// one click away, and the row stops reflowing every time a label changes.
//
// Busy state keeps the SAME label and only swaps the icon for a spinner —
// "Finalize" → "Finalizing…" changes the button's width, which shoves every
// neighbouring button sideways mid-click.
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "./UI.jsx";

export function SplitButton({
  label, icon, onClick, busy, busyLabel, disabled,
  // [{ key, label, icon, onSelect, disabled, busy, danger, hint, active }]
  // `active` marks the option the app is already on. It stays clickable and
  // fully legible with a check on the right — dimming it to 50% (which is what
  // `disabled` does) reads as "this option is unavailable", not "you are here".
  items = [],
  variant = "primary",   // matches .btn modifiers: primary | accent | ghost | ""
  menuLabel,             // aria-label for the caret
  align = "end",         // menu edge alignment: end | start
  // Which way the menu opens. "up" is the default because this control was
  // born in page footers, where there is no room below. A split button in a
  // HEADER has the opposite problem: opening up puts the menu off the top of
  // the window, which reads as "the caret does nothing".
  placement = "up",      // up | down
  // Extra attributes for the PRIMARY half. The Studio workspace's record
  // control is a split button whose main half is the microphone — it needs to
  // carry the recorder's state (data-state) the way the old MicCard did.
  mainProps = {},
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const mainRef = useRef(null);
  const [pinned, setPinned] = useState(null);

  // Pin the idle width before swapping in a busy label. `busyLabel` exists so a
  // menu action doesn't spin next to the PRIMARY action's wording ("signing…"
  // when the user chose "finalize") — but a different label means a different
  // width, which is the shove this control set out to remove.
  useLayoutEffect(() => {
    if (busy || !mainRef.current) return;
    const w = mainRef.current.getBoundingClientRect().width;
    if (w) setPinned(w);
  }, [busy, label]);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const visible = items.filter(Boolean);
  const cls = "btn" + (variant ? ` ${variant}` : "");

  return (
    <div className={"split-btn" + (open ? " open" : "")} ref={ref}>
      <button
        ref={mainRef}
        type="button"
        {...mainProps}
        className={cls + " split-btn-main"}
        onClick={onClick}
        disabled={disabled || busy}
        aria-busy={busy || undefined}
        style={busy && pinned ? { minWidth: pinned } : undefined}
      >
        <Icon name={busy ? "refresh" : icon} size={13} className={busy ? "spin" : undefined} />
        {busy ? (busyLabel || label) : label}
      </button>

      {visible.length > 0 && (
        <>
          <button
            type="button"
            className={cls + " split-btn-caret"}
            onClick={() => setOpen(o => !o)}
            disabled={disabled || busy}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label={menuLabel}
          >
            <Icon name="chevDown" size={13} className={open ? "chev up" : "chev"} />
          </button>

          {open && (
            <div className={`spec-menu split-btn-menu ${align} ${placement}`} role="menu">
              {visible.map(it => (
                <button
                  key={it.key}
                  type="button"
                  role="menuitem"
                  aria-current={it.active ? "true" : undefined}
                  className={"spec-menu-item" + (it.danger ? " danger" : "") + (it.active ? " on" : "")}
                  disabled={it.disabled || it.busy}
                  onClick={() => { setOpen(false); it.onSelect && it.onSelect(); }}
                >
                  <Icon name={it.busy ? "refresh" : (it.icon || "dot")} size={16}
                    className={it.busy ? "spin" : undefined} />
                  <span className="split-btn-item">
                    <span>{it.label}</span>
                    {it.hint && <span className="split-btn-hint">{it.hint}</span>}
                  </span>
                  {it.active && <Icon name="check" size={14} className="split-btn-check" />}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
