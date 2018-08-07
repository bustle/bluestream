import { assert } from 'chai'
import { Readable } from 'stream'
import { collect, pipe, read, transform, TransformStream, write } from '../lib'
import { defer } from '../lib/utils'

function objects () {
  const arr = [1, 2, 3, 4, 5, 6]
  return new Readable({
    objectMode: true,
    read () {
      const value = arr.shift()
      this.push(value ? { value } : null)
    },
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

function manyNumbers () {
  let count = 0
  return read(function () {
    const arr: number[] = []
    for (let index = 0; index < 2000; index++) {
      arr.push(count++)
    }
    this.push(arr)
    if (count > 100000) {
      this.push(null)
    }
  })
}

function delay (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function promiseImmediate (data?) {
  return new Promise(resolve => setImmediate(() => resolve(data)))
}

describe('TransformStream', () => {
  it('allows extension', async () => {
    class MyTransform extends TransformStream {
      public _transform (data) {
        this.push(data)
      }
    }
    const stream = new MyTransform({})
    let sum = 0
    stream.on('data', data => {
      sum += data
    })
    await pipe(numbers(), stream)
    assert.equal(sum, 21)
  })
  it('works with .push', async () => {
    const stream = transform(function (data) {
      this.push(data)
    })
    let sum = 0
    stream.on('data', data => {
      sum += data
    })
    await pipe(numbers(), stream)
    assert.equal(sum, 21)
  })

  it('works with .push of a promise', async () => {
    const stream = transform(function (data) {
      this.push(Promise.resolve(data))
    })
    let sum = 0
    stream.on('data', data => {
      sum += data
    })
    await pipe(numbers(), stream)
    assert.equal(sum, 21)
  })

  it('pushes a return value', async () => {
    const stream = transform(data => data)
    let sum = 0
    stream.on('data', data => {
      sum += data
    })
    await pipe(numbers(), stream)
    assert.equal(sum, 21)
  })

  it('pushes a promise return', async () => {
    const stream = transform(async data => {
      return data
    })
    let sum = 0
    stream.on('data', data => {
      sum += data
    })
    await pipe(numbers(), stream)
    assert.equal(sum, 21)
  })

  it('allows not returning a value', async () => {
    const stream = transform(data => {
      if (data !== 2) {
        return data
      }
    })
    let sum = 0
    stream.on('data', data => {
      sum += data
    })
    await pipe(numbers(), stream)
    assert.equal(sum, 19)
  })

  it('allows not calling .push in a call', async () => {
    const stream = transform(data => {
      if (data !== 2) {
        return data
      }
    })
    let sum = 0
    stream.on('data', data => {
      sum += data
    })
    await pipe(numbers(), stream)
    assert.equal(sum, 19)
  })

  it('handles sync errors', async () => {
    const stream = transform(() => { throw new Error("I'm an Error") })
    const transformPromise = stream.promise()
    stream.write(4)
    await transformPromise.then(() => {
      assert.isTrue(false, 'The promise should have rejected')
    }, err => {
      assert.isNotNull(err)
    })
  })

  it('handles async errors', async () => {
    const stream = transform(async () => { throw new Error("I'm an Error") })
    const transformPromise = stream.promise()
    stream.write(4)
    await transformPromise.then(() => {
      assert.isTrue(false, 'The promise should have rejected')
    }, err => {
      assert.isNotNull(err)
    })
  })

  it('handles pushing rejected promises', async () => {
    const stream = transform(function () {
      this.push(Promise.reject(new Error("I'm an Error")))
    })
    const transformPromise = stream.promise()
    stream.write(4)
    await transformPromise.then(() => {
      assert.isTrue(false, 'The promise should have rejected')
    }, err => {
      assert.isNotNull(err)
    })
  })

  it('#promise()', async () => {
    let count = 0
    const stream = transform(data => count++)
    numbers().pipe(stream)
    await stream.promise()
    assert.equal(count, 6)
  })

  it('supports writable objects and readable buffers', async () => {
    const stream = new TransformStream({
      readableObjectMode: false,
      writableObjectMode: true,
      transform ({ value }) {
        const data = value.toString()
        this.push(data)
      },
    })

    pipe(objects(), stream)
    assert.deepEqual(await collect(stream), Buffer.from('123456'))
  })

  it('allows for concurrent operations', async () => {
    // resolve the promise from the deferred on the 2nd data event
    const defered = defer()
    const stream = transform({ concurrent: 2 }, async data => {
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
    stream.write(1)
    stream.write(2)
    stream.write('end')
    const dataArray = await collect(stream)
    assert.deepEqual((dataArray as any[]).sort(), [1, 2])
  })

  it('ensures all concurrent operations finish before finishing', async () => {
    let finished = 0
    const stream = transform({ concurrent: 6 }, num => delay(num).then(() => finished++))
    await pipe(numbers(), stream)
    assert.equal(finished, 6)
  })

  it('ensures all concurrent operations finish before ending with data', async () => {
    let finished = 0
    const stream = transform({ concurrent: 6 }, num => delay(num).then(() => finished++))
    stream.write(1)
    stream.write(2)
    stream.end(3)
    await stream.promise()
    assert.equal(finished, 3)
  })

  it('ensures all concurrent operations finish before ending', async () => {
    let finished = 0
    const nums = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, null]
    const source = read(async function () {
      await promiseImmediate()
      this.push(nums.shift())
      this.push(nums.shift())
    })
    const sink = transform({ concurrent: 6 }, async num => {
      await delay(num)
      finished++
    })
    await pipe(source, sink)
    assert.equal(finished, 11)
  })

  it('handles pushing more than the buffer in a single read', async () => {
    await pipe(manyNumbers(), transform(function (nums) {
      nums.forEach(num => this.push(num))
    }), write(i => i))
  })
})
