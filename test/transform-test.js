const Readable = require('stream').Readable
const assert = require('chai').assert
const bstream = require('../')
const defer = require('../lib/utils').defer

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

describe('PromiseTransformStream', () => {
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
    let transform = bstream.transform(async function (data) {
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
    let transform = bstream.transform(function (data) {
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

  it('#promise()', async () => {
    let count = 0
    let transform = bstream.transform(data => count++)
    await bstream.pipe(numbers(), transform)
    assert.equal(count, 6)
  })

  it('supports writable objects and readable buffers', async () => {
    let transform = new bstream.PromiseTransformStream({
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
    let transform = bstream.transform({ concurrent: 2, log: true }, async data => {
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
    assert.deepEqual(data, [2, 1])
  })
})
