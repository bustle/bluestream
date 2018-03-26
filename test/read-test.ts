import { assert } from 'chai'
import { read, ReadStream, wait } from '../lib'

function nextTick (data?) {
  return new Promise(resolve => process.nextTick(() => resolve(data)))
}

describe('ReadStream', () => {
  describe('constructors', () => {
    it('read()', async () => {
      assert.instanceOf(read(async () => {}), ReadStream)
    })

    it('new ReadStream()', async () => {
      const stream = new ReadStream(() => {})
      assert.instanceOf(stream, ReadStream)
    })

    it('allows extension', async () => {
      const arr = [1, 2, 3, null]
      class MyRead extends ReadStream {
        public _read () {
          this.push(arr.shift())
        }
      }
      const stream = new MyRead()
      let sum = 0
      stream.on('data', data => {
        sum += data
      })
      await wait(stream)
      assert.equal(sum, 6)
    })
  })

  it('works with .push', async () => {
    const arr = [1, 2, 3, null]
    const stream = read(function () {
      this.push(arr.shift())
    })
    let sum = 0
    stream.on('data', data => {
      sum += data
    })
    await wait(stream)
    assert.equal(sum, 6)
  })

  it('works with .push of a promise', async () => {
    const arr = [1, 2, 3, null]
    const stream = read(function () {
      this.push(Promise.resolve(arr.shift()))
    })
    let sum = 0
    stream.on('data', data => {
      sum += data
    })
    await wait(stream)
    assert.equal(sum, 6)
  })

  it('pushes a return value', async () => {
    const arr = [1, 2, 3, null]
    const stream = read(() => {
      return arr.shift()
    })
    let sum = 0
    stream.on('data', data => {
      sum += data
    })
    await wait(stream)
    assert.equal(sum, 6)
  })

  it('pushes a promise return', async () => {
    const arr = [1, 2, 3, null]
    const stream = read(async () => {
      return arr.shift()
    })
    let sum = 0
    stream.on('data', data => {
      sum += data
    })
    await wait(stream)
    assert.equal(sum, 6)
  })

  it('allows not returning a value', async () => {
    const arr = [1, 2, undefined, 3, null]
    const stream = read(() => {
      return arr.shift()
    })
    let sum = 0
    stream.on('data', data => {
      sum += data
    })
    await wait(stream)
    assert.equal(sum, 6)
  })

  it('allows not calling .push in a call', async () => {
    const arr = [1, 2, undefined, 3, null]
    const stream = read(function () {
      const data = arr.shift()
      if (data !== undefined) {
        this.push(data)
      }
    })
    let sum = 0
    stream.on('data', data => {
      sum += data
    })
    await wait(stream)
    assert.equal(sum, 6)
  })

  it('allows pushing async and returning sync', async () => {
    let callCount = 0
    const stream = read(function () {
      callCount++
      this.push(nextTick(1))
      this.push(nextTick(2))
      return null
    })
    let sum = 0
    stream.on('data', data => {
      sum += data
    })
    await wait(stream)
    assert.equal(sum, 3)
    assert.equal(callCount, 1)
  })

  it('does not call read until all pushed values have resolved to check for null', async () => {
    let callCount = 0
    const stream = read(function () {
      callCount++
      this.push(nextTick(1))
      this.push(nextTick(2))
      this.push(null)
    })
    let sum = 0
    stream.on('data', data => {
      sum += data
    })
    await wait(stream)
    assert.equal(sum, 3)
    assert.equal(callCount, 1)
  })

  it('allows for an external pushing of null to end the stream early', async () => {
    let callCount = 0
    let pushCount = 0
    const stream = read(async function () {
      callCount++
      this.push(await nextTick(1))
      pushCount++
      this.push(await nextTick(2))
      pushCount++
    })
    let sum = 0
    stream.on('data', data => {
      sum += data
    })
    await nextTick()
    await nextTick()
    assert.equal(1, pushCount)
    stream.push(null)
    await wait(stream)
    assert.equal(sum, 3)
    assert.equal(callCount, 1)
  })

  it('#promise()', async () => {
    const arr = [1, 2, 3, null]
    const stream = read(() => arr.shift())
    await stream.promise()
    assert.equal(arr.length, 0)
  })
})
