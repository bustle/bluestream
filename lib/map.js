const PromiseTransformStream = require('./transform')

module.exports = class PromiseMapStream extends PromiseTransformStream {
  constructor (opts, fn) {
    super(opts, fn)
    this._mapfn = this._fn
    this._fn = data => this.push(this._mapfn(data))
  }
}
