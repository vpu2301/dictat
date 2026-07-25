// chipNav.js — Sprint 13 step 03: arrow-key navigation within a chip row.
// Every chip (and the grammar chips' internal buttons) is a native <button>,
// so Tab/Space/Enter work out of the box; arrows are an added convenience
// that moves focus between the row's buttons without touching selection —
// selection here is a medical-record write, so browsing must never select.
// (Deliberate deviation from the ARIA radio pattern's arrow-selects, noted
// in the renderers.)

export function chipRowKeyDown(e) {
  const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
  if (!dir) return;
  const row = e.currentTarget;
  const buttons = [...row.querySelectorAll("button:not(:disabled)")];
  if (!buttons.length) return;
  const idx = buttons.indexOf(document.activeElement);
  if (idx === -1) return;
  e.preventDefault();
  buttons[(idx + dir + buttons.length) % buttons.length].focus();
}
