// Sprint 06 — Low-confidence word mark with alternatives
import { Mark, mergeAttributes } from '@tiptap/core'

export const LowConfidenceMark = Mark.create({
  name: 'lowConfidence',

  addAttributes() {
    return {
      confidence:   { default: 0.85 },
      alternatives: { default: [] },
    }
  },

  parseHTML() {
    return [{
      tag: 'span[data-confidence]',
      getAttrs: el => ({
        confidence:   parseFloat(el.getAttribute('data-confidence')) || 0.85,
        alternatives: [],
      }),
    }]
  },

  renderHTML({ HTMLAttributes }) {
    const conf = parseFloat(HTMLAttributes.confidence) || 0.85
    const cls  = conf < 0.85 ? 'word-low-confidence' : ''
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-confidence': conf,
      class: cls || undefined,
    }), 0]
  },
})
