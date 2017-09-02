const PromiseTransformStream = require('./transform')

module.exports = class PromiseFilterStream extends PromiseTransformStream {
  constructor (opts, filterFunction) {
    if (typeof opts === 'function') {
      filterFunction = opts
      opts = {}
    }
    super(opts)
    this._filterFunction = filterFunction
  }

  _transform (data, encoding) {
    return Promise.resolve(this._filterFunction(data, encoding))
      .then(keep => {
        if (keep) {
          this.push(data)
        }
      })
  }
}
