import { TransformStream } from './transform'

export class FilterStream extends TransformStream {
  constructor (opts, filterFunction) {
    if (typeof opts === 'function') {
      filterFunction = opts
      opts = {}
    }
    super(opts)
    this._filterFunction = filterFunction
  }

  async _transform (data, encoding) {
    const keep = await Promise.resolve(this._filterFunction(data, encoding))
    if (keep) {
      await this.push(data)
    }
  }
}

export const filter = (opts, fn) => new FilterStream(opts, fn)
