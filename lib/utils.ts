import { Readable, Stream } from 'stream'
import { IBluestream } from './interfaces'

export interface IDeferable {
  promise: Promise<any>
  reject: (error: Error) => void
  resolve: (data?: any) => void
}

export function defer (): IDeferable {
  let resolveCb
  let rejectCb
  const promise: Promise<any> = new Promise((resolve, reject) => {
    resolveCb = resolve
    rejectCb = reject
  })
  return {
    promise,
    reject: (rejectCb as unknown) as ((error: Error) => void),
    resolve: (resolveCb as unknown) as ((data?: any) => void),
  }
}

export function maybeResume (stream: Stream) {
  if (typeof (stream as Readable).resume === 'function') {
    (stream as Readable).resume()
  }
  return stream
}

export async function wait (stream: Stream) {
  if (typeof (stream as IBluestream).promise === 'function') {
    return (stream as IBluestream).promise()
  }

  return new Promise((resolve, reject) => {
    stream.on('end', resolve)
    stream.on('finish', resolve)
    stream.on('error', reject)
    maybeResume(stream)
  })
}
