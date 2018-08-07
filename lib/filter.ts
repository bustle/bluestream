import { ITransformStreamOptions, TransformStream } from './transform'

export type filterFunc = (data: any, encoding?: string) => boolean | Promise<boolean>

export class FilterStream extends TransformStream {
  private filterFunction: filterFunc

  constructor (opts: ITransformStreamOptions | filterFunc, filterFunction?: filterFunc) {
    if (typeof opts === 'function') {
      super({})
      this.filterFunction = opts
    } else if (typeof filterFunction === 'function') {
      super(opts)
      this.filterFunction = filterFunction
    } else {
      throw TypeError('No "filterFunction" provided')
    }
  }

  public async _transform (data, encoding) {
    const keep = await this.filterFunction(data, encoding)
    if (keep) {
      await this.push(data)
    }
  }
}

export const filter = (opts: ITransformStreamOptions | filterFunc, fn?: filterFunc) => new FilterStream(opts, fn)
