import { Plugin, PluginKey, Transaction, EditorState } from 'prosemirror-state'
import {
  canJoin,
  Step,
  ReplaceStep as PRReplaceStep,
  canSplit,
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
    left: left + scrollX + paddingLeft,
  }
}

/**
 * Get the numerical value of a style prop.
 */
function getStylePropertyValue(element: Element, property: string) {
  return parseInt(getComputedStyle(element).getPropertyValue(property) || '0')
}

/**
 * Split pages in a view.
 *
 * @param view The EditorView.
 */
function splitPages(view: EditorView) {
  const pages = view.dom.querySelectorAll('.page')

  pages.forEach(page => {
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
        left: coordX + 1,
      })

      /**
       * Maybe we should just return here instead of throwing an error.
       */
      if (position == null) {
        throw new Error(
          `Cannot find position at coords top: ${coordY}, left: ${coordX}`,
        )
      }

      /**
       * Scroll back to initial scroll position.
       */
      window.scrollTo({ top: scrollY })

      resolvedPosition = view.state.doc.resolve(position.pos)

      /**
       * If we're at the very beginning of a node we traverse it's
       * parents until we are no longer at the beginning of a given
       * node. This way we prevent empty nodes as a result of split.
       *
       * To prevent nodes hanging in the bottom margin of a page we
       * have to check if we're at the beginning of a node before
       * checking if we're at the end.
       */
      while (
        resolvedPosition.parentOffset === 0 &&
        resolvedPosition.node().type.name !== 'page'
      ) {
        resolvedPosition = view.state.doc.resolve(resolvedPosition.pos - 1)
      }

      /**
       * If we're at the very end of a node we traverse it's parents
       * until we're no longer at the end. This prevents empty nodes
       * as a result of splitting.
       */
      while (
        resolvedPosition.parentOffset ===
          resolvedPosition.parent.content.size &&
        resolvedPosition.node().type.name !== 'page'
      ) {
        resolvedPosition = view.state.doc.resolve(resolvedPosition.pos + 1)
      }

      if (
        canSplit(view.state.doc, resolvedPosition.pos, resolvedPosition.depth)
      ) {
        transaction.setMeta(pluginKey, 'split')
        transaction.setMeta('addToHistory', false)
        transaction.split(resolvedPosition.pos, resolvedPosition.depth)

        view.dispatch(transaction)
      }
    }
  })
}

function joinSplitPages(
  transactions: Transaction<any>[],
  state: EditorState<any>,
) {
  const replaceSteps: ReplaceStep[] = transactions.reduce<ReplaceStep[]>(
    (all, transaction) => [
      ...all,
      ...transaction.steps.filter(
        (step): step is ReplaceStep => step instanceof PRReplaceStep,
      ),
    ],
    [],
  )

  if (replaceSteps.length) {
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
        splits = splits.map(split => {
          return {
            pos: tr.mapping.mapResult(split.pos).pos,
            connections: split.connections.map(connection => {
              return {
                from: tr.mapping.mapResult(connection.from).pos,
                to: tr.mapping.mapResult(connection.to).pos,
              }
            }),
          }
        })

        splits = splits.map(split => {
          return {
            pos: split.pos,
            connections: split.connections.filter(connection => {
              const from = state.doc.resolve(connection.from)
              const to = state.doc.resolve(connection.to)

              return to.parentOffset === 0
            }),
          }
        })

        if (tr.getMeta(pluginKey) === 'split') {
          const step = (tr.steps[0] as unknown) as IReplaceStep
          const { pos, depth } = state.doc.resolve(
            tr.mapping.mapResult(step.from).pos,
          )
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
                  to: to.pos,
                },
              ]
            }
          }

          splits = [...splits, { pos: splitPos.pos, connections }]
        }

        return new PaginationState(splits)
      },
    },
    appendTransaction(transactions, prevState, state) {
      console.log({ transactions, prevState, state })
      if (
        transactions.length === 1 &&
        state.doc.childCount === prevState.doc.childCount - 1
      ) {
        console.log('yes')
        console.log(this.props)
      }

      if (
        transactions.length === 1 &&
        !transactions[0].getMeta(pluginKey) &&
        !transactions[0].getMeta('pointer')
      ) {
        return joinSplitPages(transactions, state)
      }
    },
    view() {
      return {
        update(view: EditorView) {
          splitPages(view)
        },
      }
    },
  })
}
