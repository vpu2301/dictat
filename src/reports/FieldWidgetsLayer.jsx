// FieldWidgetsLayer.jsx — Sprint 13: portals each typed section's widget
// into the `.field-widget-mount` slot that the Section NodeView owns
// (extensions/SectionExtension.js). The slot lives OUTSIDE the NodeView's
// contentDOM with mutations ignored, so ProseMirror never parses the
// widgets into document content — this layer only FINDS slots, it never
// creates or inserts DOM into the editor (doing so gets absorbed as text;
// the S13 E2E proved it). Re-scans on every transaction because setContent
// recreates the NodeViews (and their slots).
//
// Dispatch: only sections whose field_type has a REGISTERED renderer render
// into their slot. free_text (and not-yet-registered types) leave the slot
// empty — display:none via CSS :empty — which is the sprint's
// pixel-stability guarantee for prose.

import React, { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { getFieldRenderer } from './fieldRegistry.js'
import { FIELD_TYPES } from './fieldContract.js'

// Forward-compat fallback (step 01 §4.3): a field_type this build doesn't
// know (newer backend, unmigrated value) renders as plain prose — never
// blank, never a crash. Warn once per type in dev; production is silent.
const warnedTypes = new Set()
function warnUnknownType(fieldType, sectionId) {
  if (!import.meta.env?.DEV || warnedTypes.has(fieldType)) return
  warnedTypes.add(fieldType)
  console.warn(
    `[report-fields] unknown field_type ${JSON.stringify(fieldType)} on section ` +
    `${JSON.stringify(sectionId)} — rendering as prose (forward-compat fallback)`,
  )
}

export function FieldWidgetsLayer({
  editor,        // TipTap editor instance (null while initializing)
  template,      // Studio template (sections carry field_type + options)
  sectionMeta,   // { [section_key]: { icd10?, field_specific_metadata? } }
  onSectionMetaChange, // (sectionKey, { icd10?, field_specific_metadata? }) → void
  lang,
  readOnly = false,
}) {
  const [mounts, setMounts] = useState([]) // [{ id, el }]

  useEffect(() => {
    if (!editor?.view?.dom || !template?.sections) { setMounts([]); return }

    const wanted = new Map() // section id → section (only ids with a renderer)
    for (const s of template.sections) {
      if (s.field_type && s.field_type !== 'free_text' && !FIELD_TYPES.includes(s.field_type)) {
        warnUnknownType(s.field_type, s.id)
      }
      if (getFieldRenderer(s.field_type)) wanted.set(s.id, s)
    }

    const scan = () => {
      const root = editor.view?.dom
      if (!root) return
      const next = []
      for (const id of wanted.keys()) {
        // The slot is created and owned by the Section NodeView — find it,
        // NEVER create it (inserting into PM-managed DOM corrupts the doc).
        const el = root.querySelector(
          `section.tiptap-section[data-section-id="${CSS.escape(id)}"] > .field-widget-mount`,
        )
        if (el) next.push({ id, el })
      }
      setMounts(prev =>
        prev.length === next.length && prev.every((m, i) => m.el === next[i].el && m.id === next[i].id)
          ? prev
          : next,
      )
    }

    scan()
    // Re-scan on every transaction (setContent recreates the NodeViews)
    // AND on DOM mutations of the editor root: ProseMirror may rebuild a
    // NodeView outside any transaction we hear about, leaving React bound
    // to a DETACHED mount while a fresh empty one sits in the document
    // (observed live in the S13 E2E — allergies rendered into an orphaned
    // node). The observer is rAF-debounced; the scan's identity guard makes
    // the loop terminate (rendering into a mount mutates only that mount's
    // subtree, and the re-scan then finds identical elements → no state
    // change → no further renders).
    editor.on('transaction', scan)
    let raf = null
    const observer = new MutationObserver(() => {
      if (raf != null) return
      raf = requestAnimationFrame(() => { raf = null; scan() })
    })
    observer.observe(editor.view.dom, { childList: true, subtree: true })
    return () => {
      editor.off('transaction', scan)
      observer.disconnect()
      if (raf != null) cancelAnimationFrame(raf)
    }
  }, [editor, template])

  if (!template?.sections) return null
  const byId = new Map(template.sections.map(s => [s.id, s]))

  return (
    <>
      {mounts.map(({ id, el }) => {
        const section = byId.get(id)
        const Renderer = section && getFieldRenderer(section.field_type)
        if (!Renderer) return null
        const meta = sectionMeta?.[id] || {}
        return createPortal(
          <Renderer
            key={id}
            section={section}
            fieldMeta={meta.field_specific_metadata || null}
            icd10={meta.icd10 || []}
            onChange={(patch) => onSectionMetaChange?.(id, patch)}
            lang={lang}
            readOnly={readOnly}
          />,
          el,
          id,
        )
      })}
    </>
  )
}
