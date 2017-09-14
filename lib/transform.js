const Transform = require('stream').Transform
const { defer, maybeResume } = require('./utils')

module.exports = class PromiseTransformStream extends Transform {
  constructor (opts, fn) {
    if (typeof opts === 'function') {
      fn = opts
      opts = {}
    }

    if (!opts.transform && fn) {
      opts.transform = fn
    }

    opts = Object.assign({
      concurrent: 1
    }, opts)

    // only if the user hasn't suggested anything about object mode do we default to object mode
    if (!('objectMode' in opts) && !('writableObjectMode' in opts) && !('readableObjectMode' in opts)) {
      opts.objectMode = true
    }

    super(opts)
    this.wrapTransform()
    this.wrapFlush()
    this._streamEnd = defer()
    this._handlingErrors = false
    this._concurrent = opts.concurrent
    this._queue = new Set()
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
      if (this._queue.size > 0) {
        return this.end(cb)
      }
      super.end(cb)
    }, e => this.emitError(e))
  }

  wrapTransform () {
    const _fn = this._transform
    this._transform = function (data, encoding, done) {
      const processed = Promise.resolve()
        .then(() => _fn.call(this, data, encoding))
        .then(data => {
          if (data !== undefined) {
            return this.push(data)
          }
        })
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

  wrapFlush () {
    const flushCb = this._flush
    this._flush = (done) => {
      Promise.all(this._queue)
        .then(() => this._streamEnd.resolve())
        .then(() => {
          if (flushCb) {
            return flushCb.call(this)
          }
        })
        .then(data => done(null, data), done)
    }
  }

  push (data) {
    return Promise.resolve(data)
      .then(
        data => super.push(data),
        err => this.emitError(err)
      )
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
