import { Readable } from 'stream'
import { defer } from './utils'

const readOnceAsync = async (stream: Readable, count?: number) => {
  const data = stream.read(count)
  if (data !== null) {
    return data
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

export const readAsync = async (stream, count) => {
  if (!(stream && stream._readableState)) {
    throw new TypeError('"stream" is not a readable stream')
  }
  if (stream._readableState.flowing) {
    // tslint:disable-next-line
    throw new TypeError('"stream" is in flowing mode, this is probably not what you want as data loss could occur. Please use stream.pause() to pause the stream before calling readAsync.');
  }

  const objectMode = stream._readableState.objectMode
  const { resolve, reject, promise } = defer()

  const cleanup = () => {
    stream.removeListener('error', reject)
  }

  stream.once('error', reject)

  if (objectMode) {
    const objects = []
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
