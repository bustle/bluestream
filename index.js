const Promise = require('bluebird')
const util = require('util')
const stream = require('stream')
const Buffer = require('buffer').Buffer
const ReadableStream = stream.Readable
const Transform = stream.Transform

function nothing (x) { }
function identity (x) { return x }

function defer () {
  var resolveCb, rejectCb
  var promise = new Promise(function (resolve, reject) {
    resolveCb = resolve
    rejectCb = reject
  })
  return { resolve: resolveCb, reject: rejectCb, promise: promise }
}

function defaults (opts, fn, end) {
  if (typeof opts === 'function') {
    end = fn; fn = opts; opts = {}
  }
  if (fn == null) { fn = identity }
  if (opts.objectMode == null) { opts.objectMode = true }
  return {opts: opts, fn: fn, end: end}
}

function nextTick () {
  return new Promise(function (resolve, reject) {
    process.nextTick(resolve)
  })
}

function maybeResume (stream) {
  if (typeof stream.resume === 'function') {
    stream.resume()
  }
  return stream
}

// ---------------------------------------
// PromiseTransformStream
// ---------------------------------------

util.inherits(PromiseTransformStream, Transform)
function PromiseTransformStream (opts, fn, end) {
  if (!(this instanceof PromiseTransformStream)) { return new PromiseTransformStream(opts, fn, end) }
  var args = defaults(opts, fn, end)
  Transform.call(this, args.opts)
  this._fn = args.fn
  this._end = args.end
  this._streamEnd = defer()
  this._handlingErrors = false
  this._concurrent = Math.max(1, args.opts.concurrent || 1)
  this._queue = []
}

