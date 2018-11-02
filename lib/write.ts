import { Writable, WritableOptions } from 'stream'
import { IBluestream } from './interfaces'
import { defer, maybeResume } from './utils'

async function writeHandler (this: WriteStream, data, encoding, done) {
  const processed = this.asyncWrite(data, encoding)
    .then(() => {
      this.queue.delete(processed)
    }, e => {
      this.emitError(e)
    })
  this.queue.add(processed)

  if (this.queue.size < this.concurrent) {
    return done()
  }
  Promise.race(this.queue).then(() => done(), e => this.emitError(e))
}

export type IWriteFunction = (data: any, encoding: string) => Promise<void> | void | any

export interface IWritableStreamOptions extends WritableOptions {
  concurrent?: number
  write?: IWriteFunction
}

export class WriteStream extends Writable implements IBluestream {
  public concurrent: number
  protected asyncWrite: IWriteFunction
  protected queue: Set<Promise<any>>
  private handlingErrors: boolean
  private streamEnd

  constructor (inputOpts: IWritableStreamOptions | IWriteFunction, fn?: IWriteFunction) {
    if (typeof inputOpts === 'function') {
      fn = inputOpts
      inputOpts = {}
    }

    const opts = {
      concurrent: 1,
      ...fn && { write: fn },
      ...inputOpts,
    }

    // only if the user hasn't suggested anything about object mode do we default to object mode
    if (!('objectMode' in opts) && !('writableObjectMode' in opts)) {
      opts.objectMode = true
    }

    if ((opts as any).concurrency) {
      throw new Error('Unknown option "concurrency" perhaps you meant "concurrent"?')
    }

    super(opts)
    this.streamEnd = defer()
    this.handlingErrors = false
    this.concurrent = opts.concurrent
    this.queue = new Set()

    const writeFn = this._write.bind(this)
    this.asyncWrite = async (data, encoding) => writeFn(data, encoding)
    this._write = writeHandler

    this.once('finish', () => this.streamEnd.resolve())
  }

  public async end (chunk?, encoding?, cb?) {
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
      await Promise.all(this.queue)
      if (this.queue.size > 0) {
        return this.end(cb)
      }
      if ((this as any)._writableState.pendingcb > 0) {
        return setImmediate(() => this.end(cb))
      }
      Writable.prototype.end.call(this, cb)
    } catch (err) {
      this.emitError(err)
    }
  }

  public emitError (error) {
    this.emit('error', error)
  }

  public promise () {
    if (!this.handlingErrors) {
      this.handlingErrors = true
      this.on('error', this.streamEnd.reject)
    }
    maybeResume(this)
    return this.streamEnd.promise
  }

  public wait () {
    return this.promise()
  }
}

export const write = (opts: IWritableStreamOptions | IWriteFunction, fn?: IWriteFunction) => new WriteStream(opts, fn)
