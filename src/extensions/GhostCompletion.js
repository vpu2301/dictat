// GhostCompletion.js — Layer C ghost text as a ProseMirror widget decoration
// (sprint 15). Sibling of sprint-10's AutocompleteGhost, NOT a reuse of it:
// Layer C is *generated* content, so it gets its own visual grammar (italic,
// dimmer, a machine mark) and its own lifetime.
//
// Why a decoration and not document text: a decoration cannot be saved,
// undone, dictated over, exported, or serialised into the report body. The
// physical impossibility of ghost text entering the record IS the safety
// property — "never auto-inserts" is not a rule the code follows, it is a rule
// the code cannot break.
//
// State protocol (identical to Layer A so the two behave the same under the
// same fingers): React arms with `tr.setMeta(ghostCompletionKey, { text })`
// and clears with `null`; ANY doc or selection change clears it inside
// `apply`, so a ghost for a prefix the clinician has typed past is never
// visible, not even for one frame.
//
// Touch accept: mobile has no Tab, so the widget carries an inline "↹" chip.
// It talks to React by dispatching a BUBBLING custom event on the editor DOM
// rather than closing over a callback — decorations are rebuilt on every
// transaction, and a captured stale handler would accept the wrong text.

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export const ghostCompletionKey = new PluginKey('ghostCompletion')

// Bubbles to the editor's DOM node, where TipTapEditor listens.
export const GHOST_ACCEPT_EVENT = 'mdx:layerc-accept'

export const GhostCompletion = Extension.create({
  name: 'ghostCompletion',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: ghostCompletionKey,
        state: {
          init: () => null, // { text, touch } | null
          apply(tr, prev) {
            const meta = tr.getMeta(ghostCompletionKey)
            if (meta !== undefined) return meta
            if (!prev) return null
            if (tr.docChanged || tr.selectionSet) return null // divergence → gone
            return prev
          },
        },
        props: {
          decorations(state) {
            const ghost = ghostCompletionKey.getState(state)
            if (!ghost || !ghost.text) return null
            const sel = state.selection
            if (!sel.empty) return null
            return DecorationSet.create(state.doc, [
              Decoration.widget(
                sel.from,
                () => {
                  const span = document.createElement('span')
                  span.className = 'layerc-ghost'
                  span.setAttribute('data-testid', 'layerc-ghost')
                  // The completion text itself is aria-hidden: a screen reader
                  // reading it inline would present machine text as document
                  // content. The announcement lives in a role=status region
                  // rendered by React (see Studio).
                  span.setAttribute('aria-hidden', 'true')
                  span.contentEditable = 'false'

                  const text = document.createElement('span')
                  text.className = 'layerc-ghost-text'
                  text.textContent = ghost.text
                  span.appendChild(text)

                  if (ghost.touch) {
                    const chip = document.createElement('button')
                    chip.type = 'button'
                    chip.className = 'layerc-accept'
                    chip.setAttribute('data-testid', 'layerc-accept')
                    // Reachable by explore-by-touch, never by Tab — Tab is the
                    // accept gesture itself and must not land on a control.
                    chip.tabIndex = -1
                    chip.setAttribute('aria-hidden', 'false')
                    chip.setAttribute('aria-label', ghost.acceptLabel || 'Accept suggestion')
                    chip.textContent = '↹'
                    // mousedown/touchstart + preventDefault: a click would blur
                    // the editor first and the caret would be gone by the time
                    // the accept ran.
                    const fire = (e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      chip.dispatchEvent(
                        new CustomEvent(GHOST_ACCEPT_EVENT, { bubbles: true }),
                      )
                    }
                    chip.addEventListener('mousedown', fire)
                    chip.addEventListener('touchstart', fire, { passive: false })
                    span.appendChild(chip)
                  }
                  return span
                },
                { side: 1, ignoreSelection: true, key: `lcghost:${ghost.touch ? 't' : 'k'}:${ghost.text}` },
              ),
            ])
          },
        },
      }),
    ]
  },
})
