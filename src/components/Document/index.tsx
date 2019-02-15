import React from 'react'
import { EditorState } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { undo, redo, history } from 'prosemirror-history'
import { keymap } from 'prosemirror-keymap'
import { baseKeymap } from 'prosemirror-commands'
import pagination from '../../prosemirror/plugins/pagination'
import schema from '../../prosemirror/schema'

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
  editorState: EditorState

  constructor(props: DocumentProps) {
    super(props)

    this.editorState = EditorState.create({
      schema,
      plugins: [
        history(),
        keymap({ 'Mod-z': undo, 'Mod-y': redo }),
        keymap(baseKeymap),
        pagination()
      ]
    })

    this.state = {}
  }

  componentDidMount() {
    if (this.documentRef !== null) {
      new EditorView(this.documentRef, { state: this.editorState })
    }
  }

  render() {
    return <div className="document" ref={(ref) => (this.documentRef = ref)} />
  }
}

export default Document
