import React from 'react'
import { EditorState, Plugin, TextSelection } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { undo, redo, history } from 'prosemirror-history'
import { keymap } from 'prosemirror-keymap'
import { baseKeymap } from 'prosemirror-commands'
import { NodeSpec, Schema } from 'prosemirror-model'
import { Transform } from 'prosemirror-transform'
import getNodeDimensions from 'get-node-dimensions'

function createNode(options: NodeSpec) {
  return options
}

function getBottomOffset(element: Element, subtractPadding = true) {
  const paddingBottom = parseInt(getComputedStyle(element).paddingBottom || '0')
  const { bottom } = element.getBoundingClientRect()
  const { scrollY } = window
  let bottomOffset = bottom + scrollY

  if (subtractPadding) {
    bottomOffset -= paddingBottom
  }

  return bottomOffset
}

function getStylePropertyValue(element: Element, property: string) {
  return parseInt( getComputedStyle(element).getPropertyValue(property) || '0' )
}

function getInnerCoords(element: Element) {
  const { top, right, bottom, left } = element.getBoundingClientRect()
  const { scrollY, scrollX } = window
  const paddingTop = getStylePropertyValue(element, 'padding-top')
  const paddingRight = getStylePropertyValue(element, 'padding-right')
  const paddingBottom = getStylePropertyValue(element, 'padding-bottom')
  const paddingLeft = getStylePropertyValue(element, 'padding-left')

  return {
    top: top + scrollY + paddingTop,
    right: right + scrollX - paddingRight,
    bottom: bottom + scrollY - paddingBottom - paddingTop,
    left: left + scrollX + paddingLeft,
  }
}

const events = new Plugin({
  view(view) {
    return {
      update(view) {
        const pages = Array.from(view.dom.querySelectorAll('.page'))
        const pageIndex = pages.findIndex(page => page.scrollHeight > page.clientHeight)

        if (pageIndex > -1) {
          const { scrollX, scrollY } = window
          const pageElement = pages[pageIndex]
          const { bottom, right } = getInnerCoords(pageElement)
          let pos

          window.scrollTo(right, bottom)

          pos = view.posAtCoords({ top: bottom - 24, left: right - 8 })

          window.scrollTo(scrollX, scrollY)

          if (pos != null) {
            const resolvedPos = view.state.doc.resolve(pos.pos)
            const step = view.state.tr.split(resolvedPos.pos, resolvedPos.depth)
            const newState = view.state.apply(step)

            view.updateState(
              view.state.apply(
                view.state.tr.split(resolvedPos.pos, resolvedPos.depth)
              )
            )
          }
        }
      }
    }
  }
})

const schema = new Schema({
  nodes: {
    doc: createNode({
      content: 'page+'
    }),
    page: createNode({
      content: 'block+',
      toDOM() {
        return ['div', { class: 'page' }, 0]
      }
    }),
    paragraph: createNode({
      content: 'inline*',
      group: 'block',
      toDOM() {
        return ['p', 0]
      }
    }),
    text: createNode({ group: 'inline' }),
  }
})

type OwnProps = {}
type StateProps = {}
type DispatchProps = {}
type DocumentProps = OwnProps & StateProps & DispatchProps
type DocumentState = {}

/**
 * A text editor document.
 */
class Document extends React.PureComponent<DocumentProps, DocumentState> {
  documentRef: HTMLDivElement | null = null
  editorView: EditorView | null = null
  editorState: EditorState

  constructor(props: DocumentProps) {
    super(props)

    this.editorState = EditorState.create({
      schema,
      plugins: [
        events,
        history(),
        keymap({"Mod-z": undo, "Mod-y": redo}),
        keymap(baseKeymap)
      ]
    })

    this.state = {
      
    }
  }

  componentDidMount() {
    if (this.documentRef !== null) {
      this.editorView = new EditorView(
        this.documentRef,
        {
          state: this.editorState
        }
      )
    }
  }

  render() {
    return (
      <div className="document" ref={ref => this.documentRef = ref}></div>
    )
  }
}

export default Document