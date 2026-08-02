// chat/ui/Icon.jsx — the module's own glyphs.
//
// The host's Icon lives in components/UI.jsx alongside the Sidebar and TopBar,
// i.e. inside shell code the feature screens may not import (§9). A handful of
// inline paths is cheaper than the coupling, and it keeps the module droppable
// into a host that has no icon set at all.

import React from "react";

const PATHS = {
  send: <path d="M4 12 21 4l-7 17-2.5-7.5L4 12z" />,
  arrowUp: <path d="M12 20V5M6 11l6-6 6 6" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
  refresh: <><path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></>,
  sparkle: <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  users: <><circle cx="9" cy="8" r="4" /><path d="M3 21a6 6 0 0 1 12 0M16 4a4 4 0 0 1 0 8M21 21a6 6 0 0 0-4-5.66" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  x: <path d="M6 6l12 12M6 18 18 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 13 4 4L19 7" />,
  chevRight: <path d="m9 6 6 6-6 6" />,
  chevDown: <path d="m6 9 6 6 6-6" />,
  chevUp: <path d="m6 15 6-6 6 6" />,
  arrowLeft: <path d="m12 19-7-7 7-7M19 12H5" />,
  clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" /><path d="M12 7v5l3 3" /></>,
  sliders: <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />,
  alert: <><path d="M12 3 2 20h20L12 3z" /><path d="M12 10v4M12 17h.01" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  book: <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />,
  flask: <><path d="M9 3h6M10 3v6L4.5 18A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-3L14 9V3" /><path d="M7.5 15h9" /></>,
  layers: <path d="m12 2-10 5 10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />,
  eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" /><circle cx="12" cy="12" r="3" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></>,
  message: <path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" />,
  pill: <><rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)" /><path d="M8.8 8.8 15.2 15.2" /></>,
  activity: <path d="M3 12h4l3 8 4-16 3 8h4" />,
  trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></>,
  fileText: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" /></>,
  copy: <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  patient: <><circle cx="12" cy="7" r="3.2" /><path d="M5 21a7 7 0 0 1 14 0" /><path d="M12 12.5v3M10.5 14h3" /></>,
};

export function Icon({ name, size = 16, ...rest }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round"
      data-icon={name} aria-hidden="true" focusable="false"
      {...rest}
    >
      {PATHS[name] || <circle cx="12" cy="12" r="8" />}
    </svg>
  );
}
