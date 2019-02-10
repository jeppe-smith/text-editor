import { Schema, NodeSpec } from 'prosemirror-model'
import { schema } from 'prosemirror-schema-basic';

function createNode(options: NodeSpec) {
  return options
}

schema

export default new Schema({
  nodes: {
    doc: createNode({
      content: 'page+'
    }),
    page: createNode({
      content: 'block+',
      parseDOM: [{ tag: '.page' }],
      toDOM() {
        return ['div', { class: 'page' }, 0]
      }
    }),
    paragraph: createNode({
      content: 'inline*',
      group: 'block',
      parseDOM: [{
        tag: 'p',
        getAttrs(dom) {
          return {
            'origin': (dom as Element).getAttribute('origin')
          }
        }
      }],
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
