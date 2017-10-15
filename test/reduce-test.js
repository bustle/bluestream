import { Readable } from 'stream'
import * as bstream from '../lib'

function objects () {
  const arr = [1, 2, 3, 4, 5, 6]
  return new Readable({
    objectMode: true,
    read () {
      const value = arr.shift()
      this.push(value ? { value } : null)
    }})
}

describe('ReduceStream', () => {
  it('.promise() resolves the end result', async () => {
    const reduce = bstream.reduce(async (acc, el) => acc + el.value, 0)
    objects().pipe(reduce)
    const total = await reduce.promise()
    assert.equal(total, 21)
  })

  it('emits the accumulator as it processes', async () => {
    const reduce = bstream.reduce(async (acc, el) => acc + el.value, 0)
    objects().pipe(reduce)
    const totals = await bstream.collect(reduce)
    assert.deepEqual(totals, [1, 3, 6, 10, 15, 21])
  })
})
