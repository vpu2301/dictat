// SourceListDrawer.jsx — where a citation goes when you click it (EVA-S04).
//
// Grouped corpus-first, because that is the authority precedence rule RR3
// encodes: a curated document outranks a page found on the web, and a list
// that interleaves them by relevance score hides that.
//
// This sprint's drawer is the BASIC list the spec asks for — every source,
// numbered, badged, with its quote when the citation carried one. Passage-level
// deep linking (scroll the document to the cited span) is S07's, when the
// passage viewer exists to link into.
//
// ── The dialog mechanics ──────────────────────────────────────────────────
// It is a labelled `role="dialog" aria-modal="true"` with a real focus trap
// and focus RESTORE, hand-rolled rather than reusing `<Modal>` from UI.jsx:
// Modal is a centred overlay that closes on backdrop click and traps nothing,
// which is fine for a confirm box and wrong for a panel a keyboard user is
// meant to read through. Under 900px it becomes a bottom sheet — same markup,
// same trap, different geometry (evidence.css).

import React, { useCallback, useEffect, useRef } from "react";
import { Icon } from "../../UI.jsx";
import { useI18n } from "../../../i18n.js";
import { EvidenceBadge } from "./EvidenceBadge.jsx";
import { WebSourceBadge } from "./WebSourceBadge.jsx";
import { groupSources, sourceLabel } from "./sourceView.js";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function SourceListDrawer({ sources, focusSourceId, onClose }) {
  const { t } = useI18n();
  const panelRef = useRef(null);
  const restoreRef = useRef(null);

  const groups = groupSources(sources);

  // Remember what had focus BEFORE the drawer opened, so closing puts it back
  // on the citation chip the user came from — not at the top of the document,
  // which for a keyboard user means re-reading the whole answer to get back.
  useEffect(() => {
    restoreRef.current = typeof document !== "undefined" ? document.activeElement : null;
    const panel = panelRef.current;
    const first = panel?.querySelector(`[data-source-id="${focusSourceId}"]`) || panel;
    first?.focus?.();
    return () => {
      const el = restoreRef.current;
      if (el && typeof el.focus === "function" && document.contains(el)) el.focus();
    };
  }, [focusSourceId]);

  const onKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
      if (e.key !== "Tab") return;
      const nodes = [...(panelRef.current?.querySelectorAll(FOCUSABLE) || [])].filter(
        // NOT `offsetParent !== null`: this panel is `position: fixed`, and
        // every descendant of a fixed element reports a null offsetParent. The
        // obvious visibility check therefore filters out the entire drawer,
        // leaving no trap at all — a bug that looks like working code.
        (n) => n.getClientRects().length > 0,
      );
      if (nodes.length === 0) { e.preventDefault(); panelRef.current?.focus(); return; }

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const at = nodes.indexOf(document.activeElement);
      // Focus starts on the panel or on the `tabindex=-1` source row the
      // citation pointed at — neither is in `nodes`, and the source row sits
      // AFTER the last tabbable in document order, so an untrapped Tab from
      // there leaves the drawer immediately. Send it to an end instead.
      if (at === -1) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    },
    [onClose],
  );

  return (
    <>
      <div className="evd-drawer-scrim" onClick={onClose} data-testid="drawer-scrim" />
      <aside
        ref={panelRef}
        className="evd-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={t("answer.sources")}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        data-testid="source-drawer"
      >
        <header className="evd-drawer-head">
          <h2>{t("answer.sources")}</h2>
          <button type="button" className="btn evd-drawer-close" onClick={onClose}
                  aria-label={t("common.close")} data-testid="drawer-close">
            <Icon name="x" size={14} />
          </button>
        </header>

        {groups.length === 0 && <p className="evd-note">{t("answer.no_sources")}</p>}

        {groups.map((group) => (
          <section key={group.kind} className="evd-drawer-group" data-group={group.kind}>
            <h3 className="evd-drawer-group-title">{t(`source_group.${group.kind}`)}</h3>
            <ol className="evd-source-list" data-testid={`source-group-${group.kind}`}>
              {group.items.map((source) => (
                <li key={source.id} className="evd-source" data-source-id={source.id}
                    data-kind={source.kind} tabIndex={-1} data-testid="source-item">
                  <span className="evd-source-n" aria-hidden="true">[{source.number}]</span>
                  <div className="evd-source-body">
                    <p className="evd-source-title">{sourceLabel(source)}</p>
                    <p className="evd-source-meta">
                      {source.evidence_tier && <EvidenceBadge tier={source.evidence_tier} />}
                      {source.source_authority && (
                        <span className="evd-badge" data-authority={source.source_authority}>
                          {t(`authority.${source.source_authority}`)}
                        </span>
                      )}
                      {source.kind === "web" && <WebSourceBadge source={source} />}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </aside>
    </>
  );
}
