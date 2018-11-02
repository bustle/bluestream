import { assert } from 'chai'
import { Readable } from 'stream'
import { batch, collect } from './'

function numbers () {
  const arr = [1, 2, 3, 4, 5, 6, 7, null]
  return new Readable({
    objectMode: true,
    read () {
      this.push(arr.shift())
    }})
}

describe('BatchStream', () => {
  it('batches in sizes', async () => {
    const batchStream = batch(2)
    numbers().pipe(batchStream)
    const nums = await collect(batchStream)
    assert.deepEqual(nums, [[1, 2], [3, 4], [5, 6], [7]])
  })
  it('flushes whats left', async () => {
    const batchStream = batch(100)
    numbers().pipe(batchStream)
    const nums = await collect(batchStream)
    assert.deepEqual(nums, [[1, 2, 3, 4, 5, 6, 7]])
  })
  it('throws with a bad batch size', async () => {
    assert.throws(() => batch(0))
  })
})
