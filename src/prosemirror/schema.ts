import { Schema, NodeSpec } from 'prosemirror-model'

function createNode(options: NodeSpec) {
  return options
}

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
      toDOM(node) {
        return ['p', { ...node.attrs }, 0]
      },
      attrs: {
        'origin': { default: null }
      }
    }),
    text: createNode({ group: 'inline' }),
  }
})
