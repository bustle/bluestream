const PromiseTransformStream = require('./transform')

module.exports = class PromiseMapStream extends PromiseTransformStream {
  constructor (opts, fn) {
    super(opts, fn)
    this._filterFn = this._fn
    this._fn = data => {
      if (this._filterFn(data)) {
        return this.push(data)
      }
    }
  }
}
