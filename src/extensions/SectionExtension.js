// Sprint 06 — Section node: root-level document sections (no bare paragraphs at root)
import { Node, mergeAttributes } from '@tiptap/core'

export const SectionExtension = Node.create({
  name: 'section',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      id:       { default: null },
      title:    { default: '' },
      kind:     { default: 'free_text' },
      required: { default: false },
    }
  },

  parseHTML() {
    return [{ tag: 'section[data-section-id]' }]
  },

  renderHTML({ node }) {
    return [
      'section',
      {
        'data-section-id':    node.attrs.id,
        'data-section-kind':  node.attrs.kind,
        'data-section-title': node.attrs.title,
        class: 'tiptap-section',
      },
      0,
    ]
  },

  // Sprint 13 — NodeView: the section owns a widget slot OUTSIDE the
  // editable content. Typed field renderers portal into `.field-widget-mount`
  // (see reports/FieldWidgetsLayer.jsx); because the slot is not part of
  // contentDOM and its mutations are ignored, ProseMirror never parses the
  // widgets into document content (injecting DOM into a PM-managed element
  // gets absorbed as text — the S13 E2E caught exactly that). The prose
  // lives in contentDOM; for free_text sections the slot stays empty
  // (display:none via CSS :empty) and rendering is visually identical.
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('section')
      dom.className = 'tiptap-section'
      const setAttrs = (n) => {
        dom.setAttribute('data-section-id', n.attrs.id ?? '')
        dom.setAttribute('data-section-kind', n.attrs.kind ?? 'free_text')
        dom.setAttribute('data-section-title', n.attrs.title ?? '')
      }
      setAttrs(node)

      const widget = document.createElement('div')
      widget.className = 'field-widget-mount'
      widget.contentEditable = 'false'
      widget.setAttribute('data-field-widget-for', node.attrs.id ?? '')

      const contentDOM = document.createElement('div')
      contentDOM.className = 'tiptap-section-content'

      dom.append(widget, contentDOM)
      return {
        dom,
        contentDOM,
        // React owns the widget subtree — PM must neither parse nor undo it.
        ignoreMutation: (m) => m.type !== 'selection' && (widget === m.target || widget.contains(m.target)),
        update: (updated) => {
          if (updated.type.name !== 'section') return false
          setAttrs(updated)
          return true
        },
      }
    }
  },

  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const { $anchor } = editor.state.selection
        // Block backspace when cursor is at the start of the first block in a section
        if ($anchor.parentOffset === 0 && $anchor.index(-1) === 0) {
          const grandParent = $anchor.node(-1)
          if (grandParent?.type.name === 'section') {
            return true // prevent merge
          }
        }
        return false
      },
    }
  },
})
