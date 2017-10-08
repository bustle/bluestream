const Buffer = require('buffer').Buffer
const { maybeResume, promiseFinally, defer } = require('./utils')
const ReadStream = require('./read')
const TransformStream = require('./transform')
const FilterStream = require('./filter')
const ReduceStream = require('./reduce')
const WriteStream = require('./write')

const read = (opts, readFn) => new ReadStream(opts, readFn)
const write = (opts, writeFn) => new WriteStream(opts, writeFn)
const transform = (opts, fn) => new TransformStream(opts, fn)
const map = transform
const filter = (opts, fn) => new FilterStream(opts, fn)
const reduce = (opts, fn, initial) => new ReduceStream(opts, fn, initial)

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
  const acc = []
  return pipe(stream, write(data => acc.push(data)))
    .then(() => {
      if (acc.length === 0) {
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

function pipe () {
  const streams = Array.from(arguments)
  if (streams.length < 2) {
    throw new TypeError('Must pipe to two or more streams')
  }
  const pipeDone = defer()

  streams.forEach((stream, index) => {
    stream.on('error', pipeDone.reject)

    const lastStream = index + 1 === streams.length
    if (!lastStream) {
      const nextStream = streams[index + 1]
      stream.pipe(nextStream)
    }
  })

  const sink = streams[streams.length - 1]
  sink.on('finish', pipeDone.resolve)
  sink.on('end', pipeDone.resolve)

  return promiseFinally(pipeDone.promise, function () {
    streams.forEach(stream => {
      stream.removeListener('error', pipeDone.reject)
    })
    sink.removeListener('finish', pipeDone.resolve)
    sink.removeListener('end', pipeDone.resolve)
  })
}

module.exports = {
  // utilities
  wait,
  collect,
  pipe,
  pipeline: pipe,

  // constructors
  read,
  PromiseReadStream: ReadStream,
  ReadStream,

  transform,
  PromiseTransformStream: TransformStream,
  TransformStream,
  map,

  write,
  PromiseWriteStream: WriteStream,
  WriteStream,

  filter,
  PromiseFilterStream: FilterStream,
  FilterStream,

  reduce,
  PromiseReduceStream: ReduceStream,
  ReduceStream
}
