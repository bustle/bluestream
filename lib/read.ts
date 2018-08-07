import { Readable, ReadableOptions } from 'stream'
import { IBluestream } from './interfaces'
import { internalIterator } from './iterate'
import { readAsync } from './readAsync'
import { defer, maybeResume } from './utils'

if (Symbol.asyncIterator === undefined) {
  (Symbol as any).asyncIterator = Symbol.for('asyncIterator')
}

async function readHandler (bytes) {
  if (this.asyncReading) {
    return
  }
  this.asyncReading = true

  const readOperation = this.asyncRead(bytes)
  this.asyncQueue.add(readOperation)
  try {
    const data = await readOperation
    if (data !== undefined) {
      this.push(data)
    }
    await Promise.all(this.asyncQueue)
    this.asyncReading = false
    if (this.keepReading) {
      this._read()
    }
  } catch (err) {
    this.emitError(err)
  } finally {
    this.asyncQueue.delete(readOperation)
  }
}

export type readFunction = () => Promise<any>|any

export interface IReadableStreamOptions extends ReadableOptions {
  read?: readFunction
}

export class ReadStream extends Readable implements IBluestream {
  private handlingErrors: boolean
  private asyncReading: boolean
  private keepReading: boolean
  private isEnding: boolean
  private streamEnd
  private asyncQueue: Set<Promise<any>>
  private asyncRead: (bytes: number) => Promise<any>

  constructor (opts: IReadableStreamOptions | readFunction = {}, fn?: readFunction) {
    if (typeof opts === 'function') {
      fn = opts
      opts = {}
    }

    opts = {
      ...fn && { read: fn },
      ...opts,
    }

    // only if the user hasn't suggested anything about object mode do we default to object mode
    if (!('objectMode' in opts) && !('readableObjectMode' in opts)) {
      opts.objectMode = true
    }

    super(opts)
    this.handlingErrors = false
    this.asyncReading = false
    this.keepReading = true
    this.isEnding = false
    this.streamEnd = defer()
    this.asyncQueue = new Set()

    const readFn = this._read.bind(this)
    this.asyncRead = async bytes => readFn(bytes)
    this._read = readHandler

    this.once('end', () => this.streamEnd.resolve())
  }

  public push (data) {
    if (data === null) {
      this._endingPush()
      return false
    }
    const pushOperation = Promise.resolve(data)
      .then(asyncData => {
        this.asyncQueue.delete(pushOperation)
        if (asyncData === null) {
          return this._endingPush()
        }
        this.keepReading = Readable.prototype.push.call(this, asyncData) && !this.isEnding
      })
      .catch(err => this.emitError(err))
    this.asyncQueue.add(pushOperation)
    return this.keepReading
  }

  public _endingPush () {
    this.keepReading = false
    this.isEnding = true
    Promise.all(this.asyncQueue).then(() => {
      Readable.prototype.push.call(this, null)
    }, err => this.emit(err))
  }

  public emitError (e) {
    this.emit('error', e)
  }

  public promise () {
    if (!this.handlingErrors) {
      this.handlingErrors = true
      this.once('error', this.streamEnd.reject)
    }
    maybeResume(this)
    return this.streamEnd.promise
  }
}

ReadStream.prototype[Symbol.asyncIterator] = function () {
  return internalIterator(this)
}

export const read =
  (opts: IReadableStreamOptions | readFunction = {}, readFn?: readFunction) => new ReadStream(opts, readFn)
