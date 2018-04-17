import { DuplexOptions, Transform } from 'stream'
import { IBluestream } from './interfaces'
import { defer, maybeResume } from './utils'

async function transformHandler (data, encoding, done) {
  const processed = this.asyncTransform(data, encoding)
    .then(async transformedData => {
      if (transformedData !== undefined) {
        await this.push(transformedData)
      }
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

function flushHandler (done) {
  Promise.all(this.queue)
    .then(() => {
      return this.asyncFlush()
    })
    .then(data => done(null, data), done)
}

export type transformFunction = (data: string | Buffer | any, encoding: string) => Promise<any>|any

export interface ITransformStreamOptions extends DuplexOptions {
  concurrent?: number
  transform?: transformFunction
  flush?: () => Promise<any>|any
}

export class TransformStream extends Transform implements IBluestream {
  public concurrent: number
  private asyncFlush: () => Promise<any>
  private asyncTransform: transformFunction
  private handlingErrors: boolean
  private queue: Set<Promise<any>>
  private streamEnd
  // tslint:disable-next-line
  private _flush: (done: (err, data) => void) => void;

  constructor (opts: ITransformStreamOptions | transformFunction, fn?: transformFunction) {
    if (typeof opts === 'function') {
      fn = opts
      opts = {}
    }

    opts = {
      concurrent: 1,
      ...fn && { transform: fn },
      ...opts,
    }

    // only if the user hasn't suggested anything about object mode do we default to object mode
    if (!('objectMode' in opts) && !('writableObjectMode' in opts) && !('readableObjectMode' in opts)) {
      opts.objectMode = true
    }

    if ((opts as any).concurrency) {
      throw new Error('Unknown option "concurrency" perhaps you meant "concurrent"?')
    }

    super(opts)

    const transformFunc = this._transform.bind(this)
    this.asyncTransform = async (data, encoding) => transformFunc(data, encoding)
    this._transform = transformHandler

    if (this._flush) {
      const flush = this._flush.bind(this)
      this.asyncFlush = async () => flush()
      this._flush = flushHandler
    }

    this.streamEnd = defer()
    this.handlingErrors = false
    this.concurrent = opts.concurrent
    this.queue = new Set()
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
        setImmediate(() => this.end(cb))
        return
      }
      Transform.prototype.end.call(this, cb)
    } catch (err) {
      this.emitError(err)
    }
  }

  public push (data) {
    Promise.resolve(data).then(value => {
      Transform.prototype.push.call(this, value)
    }, err => this.emitError(err))
    return true
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
}

export const transform =
  (opts: ITransformStreamOptions | transformFunction, fn?: transformFunction) => new TransformStream(opts, fn)
export const map = transform
