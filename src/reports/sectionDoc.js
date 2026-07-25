// sectionDoc.js — the body-object ⇄ TipTap-JSON mapping, extracted from
// TipTapEditor.jsx (Sprint 13) so it is unit-testable under node --test
// (no JSX) and so the section node's `kind` attribute can carry the REAL
// template field_type — the hook the field-renderer dispatch keys on.
//
// Contract: `body` stays { [section_id]: text }. Typed metadata does NOT
// pass through the ProseMirror document — it lives in the Studio's
// section-meta map (see fieldContract.sectionMetaFromContent) and renders
// via FieldWidgetsLayer. The doc carries prose only, for every field type.

export function bodyToDoc(template, body, lang) {
  return {
    type: 'doc',
    content: template.sections.map(s => ({
      type: 'section',
      attrs: {
        id: s.id,
        title: s.name?.[lang] || s.name?.en || s.id,
        kind: s.field_type || 'free_text',
        required: !!s.required,
      },
      content: [{
        type: 'paragraph',
        content: body[s.id]
          ? [{ type: 'text', text: body[s.id] }]
          : [],
      }],
    })),
  }
}

export function docToBody(doc) {
  const body = {}
  doc.forEach(node => {
    if (node.type.name === 'section') {
      body[node.attrs.id] = node.textContent
    }
  })
  return body
}
