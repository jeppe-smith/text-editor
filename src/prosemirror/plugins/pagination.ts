import { Plugin, PluginKey } from 'prosemirror-state'
import {
  canJoin,
  Step,
  ReplaceStep as PRReplaceStep
} from 'prosemirror-transform'
import { EditorView } from 'prosemirror-view'
import { Slice } from 'prosemirror-model'
import { ReplaceStep } from '../../types.d'

interface IReplaceStep extends Step {
  from: number
  slice: Slice
  structure: boolean
  to: number
}

/**
 * The key for the pagination plugin.
 */
export const pluginKey = new PluginKey('pagination')

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
    left: left + scrollX + paddingLeft
  }
}

/**
 * Get the numerical value of a style prop.
 */
function getStylePropertyValue(element: Element, property: string) {
<<<<<<< HEAD
  return parseInt(getComputedStyle(element).getPropertyValue(property) || '0')
=======
  return parseInt( getComputedStyle(element).getPropertyValue(property) || '0' )
>>>>>>> 293319ef0bc840a582e379e9f610ef5f5064998a
}

interface Connection {
  to: number
  from: number
}

interface Split {
  pos: number
  connections: Connection[]
}

class PaginationState {
  splits: Split[]

  constructor(splits: Split[]) {
    this.splits = splits
  }
}

export default function pagination() {
  return new Plugin({
    key: pluginKey,
    state: {
      init(config, instance) {
        return new PaginationState([])
      },
      apply(tr, value: PaginationState, prevState, state): PaginationState {
        let { splits } = value

        /**
         * If this is a join we know that all splits should be reset.
         */
        if (tr.getMeta(pluginKey) === 'join') {
          return new PaginationState([])
        }

        /**
         * Map the splits and the connections so we know their positions in the new doc.
         */
        splits = splits.map((split) => {
          return {
            pos: tr.mapping.mapResult(split.pos).pos,
            connections: split.connections.map((connection) => {
              return {
                from: tr.mapping.mapResult(connection.from).pos,
                to: tr.mapping.mapResult(connection.to).pos
              }
            })
          }
        })

        splits = splits.map(split => {
          return {
            pos: split.pos,
            connections: split.connections.filter(connection => {
              const from = state.doc.resolve(connection.from)
              const to = state.doc.resolve(connection.to)

              return to.parentOffset === 0
            })
          }
        })

        if (tr.getMeta(pluginKey) === 'split') {
          const step = tr.steps[0] as unknown as IReplaceStep
          const { pos, depth } = state.doc.resolve(tr.mapping.mapResult(step.from).pos)
          const splitPos = state.doc.resolve(pos - depth)
          let connections: Connection[] = []

          for (let i = 1; i < depth + 1; i++) {
            const to = state.doc.resolve(splitPos.pos + i)
            const from = state.doc.resolve(splitPos.pos - i)
            
            if (to.nodeAfter && !to.nodeAfter!.isText) {
              connections = [
                ...connections,
                {
                  from: from.pos,
                  to: to.pos
                }
              ]
            }
          }

          splits = [...splits, { pos: splitPos.pos, connections }]
        }

        return new PaginationState(splits)
      }
    },
    appendTransaction(transactions, prevState, state) {
      let replaceSteps: ReplaceStep[] = []

      if (transactions.length === 1) {
        const tr = transactions[0]

        if (tr.getMeta(pluginKey) || tr.getMeta('pointer')) {
          return
        }
      }

      replaceSteps = transactions.reduce<ReplaceStep[]>(
        (all, transaction) => [
          ...all,
          ...transaction.steps.filter(
            (step): step is ReplaceStep => step instanceof PRReplaceStep
          )
        ],
        []
      )

      if (!replaceSteps.length) {
        return
      }

      const transaction = state.tr
      const { splits } = pluginKey.getState(state) as PaginationState

      if (splits.length) {
        transaction.setMeta(pluginKey, 'join')
        transaction.setMeta('addToHistory', false)
      }

      splits.forEach(split => {
        const splitPos = transaction.mapping.mapResult(split.pos).pos

        if (canJoin(transaction.doc, splitPos)) {
          transaction.join(splitPos)
  
          split.connections.forEach(connection => {
            const from = transaction.mapping.mapResult(connection.from).pos
            const to = transaction.mapping.mapResult(connection.to).pos

            if (from === to && canJoin(transaction.doc, to)) {
              const resolvedPosition = transaction.doc.resolve(to)

              if (
                resolvedPosition &&
                resolvedPosition.nodeAfter &&
                resolvedPosition.nodeAfter.content.size &&
                resolvedPosition.nodeBefore &&
                resolvedPosition.nodeBefore.content.size
              ) {
                transaction.join(to)
              }
            }
          })
        }
      })

      return transaction
    },
    view() {
      return {
        update(view: EditorView) {
          const pages = view.dom.querySelectorAll('.page')

          pages.forEach((page) => {
            if (page.scrollHeight > page.clientHeight) {
              const { scrollY } = window
              const transaction = view.state.tr

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
                throw new Error(
                  `Cannot find position at coords top: ${coordY}, left: ${coordX}`
                )
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
              if (resolvedPosition.parentOffset === resolvedPosition.parent.content.size) {
                splitAtDepth++
                splitAtPos++
                node = view.state.doc.nodeAt(splitAtPos)
              } else if (resolvedPosition.parentOffset === 0) {
                splitAtDepth--
                splitAtPos--
                node = view.state.doc.nodeAt(splitAtPos)
              }

              /**
               * Node should not be null here but just in case.
               */
              if (node == null) {
                throw Error(
                  `could not split at resolved position ${resolvedPosition}`
                )
              }

              transaction.setMeta(pluginKey, 'split')
              transaction.setMeta('addToHistory', false)
              transaction.split(splitAtPos, splitAtDepth)

              view.dispatch(transaction)
            }
          })
        }
      }
    }
  })
}
