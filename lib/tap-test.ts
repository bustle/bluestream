import { assert } from 'chai'
import { Readable } from 'stream'
import { collect, pipe, tap, write } from './'

function delayImmediate () {
  return new Promise(resolve => setImmediate(resolve))
}

function numbers () {
  const arr = [1, 2, 3, 4, 5, 6, null]
  return new Readable({
    objectMode: true,
    read () {
      this.push(arr.shift())
    }})
}

describe('TapStream', () => {
  it('passes through the value', async () => {
    const tapStream = tap()
    numbers().pipe(tapStream)
    const nums = await collect(tapStream)
    assert.deepEqual(nums, [1, 2, 3, 4, 5, 6])
  })

  it('waits for the tap fn to resolve', async () => {
    let tapCount = 0
    let postTapCount = 0
    const tapStream = tap(async () => {
      tapCount++
      await delayImmediate()
      postTapCount++
    })
    await pipe(numbers(), tapStream, write(() => {
      assert.equal(tapCount, postTapCount)
    }))
  })
})
