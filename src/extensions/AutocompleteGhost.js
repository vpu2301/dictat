// Sprint 10 step 03 — inline ghost text as a ProseMirror widget decoration.
//
// The ghost renders `completion` as a <span> INSIDE the text flow right
// after the caret (side: 1) — same font metrics as the document, so no
// layout shift beyond the text it previews. Decorations never enter the
// document: no undo pollution, no content-model mutation, nothing to clean
// up on accept.
//
// State protocol: the React side arms the ghost with
// `tr.setMeta(autocompleteGhostKey, { text })` once the suggestion hook has
// settled, and clears it with `null`. ANY document or selection change
// clears the ghost immediately in `apply` — a completion for a prefix the
// user has typed past must never be visible, not even for one frame; the
// hook re-arms via a fresh meta when the new suggestions land.
//
// Performance guard: when the feature is off nothing is ever armed, so
// `apply` is a null passthrough and `decorations` returns null — zero work
// on the keystroke path.

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export const autocompleteGhostKey = new PluginKey('autocompleteGhost')

export const AutocompleteGhost = Extension.create({
  name: 'autocompleteGhost',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: autocompleteGhostKey,
        state: {
          init: () => null, // { text } | null
          apply(tr, prev) {
            const meta = tr.getMeta(autocompleteGhostKey)
            if (meta !== undefined) return meta
            if (!prev) return null
            if (tr.docChanged || tr.selectionSet) return null // divergence → gone
            return prev
          },
        },
        props: {
          decorations(state) {
            const ghost = autocompleteGhostKey.getState(state)
            if (!ghost || !ghost.text) return null
            const sel = state.selection
            if (!sel.empty) return null
            return DecorationSet.create(state.doc, [
              Decoration.widget(
                sel.from,
                () => {
                  const span = document.createElement('span')
                  // aria-hidden: screen readers get the popup's listbox
                  // semantics (role=option + aria-activedescendant on the
                  // editor), not the decoration.
                  span.className = 'autocomplete-ghost'
                  span.setAttribute('aria-hidden', 'true')
                  span.textContent = ghost.text
                  return span
                },
                { side: 1, ignoreSelection: true, key: `ghost:${ghost.text}` },
              ),
            ])
          },
        },
      }),
    ]
  },
})
