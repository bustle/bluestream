import { TransformStream } from './transform'

async function reduceStreamFn (value, encoding) {
  const currentValue = await Promise.resolve(value)
  if (this._acc === undefined) {
    this._acc = currentValue
  } else {
    this._acc = await Promise.resolve(this._reduceFn(this._acc, currentValue, encoding))
  }
  return this.push(this._acc)
}

export class ReduceStream extends TransformStream {
  constructor (opts, reduceFn, initial) {
    if (typeof opts === 'function') {
      initial = reduceFn
      reduceFn = opts
      opts = {}
    }

    super(opts, reduceStreamFn)
    this._reduceFn = reduceFn
    this._acc = initial
  }

  async promise () {
    await TransformStream.prototype.promise.call(this)
    return this._acc
  }
}

export const reduce = (opts, fn, initial) => new ReduceStream(opts, fn, initial)
