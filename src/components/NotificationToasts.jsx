// NotificationToasts.jsx — transient toasts for warning/critical only.
//
// Separate from UI.jsx's <Toast>, which is a singleton driven by
// App.jsx's `fireToast`. This one is a capped STACK fed by the
// notification store, so a signing failure that arrives while a
// "Saved" toast is up does not evict it.
//
// All three severities toast, at three different weights: info clears
// itself in a few seconds and is styled quietly, warning lingers,
// critical stays until acknowledged. Info earns its place because the
// bell is hidden on the focused routes (Studio, note editor, consult) —
// without a toast, finishing a dictation produces no visible reaction at
// all.
//
// The whole stack sits in an aria-live region so a screen-reader user
// hears an arrival without the focus being stolen.

import React, { useCallback, useEffect } from "react";

import { Icon } from "./UI.jsx";
import { tr } from "../i18n.js";
import { SEVERITY } from "../notifications/constants.js";
import { resolveRoute } from "../notifications/deepLink.js";
import { useNotifications } from "../notifications/store.jsx";

const AUTO_DISMISS_MS = 8000;
// Info is an FYI — long enough to read and click through, short enough
// that a busy clinic session does not accumulate a wall of them.
const INFO_DISMISS_MS = 5000;

// Critical toasts do NOT auto-dismiss: a chain-integrity failure needs
// an explicit acknowledgement, not a four-second window the user may
// not be looking at.
function dismissDelay(severity) {
  if (severity === SEVERITY.CRITICAL) return null;
  if (severity === SEVERITY.INFO) return INFO_DISMISS_MS;
  return AUTO_DISMISS_MS;
}

// No `flag` on an FYI — the warning glyph on a routine "dictation
// completed" is the visual equivalent of crying wolf.
function severityIcon(severity) {
  if (severity === SEVERITY.CRITICAL) return "shield";
  if (severity === SEVERITY.INFO) return "check";
  return "flag";
}

function ToastRow({ item, lang, navigate, onDismiss, onOpen }) {
  useEffect(() => {
    const delay = dismissDelay(item.severity);
    if (!delay) return undefined;
    const id = setTimeout(() => onDismiss(item.id), delay);
    return () => clearTimeout(id);
  }, [item.id, item.severity, onDismiss]);

  const canOpen = !!resolveRoute(item);

  return (
    <div className={`nt-toast sev-${item.severity}`} role="alert">
      <span className="nt-sev" aria-hidden="true">
        <Icon name={severityIcon(item.severity)} size={14} />
      </span>
      <span className="nt-body">
        <span className="nt-title">{item.title}</span>
        {item.body_text && <span className="nt-text">{item.body_text}</span>}
      </span>
      {canOpen && (
        <button type="button" className="nt-action" onClick={() => onOpen(item)}>
          {tr(lang, "Відкрити", "Open")}
        </button>
      )}
      <button
        type="button"
        className="nt-close"
        onClick={() => onDismiss(item.id)}
        aria-label={tr(lang, "Закрити", "Dismiss")}
      >
        <Icon name="x" size={12} />
      </button>
    </div>
  );
}

export function NotificationToasts({ lang = "uk", navigate }) {
  const n = useNotifications();

  const onOpen = useCallback(
    (item) => {
      n.markRead(item.id);
      const route = resolveRoute(item);
      if (route && navigate) navigate(route);
      n.dismissToast(item.id);
    },
    [n, navigate],
  );

  const onDismiss = useCallback((id) => n.dismissToast(id), [n]);

  if (!n || !n.enabled) return null;
  const { visible, overflow } = n.toastView;
  if (!visible.length) return null;

  return (
    // polite, not assertive: these are important but not an emergency,
    // and assertive would cut across whatever the user is dictating.
    <div className="nt-stack" aria-live="polite" aria-relevant="additions">
      {overflow > 0 && (
        <div className="nt-toast nt-overflow" role="status">
          <span className="nt-body">
            <span className="nt-title">
              {tr(lang, `Ще ${overflow} сповіщень`, `${overflow} more notifications`)}
            </span>
          </span>
          <button type="button" className="nt-action" onClick={() => n.dismissAllToasts()}>
            {tr(lang, "Очистити", "Clear")}
          </button>
        </div>
      )}
      {visible.map((item) => (
        <ToastRow
          key={item.id}
          item={item}
          lang={lang}
          navigate={navigate}
          onDismiss={onDismiss}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
