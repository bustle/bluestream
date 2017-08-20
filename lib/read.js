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
    this._keepReading = false
    this._streamDeferred = defer()
    this.wrapRead()
    this.once('end', () => this._streamDeferred.resolve())
  }

  wrapRead () {
    const readCb = this._read
    this._read = (bytes) => {
      this._keepReading = true
      if (this._reading) {
        return
      }
      this._reading = true
      Promise.resolve()
        .then(() => readCb.call(this, bytes))
        .then(data => {
          this._reading = null
          if (data !== undefined) {
            this.push(data)
          }
          if (this._keepReading) {
            this._read()
          }
        }, this.emitError)
    }
  }

  push (data) {
    return Promise.resolve(data)
      .then(data => {
        this._keepReading = super.push(data)
      }, err => {
        this.emitError(err)
      })
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
