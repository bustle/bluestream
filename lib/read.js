const stream = require('stream')
const ReadableStream = stream.Readable
const { defer, maybeResume } = require('./utils')

module.exports = class PromiseReadStream extends ReadableStream {
  constructor (opts, readCb) {
    if (typeof opts === 'function') {
      readCb = opts
      opts = {}
    }

    opts = Object.assign({
      objectMode: true
    }, opts)

    if (typeof readCb === 'function') {
      opts.read = readCb
    }

    super(opts)
    this._handlingErrors = false
    this._reading = false
    this._keepReading = true
    this._ending = false
    this._streamDeferred = defer()
    this._pushQueue = new Set()
    this.wrapRead()
    this.once('end', () => this._streamDeferred.resolve())
  }

  wrapRead () {
    const readCb = this._read
    this._read = (bytes) => {
      if (this._reading) {
        return
      }
      this._reading = true
      Promise.resolve()
        .then(() => readCb.call(this, bytes))
        .then(data => {
          if (data !== undefined) {
            this.push(data)
          }
          return Promise.all(this._pushQueue)
        })
        .then(() => {
          this._reading = false
          if (this._keepReading) {
            this._read()
          }
        })
        .catch(err => this.emitError(err))
    }
  }

  push (data) {
    if (data === null) {
      return this._endingPush()
    }
    const readOperation = Promise.resolve(data)
      .then(data => {
        this._pushQueue.delete(readOperation)
        if (data === null) {
          return this._endingPush()
        }
        this._keepReading = super.push(data) && !this._ending
      })
      .catch(err => this.emitError(err))
    this._pushQueue.add(readOperation)
    return readOperation
  }

  _endingPush () {
    this._keepReading = false
    this._ending = true
    return Promise
      .all(this._pushQueue)
      .then(() => super.push(null))
      .catch(err => this.emitError(err))
  }

  emitError (e) {
    this.emit('error', e)
  }

  promise () {
    if (!this._handlingErrors) {
      this._handlingErrors = true
      this.once('error', this._streamDeferred.reject)
    }
    return maybeResume(this)._streamDeferred.promise
  }
}
