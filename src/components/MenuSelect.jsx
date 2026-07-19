// MenuSelect.jsx — platform dropdown that looks like a form field but opens the
// shared `.spec-menu` (same design as the Reports/Templates filters): a
// bordered trigger showing the current choice + a menu of check-marked options.
//
// options: [{ value, label, sub? }]. `block` makes it full-width; the menu
// spans the trigger. Use in place of a native <select> for design consistency.
import React, { useState, useEffect, useRef } from "react";
import { Icon } from "./UI.jsx";

export function MenuSelect({
  value, options, onChange, placeholder, icon, disabled, block, ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={"menu-select" + (block ? " block" : "")}>
      <button
        type="button"
        className={"menu-select-trigger" + (open ? " open" : "")}
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        {icon && <Icon name={icon} size={14} className="muted" />}
        <span className="menu-select-value">{selected ? selected.label : placeholder}</span>
        <Icon name="chevDown" size={14} className={"muted chev" + (open ? " up" : "")} />
      </button>
      {open && (
        <div className="spec-menu" role="listbox">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={value === o.value}
              className={"spec-menu-item" + (value === o.value ? " on" : "")}
              onClick={() => { onChange(o.value); setOpen(false); }}
            >
              <span className="menu-select-opt">
                <span>{o.label}</span>
                {o.sub && <span className="menu-select-sub">{o.sub}</span>}
              </span>
              {value === o.value && <Icon name="check" size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
