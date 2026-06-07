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
