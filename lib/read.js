import { Readable } from 'stream'
import { maybeResume, defer } from './utils'

async function readHandler (bytes) {
  if (this._reading) {
    return
  }
  this._reading = true

  const readOperation = this._asyncRead(bytes)
  this._asyncQueue.add(readOperation)
  try {
    const data = await readOperation
    if (data !== undefined) {
      this.push(data)
    }
    await Promise.all(this._asyncQueue)
    this._reading = false
    if (this._keepReading) {
      this._read()
    }
  } catch (err) {
    this.emitError(err)
  } finally {
    this._asyncQueue.delete(readOperation)
  }
}

export class ReadStream extends Readable {
  constructor (opts = {}, fn) {
    if (typeof opts === 'function') {
      fn = opts
      opts = {}
    }

    opts = {
      ...fn && { read: fn },
      ...opts
    }

    // only if the user hasn't suggested anything about object mode do we default to object mode
    if (!('objectMode' in opts) && !('readableObjectMode' in opts)) {
      opts.objectMode = true
    }

    super(opts)
    this._handlingErrors = false
    this._reading = false
    this._keepReading = true
    this._ending = false
    this._streamDeferred = defer()
    this._asyncQueue = new Set()

    const read = this._read.bind(this)
    this._asyncRead = async bytes => read(bytes)
    this._read = readHandler

    this.once('end', () => this._streamDeferred.resolve())
  }

  push (data) {
    if (data === null) {
      return this._endingPush()
    }
    const pushOperation = Promise.resolve(data)
      .then(data => {
        this._asyncQueue.delete(pushOperation)
        if (data === null) {
          return this._endingPush()
        }
        this._keepReading = Readable.prototype.push.call(this, data) && !this._ending
      })
      .catch(err => this.emitError(err))
    this._asyncQueue.add(pushOperation)
    return pushOperation
  }

  async _endingPush () {
    this._keepReading = false
    this._ending = true
    try {
      await Promise.all(this._asyncQueue)
      Readable.prototype.push.call(this, null)
    } catch (err) {
      this.emit(err)
    }
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

export const read = (opts, readFn) => new ReadStream(opts, readFn)
