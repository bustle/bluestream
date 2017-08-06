const PromiseTransformStream = require('./transform')

function reduceStreamFn (el, encoding) {
  if (this._acc === undefined) {
    this._acc = Promise.resolve(el)
  } else {
    this._acc = Promise.all([this._acc, el]).then(args => this._reduceFn(args[0], args[1], encoding))
  }
  return this.push(this._acc)
}

module.exports = class PromiseReduceStream extends PromiseTransformStream {
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

  promise () {
    return super.promise().then(() => this._acc)
  }
}
