import { pipe } from './pipe'
import { write } from './write'

export async function collect (stream) {
  const acc = []
  await pipe(stream, write(data => { acc.push(data) }))
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
}
