const Promise = require('bluebird')
const Buffer = require('buffer').Buffer
const { maybeResume } = require('./utils')
const PromiseReadStream = require('./read')
const PromiseTransformStream = require('./transform')
const PromiseMapStream = require('./map')
const PromiseFilterStream = require('./filter')
const PromiseReduceStream = require('./reduce')

function wait (stream) {
  if (typeof stream.promise === 'function') {
    return stream.promise()
  }

  return new Promise(function (resolve, reject) {
    stream.on('end', resolve)
    stream.on('finish', resolve)
    stream.on('error', reject)
    maybeResume(stream)
  })
}

function collect (stream) {
  var acc = []
  return pipe(stream, maybeResume(new PromiseTransformStream(data => {
    acc.push(data)
  }))).then(function () {
    if (!acc.length) {
      return null
    }
    if (typeof acc[0] === 'string') {
      return acc.join('')
    }
    if (Buffer.isBuffer(acc[0])) {
      return Buffer.concat(acc)
    }
    return acc
  })
}

function pipe (source, sink) {
  var _resolve, _reject
  return new Promise(function (resolve, reject) {
    _resolve = resolve
    _reject = reject
    source
      .on('error', reject)
    sink
      .on('error', reject)
      .on('finish', resolve)
      .on('end', resolve)

    source.pipe(sink)
  }).finally(function () {
    source.removeListener('error', _reject)
    sink.removeListener('error', _reject)
    sink.removeListener('finish', _resolve)
    sink.removeListener('end', _resolve)
  })
}

function pipeline () {
  var arr = []
  for (var k = 1; k < arguments.length; ++k) {
    arr.push(pipe(arguments[k - 1], arguments[k]))
  }
  return Promise.all(arr)
}

const read = (opts, readFn) => new PromiseReadStream(opts, readFn)
const transform = (opts, fn) => new PromiseTransformStream(opts, fn)
const map = (opts, fn) => new PromiseMapStream(opts, fn)
const filter = (opts, fn) => new PromiseFilterStream(opts, fn)
const reduce = (opts, fn, initial) => new PromiseReduceStream(opts, fn, initial)

module.exports = {
  // utilities
  wait,
  collect,
  pipe,
  pipeline,

  // constructors
  read,
  PromiseReadStream,
  transform,
  PromiseTransformStream,
  map,
  PromiseMapStream,
  filter,
  PromiseFilterStream,
  reduce,
  PromiseReduceStream
}
