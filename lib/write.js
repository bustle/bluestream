import { Writable } from 'stream'
import { maybeResume, defer } from './utils'

async function writeHandler (data, encoding, done) {
  const processed = this._asyncWrite(data, encoding)
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

function wrapWrite (thisStream) {
  const write = thisStream._write.bind(thisStream)
  thisStream._asyncWrite = async (data, encoding) => write(data, encoding)
  thisStream._write = writeHandler
}

export class WriteStream extends Writable {
  constructor (opts, fn) {
    if (typeof opts === 'function') {
      fn = opts
      opts = {}
    }

    if (!opts) {
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

    if (opts.concurrency) {
      throw new Error('Unknown option "concurrency" perhaps you meant "concurrent"?')
    }

    super(opts)
    wrapWrite(this)
    this._streamEnd = defer()
    this._handlingErrors = false
    this._concurrent = opts.concurrent
    this._queue = new Set()
    this.once('finish', () => this._streamEnd.resolve())
  }

  async end (chunk, encoding, cb) {
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
    try {
      await Promise.all(this._queue)
      if (this._queue.size > 0) {
        return this.end(cb)
      }
      if (this._writableState.pendingcb > 0) {
        return process.nextTick(() => this.end(cb))
      }
      Writable.prototype.end.call(this, cb)
    } catch (err) {
      this.emitError(err)
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

export const write = (opts, writeFn) => new WriteStream(opts, writeFn)
