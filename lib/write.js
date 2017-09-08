const Writable = require('stream').Writable
const { defer, maybeResume } = require('./utils')

module.exports = class PromiseWriteStream extends Writable {
  constructor (opts, fn) {
    if (typeof opts === 'function') {
      fn = opts
      opts = {}
    }

    if (!opts.write && fn) {
      opts.write = fn
    }

    opts = Object.assign({
      concurrent: 1
    }, opts)

    // only if the user hasn't suggested anything about object mode do we default to object mode
    if (!('objectMode' in opts) && !('writableObjectMode' in opts)) {
      opts.objectMode = true
    }

    super(opts)
    this.wrapWrite()
    this._streamEnd = defer()
    this._handlingErrors = false
    this._concurrent = opts.concurrent
    this._queue = new Set()
    this.once('finish', () => this._streamEnd.resolve())
  }

  end (chunk, encoding, cb) {
    if (typeof chunk === 'function') {
      cb = chunk
      chunk = null
      encoding = null
    } else if (typeof encoding === 'function') {
      cb = encoding
      encoding = null
    }

    if (chunk !== null && chunk !== undefined) {
      this.write(chunk, encoding)
    }

    Promise.all(this._queue).then(() => {
      super.end(cb)
    })
  }

  wrapWrite () {
    const _fn = this._write
    this._write = function (data, encoding, done) {
      const processed = Promise.resolve()
        .then(() => _fn.call(this, data, encoding))
        .then(() => {
          this._queue.delete(processed)
        }, e => {
          this.emitError(e)
        })
      this._queue.add(processed)

      if (this._queue.size < this._concurrent) {
        return done()
      }
      Promise.race(this._queue).then(() => done(), e => this.emitError(e))
    }
  }

  emitError (error) {
    this.emit('error', error)
  }

  promise () {
    if (!this._handlingErrors) {
      this._handlingErrors = true
      this.on('error', this._streamEnd.reject)
    }
    return maybeResume(this)._streamEnd.promise
  }

  wait () {
    return this.promise()
  }
}
