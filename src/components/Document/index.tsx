import React from 'react'
import { EditorState, Plugin } from 'prosemirror-state'
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

const events = new Plugin({
  view(view) {
    return {
      update(view) {
        const pages = Array.from(view.dom.querySelectorAll('.page'))
        const pageIndex = pages.findIndex(page => page.scrollHeight > page.clientHeight)

        if (pageIndex > -1) {
          const pageNode = view.state.doc.child(pageIndex)
          const pageElement = pages[pageIndex]
          const pageOffset = getBottomOffset(pageElement)
          let splitAtPos: number | null = null

          Array.from(pageElement.childNodes).forEach(childElement => {
            if (splitAtPos === null && childElement instanceof HTMLElement) {
              const childNodePos = view.posAtDOM(childElement, 0)
              const childNode = view.state.doc.nodeAt(childNodePos)
              const childOffset = getBottomOffset(childElement, false)

              if (pageOffset < childOffset) {
                splitAtPos = childNodePos - 1
              }
            }
          })

          if (splitAtPos !== null) {
            view.updateState(
              view.state.apply(
                view.state.tr.split(splitAtPos)
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