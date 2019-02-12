import uuid from 'uuid/v4'
import { Plugin, PluginKey, PluginSpec, EditorState, Transaction } from 'prosemirror-state'
import { ReplaceStep, canJoin } from 'prosemirror-transform'
import { EditorView } from 'prosemirror-view'
import { ResolvedPos, Node } from 'prosemirror-model'

/**
 * The key for the pagination plugin.
 */
export const pluginKey = new PluginKey('pagination')

/**
 * Get the parent.
 */
function getParent(doc: Node, pos: number): { node: Node, pos: number } {
  const { parentOffset } = doc.resolve(pos)
  const parentPos = pos - parentOffset - 1

  if (parentPos > 0) {
    const node = doc.nodeAt(parentPos)
    
    if (!node) {
      throw new Error(`Position ${parentPos} out of range`)
    }
  
    return { node, pos: parentPos }
  }

  return { node: doc, pos: 0 }
}

/**
 * Calls the callback function for each node, that is an ancestor to the position,
 * and returns the node if the callback returns true.
 */
function getAncestor(doc: Node, pos: number, callback: (node: Node, pos: number) => boolean): { node: Node, pos: number } {
  const parent = getParent(doc, pos)

  if (parent.pos === 0 || callback(parent.node, parent.pos)) {
    return parent
  }

  return getAncestor(doc, parent.pos, callback)
}

/**
 * Calls a function on the parent and continues up the node tree if the function returns true.
 */
function traverseAncestors(doc: Node, pos: number, callback: (node: Node, pos: number) => boolean): void {
  const parent = getParent(doc, pos)

  if (parent.pos > 0 && callback(parent.node, parent.pos)) {
    return traverseAncestors(doc, parent.pos, callback)
  }
}

/**
 * Join all descendants of a node if they are a page or have the same origin.
 */
function joinDeep(node: Node, tr: Transaction, startPos = 0, offset = 0) {
  let prevOrigin: string

  node.forEach((child, childOffset, index) => {
    if (childOffset >= startPos) {
      let position = tr.mapping.mapResult(childOffset + offset).pos

      if (canJoin(tr.doc, position)) {
        if (child.type.name === 'page' || prevOrigin === node.attrs.origin) {
          tr.join(position)

          joinDeep(child, tr, 0, childOffset + offset)
        }
      }

      prevOrigin = node.attrs.origin
    }
  })
}

class PaginationView  {
  update(view: EditorView) {
    const pages = view.dom.querySelectorAll('.page')

    pages.forEach((page) => {
      if (page.scrollHeight > page.clientHeight) {
        const { scrollY } = window
        const transaction = view.state.tr

        /**
         * Inner bottom left coordinates of the page relative to window.document.
         */
        let { bottom: coordY, left: coordX } = this.getInnerCoords(page)

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

        let splitAtPos = resolvedPosition.pos
        let splitAtDepth = resolvedPosition.depth

        /**
         * Prevent empty nodes as result of splitting.
         */
        if (resolvedPosition.parentOffset === 0) {
          splitAtDepth -= 1
          splitAtPos -= 1
          node = view.state.doc.nodeAt(splitAtPos)!
        } else if (resolvedPosition.parentOffset === resolvedPosition.parent.content.size) {
          splitAtDepth += 1
          splitAtPos += 1
          node = view.state.doc.nodeAt(splitAtPos)!
        }

        /**
         * Node should not be null here but just in case.
         */
        if (node == null) {
          throw Error(`could not split at resolved position ${resolvedPosition}`)
        }

        traverseAncestors(view.state.doc, position.pos, (node, pos) => {
          const origin = node.attrs.origin || uuid()

          transaction.setNodeMarkup(pos, node.type, {...node.attrs, origin})

          return true
        })

        transaction.setMeta(pluginKey, 'split')
        transaction.split(splitAtPos, splitAtDepth)

        view.dispatch(transaction)
      }
    })
  }

  /**
   * Get the inner coordinates of an element relative to window.document.
   */
  getInnerCoords(element: Element) {
    const { top, right, bottom, left } = element.getBoundingClientRect()
    const { scrollY, scrollX } = window
    const paddingTop = this.getStylePropertyValue(element, 'padding-top')
    const paddingRight = this.getStylePropertyValue(element, 'padding-right')
    const paddingBottom = this.getStylePropertyValue(element, 'padding-bottom')
    const paddingLeft = this.getStylePropertyValue(element, 'padding-left')
  
    return {
      width: element.clientWidth - paddingLeft - paddingRight,
      height: element.clientHeight - paddingTop - paddingBottom,
      top: top + scrollY + paddingTop,
      right: right + scrollX - paddingRight,
      bottom: bottom + scrollY - paddingBottom,
      left: left + scrollX + paddingLeft,
    }
  }

  /**
   * Get the numerical value of a style prop.
   */
  getStylePropertyValue(element: Element, property: string) {
    return parseInt( getComputedStyle(element).getPropertyValue(property) || '0' )
  }

  /**
   * Resolve a node at a position and return true in traverse function to resolve the parent.
   */
  traversePos(doc: Node, position: ResolvedPos, traverse: (node: Node, position: ResolvedPos) => boolean): void {
    const node = doc.nodeAt(position.pos)
    const nextPosition = position.pos - position.parentOffset - 1

    if (node != null && traverse(node, position) && nextPosition > -1) {
      return this.traversePos(
        doc,
        doc.resolve(nextPosition),
        traverse
      )
    }
  }
}

export default function pagination() {
  return new Plugin({
    view(view) {
      return new PaginationView()
    },
    appendTransaction(transactions, prevState, state) {
      const pluginMeta = transactions[0].getMeta(pluginKey)
      const transaction = state.tr
      let hasReplaceStep = false
      let firstChangePos = 0

      if (transactions.length === 1 && pluginMeta === 'split') {
        return 
      }

      transactions.forEach(transaction => {
        transaction.steps.forEach(step => {
          if (step instanceof ReplaceStep) {
            hasReplaceStep = true

            if (firstChangePos < (step as any).from) {
              firstChangePos = (step as any).from
            }
          }
        })
      })

      if (hasReplaceStep) {
        const { pos } = getAncestor(state.doc, firstChangePos, node => node.type.name === 'page')
        const pageOffset = state.doc.resolve(pos).parentOffset

        if (pageOffset) {
          transaction.setMeta(pluginKey, 'join')

          joinDeep(state.doc, transaction, pageOffset)

          return transaction
        }
      }
    }
  })
}