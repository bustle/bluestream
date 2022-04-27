import { Readable } from 'stream'
import { defer } from './utils'

const readOnceAsync = async (stream: Readable, count?: number) => {
  const data = stream.read(count)
  if (data !== null) {
    return data
  }
  if ((stream as any)._readableState.ended) {
    return null
  }
  return new Promise(resolve => {
    stream.once('readable', () => {
      const nextData = stream.read(count)
      if (nextData === null) {
        return resolve(stream.read())
      }
      resolve(nextData)
    })
  })
}

const internalReadAsync = async (stream: Readable, count?: number): Promise<any[] | null> => {
  const { resolve, reject, promise } = defer()
  const readableState = (stream as any)._readableState
  const objectMode = readableState && readableState.objectMode

  const cleanup = () => {
    stream.removeListener('error', reject)
  }

  stream.once('error', reject)

  if (objectMode) {
    const objects: any[] = []
    for (let index = 0; index < (count || 1); index++) {
      const obj = await readOnceAsync(stream)
      if (obj === null) {
        cleanup()
        if (objects.length === 0) {
          return null
        }
        return objects
      }
      objects.push(obj)
    }
    cleanup()
    resolve(objects)
  } else {
    const data = await readOnceAsync(stream, count)
    cleanup()
    return data
  }
  return promise
}

const inflightReads = new WeakMap()
export const readAsync = async (stream: Readable, count?: number) => {
  if (!(stream && (stream as any)._readableState)) {
    throw new TypeError('"stream" is not a readable stream')
  }
  if ((stream as any)._readableState.flowing) {
    throw new TypeError('"stream" is in flowing mode, this is probably not what you want as data loss could occur. Please use stream.pause() to pause the stream before calling readAsync.');
  }

  const inflightRead = inflightReads.get(stream)
  if (inflightRead) {
    const queuedRead = inflightRead.then(() => internalReadAsync(stream, count))
    inflightReads.set(stream, queuedRead)
    return queuedRead
  }
  const readOperation = internalReadAsync(stream, count)
  inflightReads.set(stream, readOperation)
  return readOperation
}
