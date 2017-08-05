const Promise = require('bluebird')
const Transform = require('stream').Transform
const { defer, maybeResume } = require('./utils')

function nextTick () {
  return new Promise(function (resolve, reject) {
    process.nextTick(resolve)
  })
}

module.exports = class PromiseTransformStream extends Transform {
  constructor (opts, fn) {
    if (typeof opts === 'function') {
      fn = opts
      opts = {}
    }

    if (!fn) {
      fn = data => data
    }

    opts = Object.assign({
      concurrent: 1
    }, opts)

    // only if the user hasn't suggested anything about object mode do we default to object mode
    if (!('objectMode' in opts) && !('writableObjectMode' in opts) && !('readableObjectMode' in opts)) {
      opts.objectMode = true
    }

    if (typeof fn === 'function') {
      opts.transform = fn
    }

    super(opts)
    this.wrapTransform()
    this.wrapFlush()
    this._streamEnd = defer()
    this._handlingErrors = false
    this._concurrent = opts.concurrent
    this._queue = []
  }

  wrapTransform () {
    const _fn = this._transform
    this._transform = (data, enc, done) => {
      var queue = this._queue
      var processed = Promise.resolve()
        .then(() => _fn.call(this, data, enc))
        .then(data => {
          if (data !== undefined) {
            this.push(data)
          }
        })
      processed.catch(done)
      queue.push(processed)
      if (queue.length >= this._concurrent) {
        var next = queue.shift()
        // The delay is a workaround for the bad design of
        // node streams which forbid you to call done twice
        // at the same tick on the event loop, even if you
        // had events happening at the exact same tick
        if (next.isResolved()) {
          nextTick().done(done, done)
        } else {
          next.done(done, done)
        }
      } else {
        done()
      }
    }
  }

  wrapFlush () {
    const flushCb = this._flush
    this._flush = (done) => {
      Promise.all(this._queue)
        .then(() => this._finishUp())
        .then(() => {
          if (flushCb) {
            return flushCb.call(this)
          }
        })
        .done(done, done)
    }
  }

  _finishUp () {
    this._streamEnd.resolve()
  }

  push (data) {
    return Promise.resolve(data)
      .bind(this)
      .then(super.push, this.emitError)
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
