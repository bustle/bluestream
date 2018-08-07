import { assert } from 'chai'
import { createReadStream } from 'fs'
import { join } from 'path'
import { Readable } from 'stream'
import { read, ReadStream, wait } from '../lib'
import { iterate } from '../lib/'

if (Symbol.asyncIterator === undefined) {
  (Symbol as any).asyncIterator = Symbol.for('asyncIterator')
}

function nativeObjectStream () {
  const arr = [1, 2, 3]
  return new Readable({
    objectMode: true,
    read () {
      const value = arr.shift()
      if (!value) {
        return this.push(null)
      }
      this.push({ value })
    }})
}

function nativeStringStream () {
  return createReadStream(join(__dirname, 'small-text.txt'), 'utf8')
}

function bufferStream () {
  const values = [Buffer.from('12'), Buffer.from('3'), Buffer.from('4'), null]
  return read({ objectMode: false }, () => values.shift())
}

function nativeBufferStream () {
  return createReadStream(join(__dirname, 'small-text.txt'))
}

function promiseImmediate (data?) {
  return new Promise(resolve => setImmediate(() => resolve(data)))
}

describe('iterate', () => {
  it('iterates native object mode streams', async () => {
    const stream = nativeObjectStream()
    const asyncArray: any[] = []
    for await (const val of iterate(stream)) {
      asyncArray.push(val)
    }
    assert.deepEqual(asyncArray, [{ value: 1 }, { value: 2 }, { value: 3 }])
  })
  it('iterates native buffer mode streams', async () => {
    const stream = nativeBufferStream()
    const asyncArray: any[] = []
    for await (const val of iterate(stream)) {
      asyncArray.push(val)
    }
    assert.deepEqual(Buffer.concat(asyncArray), Buffer.from('1234\n'))
  })
  it('iterates using a native iterator', async () => {
    const fakeStream = {
      async *[Symbol.asyncIterator] () {
        yield await promiseImmediate(1)
        yield await promiseImmediate(2)
        yield await promiseImmediate(3)
      },
    }
    const asyncArray: any[] = []
    for await (const val of iterate(fakeStream as Readable)) {
      asyncArray.push(val)
    }
    assert.deepEqual(asyncArray, [1, 2, 3])

  })
  it('supports async iterators', async () => {
    const arr = [1, 2, 3, null]
    const stream = read(() => arr.shift())
    const asyncArray: any[] = []
    for await (const val of stream) {
      asyncArray.push(val)
    }
    assert.deepEqual(asyncArray, [1, 2, 3])
  })
  it('supports async iterators with buffers', async () => {
    const arr = [1, 2, 3, null]
    const stream = bufferStream()
    const valuesArray: any[] = []
    for await (const val of stream) {
      valuesArray.push(val)
    }
    assert.deepEqual(Buffer.concat(valuesArray), Buffer.from('1234'))
  })
})
