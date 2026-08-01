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
  items = [],            // [{ key, label, icon, onSelect, disabled, busy, danger, hint }]
  variant = "primary",   // matches .btn modifiers: primary | accent | ghost | ""
  menuLabel,             // aria-label for the caret
  align = "end",         // menu edge alignment: end | start
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
            <div className={"spec-menu split-btn-menu " + align} role="menu">
              {visible.map(it => (
                <button
                  key={it.key}
                  type="button"
                  role="menuitem"
                  className={"spec-menu-item" + (it.danger ? " danger" : "")}
                  disabled={it.disabled || it.busy}
                  onClick={() => { setOpen(false); it.onSelect && it.onSelect(); }}
                >
                  <Icon name={it.busy ? "refresh" : (it.icon || "dot")} size={14}
                    className={it.busy ? "spin" : "muted"} />
                  <span className="split-btn-item">
                    <span>{it.label}</span>
                    {it.hint && <span className="split-btn-hint">{it.hint}</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
