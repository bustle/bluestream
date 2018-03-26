import { ITransformStreamOptions, TransformStream } from './transform'

export type filterFunc = (data: any, encoding?: string) => boolean | Promise<boolean>

export class FilterStream extends TransformStream {
  private filterFunction: filterFunc

  constructor (opts: ITransformStreamOptions | filterFunc, filterFunction?: filterFunc) {
    if (typeof opts === 'function') {
      filterFunction = opts
      opts = {}
    }
    super(opts)
    this.filterFunction = filterFunction
  }

  public async _transform (data, encoding) {
    const keep = await Promise.resolve(this.filterFunction(data, encoding))
    if (keep) {
      await this.push(data)
    }
  }
}

export const filter = (opts: ITransformStreamOptions | filterFunc, fn?: filterFunc) => new FilterStream(opts, fn)
