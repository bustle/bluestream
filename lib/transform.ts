import { DuplexOptions, Transform } from 'stream'
import { IBluestream } from './interfaces'
import { defer, maybeResume } from './utils'

function transformHandler (this: TransformStream, data, encoding, done) {
  // This works around a bug where you cannot call done twice in a single event loop
  // https://github.com/spion/promise-streams/blob/master/index.js#L70-L73
  // We've been able to observe this bug in production but not reproduce it in tests
  // A more performance solution would be a queue of some sort because we don't always have to wait until next tick
  const finish = () => setImmediate(done)
  const processed = this.asyncTransform(data, encoding)
    .then(transformedData => {
      if (transformedData !== undefined) {
        this.push(transformedData)
      }
      this.queue.delete(processed)
    }, e => {
      this.emitError(e)
    })
  this.queue.add(processed)

  if (this.queue.size < this.concurrent) {
    return finish()
  }
  Promise.race(this.queue).then(finish, e => this.emitError(e))
}

function flushHandler (this: TransformStream, done) {
  Promise.all(this.queue)
    .then(() => {
      return this.asyncFlush && this.asyncFlush()
    })
    .then(data => done(null, data), done)
}

export type ITransformFunction = (data: string | Buffer | any, encoding: string) => Promise<any>|any

export interface ITransformStreamOptions extends DuplexOptions {
  concurrent?: number
  transform?: ITransformFunction
  flush?: () => Promise<any>|any
}

export class TransformStream extends Transform implements IBluestream {
  public concurrent: number
  protected asyncTransform: ITransformFunction
  protected asyncFlush?: () => Promise<any>
  protected queue: Set<Promise<any>>
  private handlingErrors: boolean
  private streamEnd

  constructor (inputOpts: ITransformStreamOptions | ITransformFunction, fn?: ITransformFunction) {
    if (typeof inputOpts === 'function') {
      fn = inputOpts
      inputOpts = {}
    }

    const opts = {
      concurrent: 1,
      ...fn && { transform: fn },
      ...inputOpts,
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
  (opts: ITransformStreamOptions | ITransformFunction, fn?: ITransformFunction) => new TransformStream(opts, fn)
export const map = transform
