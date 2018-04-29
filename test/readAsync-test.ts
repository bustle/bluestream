import { assert } from 'chai'
import { createReadStream } from 'fs'
import { join } from 'path'
import { Readable } from 'stream'
import { collect, read, readAsync, write } from '../lib'

function promiseImmediate (data?) {
  return new Promise(resolve => setImmediate(() => resolve(data)))
}

function bufferStream () {
  return createReadStream(join(__dirname, 'test.txt'))
}

function stringStream () {
  return createReadStream(join(__dirname, 'test.txt'), 'utf8')
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

function objectStream (arr = [1, 2, 3, 4, 5, 6]) {
  return read(() => {
    const value = arr.shift()
    return (value ? { value } : null)
  })
}

function countEvents (stream) {
  return (stream as any)._eventsCount
}

describe('#readAsync', () => {
  it("rejects if it's not a readable stream", async () => {
    const writeStream = write(() => {})
    await readAsync(writeStream as any, 1).then(() => {
      assert.isTrue(false, 'The promise should have rejected')
    }, err => {
      assert.isNotNull(err)
      assert.equal(countEvents(writeStream), 1)
    })
  })
  it('resolvers a buffer with a number bytes from a buffer stream', async () => {
    const stream = bufferStream()
    assert.deepEqual(await readAsync(stream, 4), Buffer.from('1\n2\n'))
    assert.deepEqual(await readAsync(stream, 4), Buffer.from('3\n4\n'))
    assert.equal(countEvents(stream), 1)
  })
  it('resolvers a string with a number characters from a string stream', async () => {
    const stream = stringStream()
    assert.equal(await readAsync(stream, 4), '1\n2\n')
    assert.equal(await readAsync(stream, 4), '3\n4\n')
    assert.equal(countEvents(stream), 1)
  })
  it('reads the number of objects from a native object stream', async () => {
    const stream =  nativeObjectStream()
    assert.deepEqual(await readAsync(stream, 1), [{ value: 1}])
    assert.deepEqual(await readAsync(stream, 3), [{ value: 2 }, { value: 3 }])
  })
  it('reads the number of objects from an object stream', async () => {
    const stream = objectStream()
    const objects = await readAsync(stream, 3)
    assert.deepEqual(objects, [{ value: 1 }, { value: 2 }, { value: 3 }])
    assert.equal(countEvents(stream), 1)
  })
  it('resolves early if the stream ends before there is enough bytes', async () => {
    const file = await collect(bufferStream())
    const stream = bufferStream()
    const readBytes = await readAsync(stream, 500)
    assert.equal(readBytes.length, file.length)
    assert.deepEqual(readBytes, file)
    assert.equal(countEvents(stream), 1)
  })
  it('resolves early if the stream ends before there is enough objects', async () => {
    const stream = objectStream()
    const objects = await readAsync(stream, 10)
    assert.deepEqual(objects, [{ value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }, { value: 5 }, { value: 6 }])
    assert.equal(countEvents(stream), 1)
  })
  it('resolves null if there was no data and the stream closed', async () => {
    const stream = read({ objectMode: false }, () => null)
    assert.isNull(await readAsync(stream, 5))
    assert.equal(countEvents(stream), 1)
    const stream2 = read(() => null)
    assert.isNull(await readAsync(stream2, 5))
    assert.equal(countEvents(stream2), 1)
  })
  it('resolves null if the stream has ended', async () => {
    const arr = [1, 2, 3, null]
    const stream = read(() => arr.shift())
    assert.equal(await readAsync(stream, 1), 1)
    assert.equal(await readAsync(stream, 1), 2)
    assert.equal(await readAsync(stream, 1), 3)
    assert.isNull(await readAsync(stream, 1))
    assert.isNull(await readAsync(stream, 1))
  })
  it('resolves null if the stream has already ended', async () => {
    const stream = read(() => null)
    stream.read()
    stream.read()
    assert.isNull(await readAsync(stream, 5))
    assert.equal(countEvents(stream), 1)
  })
  it('rejects if the stream errors', () => {
    const stream = read(() => 1)
    const error = new Error('Foo!')
    const assertion = readAsync(stream, 5).then(() => {
      assert.isTrue(false, 'The promise should have rejected')
    }, err => {
      assert.isNotNull(err)
      assert.deepEqual(err, error)
      assert.equal(countEvents(stream), 1)
    })
    stream.emit('error', error)
    return assertion
  })
  it('rejects if the stream is already in flowing mode', async () => {
    const stream = read(() => promiseImmediate(1))
    stream.resume()
    await readAsync(stream, 1).then(() => {
      assert.isTrue(false, 'The promise should have rejected')
    }, err => {
      stream.pause()
      assert.isNotNull(err)
      assert.equal(countEvents(stream), 1)
    })
  })
  it('queues if being called twice at the same time with a sync source', async () => {
    const stream = objectStream()
    const firstRead = readAsync(stream, 1)
    const secondRead = readAsync(stream, 1)
    assert.deepEqual(await secondRead, [{ value: 2 }])
    assert.deepEqual(await firstRead, [{ value: 1 }])
  })
  it('queues if being called twice at the same time with an async source', async () => {
    let value = 0
    const stream = read(() => promiseImmediate(++value))
    const firstRead = readAsync(stream, 1)
    const secondRead = readAsync(stream, 1)
    assert.equal(await secondRead, 2)
    assert.equal(await firstRead, 1)
  })
})
