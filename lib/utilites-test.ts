import { assert } from 'chai'
import { createReadStream } from 'fs'
import { join } from 'path'
import * as split from 'split2'
import { Readable } from 'stream'
import { collect, filter, map, pipe, reduce, wait, write } from '../lib'

function lines () {
  return rawString().pipe(split())
}
function rawString () {
  return createReadStream(join(__dirname, 'test.txt'), 'utf8')
}

function objects () {
  const arr = [1, 2, 3, 4, 5, 6]
  return new Readable({
    objectMode: true,
    read () {
      const value = arr.shift()
      this.push(value ? { value } : null)
    }})
}

function promiseImmediate (data?) {
  return new Promise(resolve => setImmediate(() => resolve(data)))
}

describe('#wait', () => {
  it('waits until the stream ends', async () => {
    let last = '0'
    await wait(lines().pipe(map(async el => {
      await promiseImmediate()
      if (el) { last = el }
      return el
    })))
    assert.equal(last, '9', 'should wait for the last element')
  })
  it('resolved the value of the streams promise function if it has one', async () => {
    const fakeStream = { promise: async () => 4 }
    assert.equal(await wait(fakeStream as any), 4)
  })
})

describe('#collect', () => {
  it('collect()', async () => {
    const data = await collect(rawString())
    assert.equal((data as string).length, 18 * 3, 'test.txt should be the correct size')
  })

  it('collect(obj)', async () => {
    const data = await collect(objects())
    assert.equal((data as any[]).length, 6, 'array of objects should be the correct size')
    assert.deepEqual(data, [
      { value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }, { value: 5 }, { value: 6 },
    ])
  })
})

describe('#pipe', () => {
  it('pipes multiple streams together', async () => {
    const numbers: any[] = []
    const extract = objects()
    const transform = filter(({ value }) => value % 2 === 0)
    const load = write(({ value }) => { numbers.push(value) })

    await pipe(extract, transform, load)
    assert.deepEqual(numbers, [2, 4, 6])
  })
  it('resolves the value of the last streams optional promise function', async () => {
    const extract = objects()
    const transform = filter(({ value }) => value % 2 === 0)
    const sum = reduce((total, { value }) => total + value, 0)

    assert.equal(await pipe(extract, transform, sum), 12)
  })
})

describe('error', () => {
  it('error', async () => {
    await lines().pipe(map(async el => {
      throw new Error('Oops')
    })).promise().then(val => {
      assert.ok(false, 'should not execute')
    }, e => {
      assert.ok(e, 'should be rejected')
    })
  })
})
