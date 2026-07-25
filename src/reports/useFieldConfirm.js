// useFieldConfirm.js — Sprint 13 step 02: the ONE hook every typed renderer
// uses for confirm/override/dismiss (and the diagnosis per-code variants).
// A thin React wrapper over the pure builders in fieldActions.js: it builds
// the patch, hands it to Studio's onSectionMetaChange, and reports whether
// anything happened.
//
// Save semantics (deliberate, differs from the spec's optimistic+rollback
// sketch): a confirm IS an edit, exactly like typing prose. The patch lands
// in Studio state immediately (instant UI), marks the draft dirty, and rides
// the existing debounced autosave PUT — so rapid multi-confirms coalesce
// into one save by construction, and save failures follow the established
// autosave path (silent retry on 429/409, toast + stay-dirty on real
// errors). Rolling back a confirmed chip while keeping concurrently-typed
// prose would desync the two halves of the same failed save; staying dirty
// and retrying is the consistent behavior.

import { useMemo } from "react";
import { isProposal, isConfirmed } from "./fieldContract.js";
import {
  buildConfirm,
  buildOverride,
  buildDismiss,
  buildConfirmProposal,
  buildRemoveCode,
} from "./fieldActions.js";

export function useFieldConfirm({ section, entry, onChange }) {
  return useMemo(() => {
    const apply = (patch) => {
      if (!patch || !onChange) return false;
      onChange(patch);
      return true;
    };
    const meta = entry?.field_specific_metadata || null;
    return {
      meta,
      icd10: entry?.icd10 || [],
      proposal: isProposal(meta),
      confirmed: isConfirmed(meta),
      confidence: isProposal(meta) ? meta.confidence : null,
      confirm: () => apply(buildConfirm(section, entry)),
      override: (value) => apply(buildOverride(section, value)),
      dismiss: () => apply(buildDismiss(section, entry)),
      confirmProposal: (code) => apply(buildConfirmProposal(section, entry, code)),
      removeCode: (code) => apply(buildRemoveCode(section, entry, code)),
    };
  }, [section, entry, onChange]);
}
