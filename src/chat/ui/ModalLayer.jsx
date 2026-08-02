// chat/ui/ModalLayer.jsx — where a dialog is allowed to render.
//
// Two modes, and the host picks:
//
//  · "panel" (default) — the dialog renders in place and its scrim dims the
//    module only. This is what an embedded module must do when it does not own
//    the page: covering a host's chrome from inside a panel is the rudest
//    thing a widget can do (§5).
//  · "page" — the host says it owns the whole content area and wants its own
//    modal behaviour: the dialog goes through a portal to <body> and the scrim
//    is fixed to the viewport, exactly like every other modal in the platform.
//
// The portal re-creates `.ec-root` around the content so the module's scoped
// styles and its theme tokens still apply outside its own subtree — a portal
// that leaves the styles behind renders an unstyled dialog.
//
// A portal is required rather than just `position: fixed`: `.ec-root` declares
// `container-type`, which establishes a containing block, so a fixed descendant
// would anchor to the module box and not to the viewport.

import React from "react";
import { createPortal } from "react-dom";

export function ModalLayer({ mode = "panel", theme = "light", styleVars, children }) {
  if (mode !== "page" || typeof document === "undefined") return children;

  return createPortal(
    <div className="ec-root ec-root-portal" data-ec-theme={theme} data-modal-host="page" style={styleVars}>
      {children}
    </div>,
    document.body,
  );
}
