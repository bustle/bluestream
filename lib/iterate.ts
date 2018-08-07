import { Readable } from 'stream'
import { readAsync } from '.'

if (Symbol.asyncIterator === undefined) {
  (Symbol as any).asyncIterator = Symbol.for('asyncIterator')
}

async function* iterateObjectMode (stream) {
  let data = true
  while (data) {
    data = await readAsync(stream, 1)
    if (data) {
      yield data[0]
    }
  }
}

async function* iterateBufferMode (stream) {
  let data = true
  while (data) {
    data = await readAsync(stream)
    if (data) {
      yield data
    }
  }
}

export function internalIterator (stream: Readable) {
  const readableState = (stream as any)._readableState
  const objectMode = readableState && readableState.objectMode
  if (objectMode) {
    return iterateObjectMode(stream)
  }
  return iterateBufferMode(stream)
}

export function iterate (stream: Readable) {
  if (stream[Symbol.asyncIterator]) {
    return stream
  }
  const objectMode = (stream as any)._readableState.objectMode
  if (objectMode) {
    return iterateObjectMode(stream)
  }
  return iterateBufferMode(stream)
}
