// FilterDropdown.jsx — shared platform-styled <select> replacement.
//
// The closed control matches select.ti, the open menu follows the shared
// dropdown pattern (tpl-dropdown / row-actions-menu) instead of the OS popup.
// Extracted from TemplatesPage so every screen's toolbar dropdowns share one
// design (styles: .filter-dd* in sprints-06-10.css).

import React, { useState, useEffect, useRef } from "react";
import { Icon } from "./UI.jsx";

export function FilterDropdown({ value, options, onChange, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const current = options.find((o) => o.value === value) || options[0];
  return (
    <div className="filter-dd" ref={ref}>
      <button
        type="button"
        className={"filter-dd-btn" + (open ? " open" : "")}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{current?.label}</span>
        <Icon name="chevDown" size={12} className={"chev" + (open ? " up" : "")} />
      </button>
      {open && (
        <div className="filter-dd-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              className={"filter-dd-opt" + (o.value === value ? " active" : "")}
              onClick={() => { onChange(o.value); setOpen(false); }}
            >
              <span>{o.label}</span>
              {o.value === value && <Icon name="check" size={13} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
