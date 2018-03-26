import { assert } from 'chai'
import { Readable } from 'stream'
import * as bstream from '../lib'
import { defer } from '../lib/utils'

function objects () {
  const arr = [1, 2, 3, 4, 5, 6]
  return new Readable({
    objectMode: true,
    read () {
      const value = arr.shift()
      this.push(value ? { value } : null)
    }
  })
}

function numbers () {
  const arr = [1, 2, 3, 4, 5, 6, null]
  return new Readable({
    objectMode: true,
    read () {
      const value = arr.shift()
      this.push(value)
    }})
}

function delay (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function nextTick () {
  return new Promise(resolve => process.nextTick(resolve))
}

describe('TransformStream', () => {
  it('allows extension', async () => {
    class MyTransform extends bstream.TransformStream {
      _transform (data) {
        this.push(data)
      }
    }
    const transform = new MyTransform({})
    let sum = 0
    transform.on('data', data => {
      sum += data
    })
    await bstream.pipe(numbers(), transform)
    assert.equal(sum, 21)
  })
  it('works with .push', async () => {
    let transform = bstream.transform(function (data) {
      this.push(data)
    })
    let sum = 0
    transform.on('data', data => {
      sum += data
    })
    await bstream.pipe(numbers(), transform)
    assert.equal(sum, 21)
  })

  it('works with .push of a promise', async () => {
    let transform = bstream.transform(function (data) {
      this.push(Promise.resolve(data))
    })
    let sum = 0
    transform.on('data', data => {
      sum += data
    })
    await bstream.pipe(numbers(), transform)
    assert.equal(sum, 21)
  })

  it('pushes a return value', async () => {
    let transform = bstream.transform(data => data)
    let sum = 0
    transform.on('data', data => {
      sum += data
    })
    await bstream.pipe(numbers(), transform)
    assert.equal(sum, 21)
  })

  it('pushes a promise return', async () => {
    let transform = bstream.transform(async data => {
      return data
    })
    let sum = 0
    transform.on('data', data => {
      sum += data
    })
    await bstream.pipe(numbers(), transform)
    assert.equal(sum, 21)
  })

  it('allows not returning a value', async () => {
    let transform = bstream.transform(data => {
      if (data !== 2) {
        return data
      }
    })
    let sum = 0
    transform.on('data', data => {
      sum += data
    })
    await bstream.pipe(numbers(), transform)
    assert.equal(sum, 19)
  })

  it('allows not calling .push in a call', async () => {
    let transform = bstream.transform(data => {
      if (data !== 2) {
        return data
      }
    })
    let sum = 0
    transform.on('data', data => {
      sum += data
    })
    await bstream.pipe(numbers(), transform)
    assert.equal(sum, 19)
  })

  it('handles sync errors', async () => {
    let transform = bstream.transform(() => { throw new Error("I'm an Error") })
    const transformPromise = transform.promise()
    transform.write(4)
    await transformPromise.then(() => {
      assert.isTrue(false, 'The promise should have rejected')
    }, err => {
      assert.isNotNull(err)
    })
  })

  it('handles async errors', async () => {
    let transform = bstream.transform(async () => { throw new Error("I'm an Error") })
    const transformPromise = transform.promise()
    transform.write(4)
    await transformPromise.then(() => {
      assert.isTrue(false, 'The promise should have rejected')
    }, err => {
      assert.isNotNull(err)
    })
  })

  it('handles pushing rejected promises', async () => {
    let transform = bstream.transform(function () {
      this.push(Promise.reject(new Error("I'm an Error")))
    })
    const transformPromise = transform.promise()
    transform.write(4)
    await transformPromise.then(() => {
      assert.isTrue(false, 'The promise should have rejected')
    }, err => {
      assert.isNotNull(err)
    })
  })

  it('#promise()', async () => {
    let count = 0
    let transform = bstream.transform(data => count++)
    numbers().pipe(transform)
    await transform.promise()
    assert.equal(count, 6)
  })

  it('supports writable objects and readable buffers', async () => {
    let transform = new bstream.TransformStream({
      writableObjectMode: true,
      readableObjectMode: false,
      transform ({ value }) {
        const data = value.toString()
        this.push(data)
      }
    })

    bstream.pipe(objects(), transform)
    assert.deepEqual(await bstream.collect(transform), Buffer.from('123456'))
  })

  it('allows for concurrent operations', async () => {
    // resolve the promise from the deferred on the 2nd data event
    const defered = defer()
    let transform = bstream.transform({ concurrent: 2 }, async data => {
      if (data === 1) {
        return defered.promise
      }
      if (data === 2) {
        defered.resolve(1)
        return 2
      }
      if (data === 'end') {
        return null
      }
    })
    transform.write(1)
    transform.write(2)
    transform.write('end')
    const data = await bstream.collect(transform)
    assert.deepEqual(data.sort(), [1, 2])
  })

  it('ensures all concurrent operations finish before finishing', async () => {
    let finished = 0
    const transform = bstream.transform({ concurrent: 6 }, num => delay(num).then(() => finished++))
    await bstream.pipe(numbers(), transform)
    assert.equal(finished, 6)
  })

  it('ensures all concurrent operations finish before ending with data', async () => {
    let finished = 0
    const transform = bstream.transform({ concurrent: 6 }, num => delay(num).then(() => finished++))
    transform.write(1)
    transform.write(2)
    transform.end(3)
    await transform.promise()
    assert.equal(finished, 3)
  })

  it('ensures all concurrent operations finish before ending', async () => {
    let finished = 0
    const numbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, null]
    const source = bstream.read(async function () {
      await nextTick()
      this.push(numbers.shift())
      this.push(numbers.shift())
    })
    const sink = bstream.transform({ concurrent: 6 }, async num => {
      await delay(num)
      finished++
    })
    await bstream.pipe(source, sink)
    assert.equal(finished, 11)
  })
})
