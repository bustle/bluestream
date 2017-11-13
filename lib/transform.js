import { defer, maybeResume } from './utils'
import { Transform } from 'stream'

async function transformHandler (data, encoding, done) {
  const processed = this._asyncTransform(data, encoding)
    .then(async data => {
      if (data !== undefined) {
        await this.push(data)
      }
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

function wrapTransform (thisStream) {
  const transform = thisStream._transform.bind(thisStream)
  thisStream._asyncTransform = async (data, encoding) => transform(data, encoding)
  thisStream._transform = transformHandler
}

function flushHandler (done) {
  Promise.all(this._queue)
    .then(() => {
      this._streamEnd.resolve()
      if (this._asyncFlush) {
        return this._asyncFlush()
      }
    })
    .then(data => done(null, data), done)
}

function wrapFlush (thisStream) {
  thisStream._asyncFlush = thisStream._flush
  thisStream._flush = flushHandler
}

export class TransformStream extends Transform {
  constructor (opts, fn) {
    if (typeof opts === 'function') {
      fn = opts
      opts = {}
    }

    if (!opts) {
      opts = {}
    }

    if (!opts.transform && fn) {
      opts.transform = fn
    }

    opts = {
      concurrent: 1,
      ...opts
    }

    // only if the user hasn't suggested anything about object mode do we default to object mode
    if (!('objectMode' in opts) && !('writableObjectMode' in opts) && !('readableObjectMode' in opts)) {
      opts.objectMode = true
    }

    if (opts.concurrency) {
      throw new Error('Unknown option "concurrency" perhaps you meant "concurrent"?')
    }

    super(opts)
    wrapTransform(this)
    wrapFlush(this)
    this._streamEnd = defer()
    this._handlingErrors = false
    this._concurrent = opts.concurrent
    this._queue = new Set()
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
        process.nextTick(() => this.end(cb))
        return
      }
      Transform.prototype.end.call(this, cb)
    } catch (err) {
      this.emitError(err)
    }
  }

  async push (data) {
    try {
      Transform.prototype.push.call(this, await Promise.resolve(data))
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
}

export const transform = (opts, fn) => new TransformStream(opts, fn)
export const map = transform
