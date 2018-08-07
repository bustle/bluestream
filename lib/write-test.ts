import { assert } from 'chai'
import { Readable } from 'stream'
import { pipe, read, write, WriteStream } from '../lib'
import { defer } from '../lib/utils'

function numbers (num = 6) {
  const arr: Array<number|null> = [...new Array(num)].map((val, i) => i + 1)
  arr.push(null)
  return new Readable({
    objectMode: true,
    read () {
      const value = arr.shift()
      if (value && value % 2 === 0) {
        this.push(value)
      } else {
        setImmediate(() => this.push(value))
      }
    }})
}

function delay (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function promiseImmediate (data?) {
  return new Promise(resolve => setImmediate(() => resolve(data)))
}

describe('WriteStream', () => {
  it('allows extension', async () => {
    let count = 0
    class MyWrite extends WriteStream {
      public _write (data) {
        count += data
      }
    }
    const writer = new MyWrite({})
    await pipe(numbers(), writer)
    assert.equal(count, 21)
  })

  it('works with an async function', async () => {
    let count = 0
    const writer = write(async data => {
      count += data
    })
    await pipe(numbers(), writer)
    assert.equal(count, 21)
  })

  it('works with a function', async () => {
    let count = 0
    const writer = write(async data => {
      count += data
    })
    await pipe(numbers(), writer)
    assert.equal(count, 21)
  })

  it('#promise()', async () => {
    let count = 0
    const writer = write(data => count++)
    numbers().pipe(writer)
    await writer.promise()
    assert.equal(count, 6)
  })

  it('allows for concurrent operations', async () => {
    // resolve the promise from the deferred on the 2nd data event
    const defered = defer()
    const writer = write({ concurrent: 2 }, async data => {
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

  it('ensures all concurrent operations finish before finishing', async () => {
    let finished = 0
    const writer = write({ concurrent: 6 }, num => delay(num).then(() => finished++))
    await pipe(numbers(), writer)
    assert.equal(finished, 6)
  })

  it('ensures all concurrent operations finish before ending with data', async () => {
    let finished = 0
    const writer = write({ concurrent: 6 }, async num => {
      await delay(num)
      finished++
    })
    writer.write(1)
    writer.write(2)
    writer.end(3)
    await writer.promise()
    assert.equal(finished, 3)
  })

  it('ensures all concurrent operations finish before ending', async () => {
    let finished = 0
    const numberArray = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, null]
    const source = read(async function () {
      await promiseImmediate()
      this.push(numberArray.shift())
      this.push(numberArray.shift())
    })
    const sink = write({ concurrent: 6 }, num => delay(num).then(() => finished++))
    await pipe(source, sink)
    assert.equal(finished, 11)
  })
})
