import { Readable, Writable } from 'stream'
import { defer, wait } from './utils'

export async function pipe (readable: Readable, ...writableStreams: Writable[]) {
  const streams = [readable, ...writableStreams]
  if (streams.length < 2) {
    throw new TypeError('Must pipe to two or more streams')
  }
  const { promise, reject } = defer()

  streams.forEach((stream, index) => {
    stream.on('error', reject)

    const lastStream = index + 1 === streams.length
    if (!lastStream) {
      const nextStream = streams[index + 1]
      stream.pipe((nextStream as Writable))
    }
  })

  const sink = streams[streams.length - 1]

  try {
    return await Promise.race([wait(sink), promise])
  } finally {
    streams.forEach(stream => {
      stream.removeListener('error', reject)
    })
  }
}
