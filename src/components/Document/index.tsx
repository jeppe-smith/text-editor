import React from 'react'
import { EditorState } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { undo, redo, history } from 'prosemirror-history'
import { keymap } from 'prosemirror-keymap'
import { baseKeymap } from 'prosemirror-commands'
import { NodeSpec, Schema } from 'prosemirror-model'
import pagination from '../../plugins/pagination'

function createNode(options: NodeSpec) {
  return options
}

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
      },
      attrs: {
        'origin': { default: null }
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
        history(),
        keymap({"Mod-z": undo, "Mod-y": redo}),
        keymap(baseKeymap),
        pagination,
      ]
    })

    this.state = {
      
    }
  }

  componentDidMount() {
    if (this.documentRef !== null) {
      const editorView = new EditorView(
        this.documentRef,
        {
          state: this.editorState,
          dispatchTransaction(transaction) {
            // console.log(transaction)
            const newState = editorView.state.apply(transaction);
            editorView.updateState(newState);
          }
        }
      )

      this.editorView = editorView
    }
  }

  render() {
    return (
      <div className="document" ref={ref => this.documentRef = ref}></div>
    )
  }
}

export default Document