import { EditorView } from 'prosemirror-view'
import { EditorState, Transaction, Plugin, Selection, PluginKey,  } from 'prosemirror-state'
import { ReplaceStep, Transform, canJoin } from 'prosemirror-transform';
import { Slice, Node, Schema } from 'prosemirror-model'
import uuid from 'uuid/v4'

const historyKey = new PluginKey("history")

/**
 * ReplaceStep class is wrongly typed in prosemirror-transform.
 */
interface IReplaceStep extends ReplaceStep {
  from: number
  slice: Slice
  structure: boolean
  to: number
}

import { Step, StepResult } from 'prosemirror-transform';

/**
 * Get the numerical value of a style prop.
 */
function getStylePropertyValue(element: Element, property: string) {
  return parseInt( getComputedStyle(element).getPropertyValue(property) || '0' )
}

/**
 * Get the inner coordinates of an element relative to window.document.
 */
function getInnerCoords(element: Element) {
  const { top, right, bottom, left } = element.getBoundingClientRect()
  const { scrollY, scrollX } = window
  const paddingTop = getStylePropertyValue(element, 'padding-top')
  const paddingRight = getStylePropertyValue(element, 'padding-right')
  const paddingBottom = getStylePropertyValue(element, 'padding-bottom')
  const paddingLeft = getStylePropertyValue(element, 'padding-left')

  return {
    width: element.clientWidth - paddingLeft - paddingRight,
    height: element.clientHeight - paddingTop - paddingBottom,
    top: top + scrollY + paddingTop,
    right: right + scrollX - paddingRight,
    bottom: bottom + scrollY - paddingBottom,
    left: left + scrollX + paddingLeft,
  }
}

const pluginKey = new PluginKey('pagination')

export default new Plugin({
  view() {
    return {
      update(view) {
        const pages = view.dom.querySelectorAll('.page')

        pages.forEach(page => {
          if (page.scrollHeight > page.clientHeight) {
            const { scrollY } = window

            /**
             * Inner bottom left coordinates of the page relative to window.document.
             */
            let { bottom: coordY, left: coordX } = getInnerCoords(page)

            /**
             * The position of the document at the bottom left corner of the page.
             */
            let position

            /**
             * The resolved position where we want to split. We need this to know
             * the depth of the split.
             */
            let resolvedPosition

            /**
             * The node to split.
             */
            let node

            /**
             * Scroll the bottom of the page in to view so we can get the position.
             */
            window.scrollTo({ top: coordY })

            /**
             * Because coordY is the distance from the top of window.document to the bottom 
             * of the page we need to subtract scrollY to get the position within the viewport.
             */
            coordY = coordY - window.scrollY

            /**
             * Because the coords are just on the edge of the page content it's possible that the 
             * page itself will be the result of posAtCoords unless we move the coords a pixel
             * further in to the content.
             */
            position = view.posAtCoords({
              top: coordY - 1,
              left: coordX + 1
            })

            /**
             * Maybe we should just return here instead of throwing an error.
             */
            if (position == null) {
              throw new Error(`Cannot find position at coords top: ${coordY}, left: ${coordX}`)
            }
            
            /**
             * Scroll back to intiial scroll position.
             */
            window.scrollTo({ top: scrollY })

            resolvedPosition = view.state.doc.resolve(position.pos)
            node = view.state.doc.nodeAt(resolvedPosition.pos)

            /**
             * If no node could be determined at the position it is unsafe to split.
             */
            if (node != null) {
              if (node.isText) {
                resolvedPosition.parent.attrs = { ...resolvedPosition.parent.attrs, origin: uuid() }
              }

              view.dispatch(
                view.state.tr
                  .setMeta(pluginKey, 'split')
                  .split(resolvedPosition.pos, resolvedPosition.depth)
              )
            }
          }
        })
      }
    }
  },
  appendTransaction(transactions, prevState, state) {
    if (transactions[0].getMeta(pluginKey) === 'split') {
      return
    }

    let transaction = state.tr.setMeta(pluginKey, 'join')
    let shouldJoin = false

    /**
     * If you want to delete the last node in a page node it's the paeg node that gets
     * removed and the child node gets moved up to the previous page. This is not what 
     * so when a page is removed we join the child node and the last child node of the
     * previous page.
     */
    if (state.doc.childCount < prevState.doc.childCount) {
      const joinPos = state.doc.resolve(state.selection.$anchor.pos - 1)
      
      if (canJoin(state.doc, joinPos.pos)) {
        transaction.join(joinPos.pos)

        if (joinPos.nodeAfter!.content.size > 0 && joinPos.nodeBefore!.content.size > 0) {
          transaction.replace(
            transaction.mapping.mapResult(joinPos.pos).pos - 1,
            transaction.mapping.mapResult(joinPos.pos).pos
          )
        }
      }

      return transaction
    }

    /**
     * Join pages together unless the transaction is from this plugin. This way we leave
     * it to the update function to deal with the layout.
     */
    transactions.forEach(transaction => {
      if (transaction.getMeta(pluginKey) === undefined) {
        shouldJoin = true
      }
    })

    if (shouldJoin) {
      state.doc.forEach((page, offset, index) => {
        if (offset > 0) {
          const origin = page.firstChild!.attrs.origin
          const lastOrigin = state.doc.child(index - 1).lastChild!.attrs.origin
          let depth = 1

          if (origin != null && origin === lastOrigin) {
            depth = 2
          }

          transaction = transaction.join(offset, depth)
        }
      })

      return transaction
    }
  }
})
