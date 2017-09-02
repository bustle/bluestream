const Readable = require('stream').Readable
const assert = require('chai').assert
const bstream = require('../')
const defer = require('../lib/utils').defer

function numbers () {
  const arr = [1, 2, 3, 4, 5, 6, null]
  return new Readable({
    objectMode: true,
    read () {
      const value = arr.shift()
      this.push(value)
    }})
}

describe('PromiseWriteStream', () => {
  it('works with an async function', async () => {
    let count = 0
    let writer = bstream.write(async function (data) {
      count += data
    })
    await bstream.pipe(numbers(), writer)
    assert.equal(count, 21)
  })

  it('works with a function', async () => {
    let count = 0
    let writer = bstream.write(function (data) {
      count += data
    })
    await bstream.pipe(numbers(), writer)
    assert.equal(count, 21)
  })

  it('#promise()', async () => {
    let count = 0
    let writer = bstream.write(data => count++)
    numbers().pipe(writer)
    await writer.promise()
    assert.equal(count, 6)
  })

  it('allows for concurrent operations', async () => {
    // resolve the promise from the deferred on the 2nd data event
    const defered = defer()
    let writer = bstream.write({ concurrent: 2 }, async data => {
      if (data === 1) {
        return defered.promise
      }
      if (data === 2) {
        defered.resolve()
      }
    })
    writer.write(1)
    writer.write(2)
    writer.end()
    await writer.promise()
  })
})