PromiseTransformStream.prototype._transform = incoming
function incoming (data, enc, done) {
  var queue = this._queue
  var processed = Promise.resolve([data, enc])
    .bind(this)
    .spread(this._fn)
    .then(nothing)
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

PromiseTransformStream.prototype._flush = complete
function complete (done) {
  if (!this._end) { this._end = nothing }
  Promise.all(this._queue)
    .then(nothing)
    .bind(this)
    .then(this._end)
    .then(this._finishUp)
    .done(done, done)
}

PromiseTransformStream.prototype._finishUp = function () {
  this._streamEnd.resolve()
}

PromiseTransformStream.prototype.push = push
function push (data) {
  return Promise.resolve(data)
    .bind(this)
    .then(Transform.prototype.push, this.emitError)
}

PromiseTransformStream.prototype.emitError = emitError
function emitError (e) {
  this.emit('error', e)
}

PromiseTransformStream.prototype.map = map
function map (opts, fn, end) {
  var mstream = new MapPromiseTransformStream(opts, fn)
  this.pipe(mstream)
  return mstream
}

PromiseTransformStream.prototype.filter = filter
function filter (opts, fn) {
  var fstream = new FilterPromiseTransformStream(opts, fn)
  this.pipe(fstream)
  return fstream
}

PromiseTransformStream.prototype.reduce = reduce
function reduce (opts, fn, initial) {
  var reducer = new ReducePromiseTransformStream(opts, fn, initial)
  this.pipe(reducer)
  return reducer.promise()
}

PromiseTransformStream.prototype.wait =
PromiseTransformStream.prototype.promise = promise
function promise () {
  if (!this._handlingErrors) {
    this._handlingErrors = true
    this.on('error', this._streamEnd.reject)
  }
  return maybeResume(this)._streamEnd.promise
}

// ---------------------------------------
// PromiseReadStream
// ---------------------------------------

class PromiseReadStream extends ReadableStream {
  constructor (opts, readCb) {
    if (typeof opts === 'function') {
      readCb = opts
      opts = { objectMode: true }
    }
    if (typeof readCb === 'function') {
      opts.read = readCb
    }

    super(opts)
    this._handlingErrors = false
    this._reading = false
    this._keepReading = false
    this._streamEnd = defer()
    this.wrapRead()
    this.once('end', this._finishUp)
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

  _finishUp () {
    this._streamEnd.resolve()
  }

  promise () {
    if (!this._handlingErrors) {
      this._handlingErrors = true
      this.once('error', this._streamEnd.reject)
    }
    return maybeResume(this)._streamEnd.promise
  }
}

// ---------------------------------------
// MapPromiseTransformStream
// ---------------------------------------

util.inherits(MapPromiseTransformStream, PromiseTransformStream)
function MapPromiseTransformStream (opts, fn) {
  if (!(this instanceof MapPromiseTransformStream)) { return new MapPromiseTransformStream(opts, fn) }
  PromiseTransformStream.call(this, opts, fn)
  this._mapfn = this._fn
  this._fn = mapStreamFn
}

function mapStreamFn (el) {
  return this.push(this._mapfn(el))
}

// ---------------------------------------
// FilterPromiseTransformStream
// ---------------------------------------

util.inherits(FilterPromiseTransformStream, PromiseTransformStream)
function FilterPromiseTransformStream (opts, fn) {
  if (!(this instanceof FilterPromiseTransformStream)) { return new FilterPromiseTransformStream(opts, fn) }
  PromiseTransformStream.call(this, opts, fn)
  this._filterFn = this._fn
  this._fn = filterStreamFn
}

function filterStreamFn (el) {
  if (this._filterFn(el)) { return this.push(el) }
}

// ---------------------------
// ReducePromiseTransformStream
// ---------------------------

util.inherits(ReducePromiseTransformStream, PromiseTransformStream)
function ReducePromiseTransformStream (opts, fn, initial) {
  if (!(this instanceof ReducePromiseTransformStream)) { return new ReducePromiseTransformStream(opts, fn, initial) }
  PromiseTransformStream.call(this, opts, fn)
  this._reducefn = this._fn
  this._reduceResult = defer()
  this._initial = this._end
  this._acc = null

  this._fn = reduceStreamFn
  this._end = reduceStreamEnd

  this.on('error', this._reduceResult.reject)
}

ReducePromiseTransformStream.prototype.wait =
ReducePromiseTransformStream.prototype.promise = reduceStreamPromise
function reduceStreamPromise () {
  return maybeResume(this)._reduceResult.promise
}

function reduceStreamFn (el, enc) {
  var initial = this._initial
  var acc = this._acc
  if (acc === null) {
    acc = typeof (initial) !== 'undefined'
      ? Promise.cast(initial)
      : Promise.cast(el)
  } else {
    acc = Promise.join(acc, el, enc).spread(this._reducefn)
  }
  this._acc = acc
  return this.push(acc)
}

function reduceStreamEnd () {
  return Promise.resolve(this._acc)
    .then(this._reduceResult.resolve)
}

// ---------------------------
// wait
// ---------------------------

function waitStream (s) {
  return new Promise(function (resolve, reject) {
    s.on('end', resolve)
    s.on('finish', resolve)
    s.on('error', reject)
    maybeResume(s)
  })
}

function collect (s) {
  var acc = []
  return pipe(s, maybeResume(PromiseTransformStream(function (data) {
    acc.push(data)
  }))).then(function () {
    if (!acc.length) {
      return null
    }
    if (typeof acc[0] === 'string') {
      return acc.join('')
    }
    if (Buffer.isBuffer(typeof acc[0])) {
      return Buffer.concat(acc)
    }
    return acc
  })
}

// ---------------------------
// pipe
// ---------------------------

function pipe (source, sink) {
  var _resolve, _reject
  return new Promise(function (resolve, reject) {
    _resolve = resolve
    _reject = reject
    source
      .on('error', reject)
      .pipe(sink)
      .on('error', reject)
      .on('finish', resolve)
      .on('end', resolve)
  }).finally(function () {
    source.removeListener('end', _resolve)
    source.removeListener('error', _reject)
    sink.removeListener('error', _reject)
  })
}

// ---------------------------
// pipeline
// ---------------------------

function pipeline () {
  var arr = []
  for (var k = 1; k < arguments.length; ++k) {
    arr.push(pipe(arguments[k - 1], arguments[k]))
  }
  return Promise.all(arr)
}

// API
exports.PromiseReadStream = PromiseReadStream
exports.read = (opts, readFn) => new PromiseReadStream(opts, readFn)
exports.PromiseTransformStream = PromiseTransformStream
exports.through = (opts, fn, end) => new PromiseTransformStream(opts, fn, end)
exports.map = MapPromiseTransformStream
exports.filter = FilterPromiseTransformStream
exports.reduce = ReducePromiseTransformStream
exports.wait = waitStream
exports.pipe = pipe
exports.pipeline = pipeline
exports.collect = collect
