import { defer } from './utils'

export async function pipe () {
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

  try {
    await pipeDone.promise
  } finally {
    streams.forEach(stream => {
      stream.removeListener('error', pipeDone.reject)
    })
    sink.removeListener('finish', pipeDone.resolve)
    sink.removeListener('end', pipeDone.resolve)
  }
}
