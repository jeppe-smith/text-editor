import * as PromisemirrorTransform from 'prosemirror-transform'

declare module 'prosemirror-transform' {
  export interface PromisemirrorTransform {}
  /**
   * Replace a part of the document with a slice of new content.
   */
  export class ReplaceStep<S extends Schema = any> extends Step<S> {
    /**
     * The given `slice` should fit the 'gap' between `from` and
     * `to`—the depths must line up, and the surrounding nodes must be
     * able to be joined with the open sides of the slice. When
     * `structure` is true, the step will fail if the content between
     * from and to is not just a sequence of closing and then opening
     * tokens (this is to guard against rebased replace steps
     * overwriting something they weren't supposed to).
     */
    constructor(from: number, to: number, slice: Slice<S>, structure?: boolean);

    from: number
  }
}