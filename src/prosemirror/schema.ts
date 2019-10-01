import { Schema, NodeSpec } from 'prosemirror-model'
import { tableNodes } from 'prosemirror-tables'

function createNode(options: NodeSpec) {
  return options
}

const schema = new Schema({
  nodes: {
    doc: createNode({
      content: 'page+',
    }),
    page: createNode({
      content: 'block+',
      parseDOM: [{ tag: '.page' }],
      toDOM() {
        return ['div', { class: 'page' }, 0]
      },
    }),
    paragraph: createNode({
      content: 'inline*',
      group: 'block',
      parseDOM: [
        {
          tag: 'p',
        },
      ],
      toDOM() {
        return ['p', 0]
      },
    }),
    text: createNode({ group: 'inline' }),
  },
})

export default schema
