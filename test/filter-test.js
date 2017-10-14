import { Readable } from 'stream'
import * as bstream from '../lib'

function numbers () {
  const arr = [1, 2, 3, 4, 5, 6, null]
  return new Readable({
    objectMode: true,
    read () {
      const value = arr.shift()
      this.push(value)
    }})
}

describe('FilterStream', () => {
  it('Filters based upon the passed in function', async () => {
    const filter = bstream.filter(data => (data % 2) === 0)
    numbers().pipe(filter)
    const evenNumbers = await bstream.collect(filter)
    assert.deepEqual(evenNumbers, [2, 4, 6])
  })

  it('Filters based upon the passed in async function', async () => {
    const filter = bstream.filter(async data => (data % 2) === 0)
    numbers().pipe(filter)
    const evenNumbers = await bstream.collect(filter)
    assert.deepEqual(evenNumbers, [2, 4, 6])
  })
})
