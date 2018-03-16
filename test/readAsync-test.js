import fs from 'fs'
import path from 'path'
import { readAsync, read, write, collect } from '../lib'

function nextTick (data) {
  return new Promise(resolve => process.nextTick(() => resolve(data)))
}

function bufferStream () {
  return fs.createReadStream(path.join(__dirname, 'test.txt'))
}

function stringStream () {
  return fs.createReadStream(path.join(__dirname, 'test.txt'), 'utf8')
}

function objectStream (arr = [1, 2, 3, 4, 5, 6]) {
  return read(() => {
    const value = arr.shift()
    return (value ? { value } : null)
  })
}

describe('#readAsync', () => {
  it(`rejects if it's not a readable stream`, async () => {
    const writeStream = write(() => {})
    await readAsync(writeStream, 1).then(() => {
      assert.isTrue(false, 'The promise should have rejected')
    }, err => {
      assert.isNotNull(err)
      assert.equal(writeStream._eventsCount, 1)
    })
  })
  it('resolvers a buffer with a number bytes from a buffer stream', async () => {
    const stream = bufferStream()
    assert.deepEqual(await readAsync(stream, 4), Buffer.from('1\n2\n'))
    assert.deepEqual(await readAsync(stream, 4), Buffer.from('3\n4\n'))
    assert.equal(stream._eventsCount, 1)
  })
  it('resolvers a string with a number characters from a string stream', async () => {
    const stream = stringStream()
    assert.equal(await readAsync(stream, 4), '1\n2\n')
    assert.equal(await readAsync(stream, 4), '3\n4\n')
    assert.equal(stream._eventsCount, 1)
  })
  it('reads the number of objects from an object stream', async () => {
    const stream = objectStream()
    const objects = await readAsync(stream, 3)
    assert.deepEqual(objects, [{ value: 1 }, { value: 2 }, { value: 3 }])
    assert.equal(stream._eventsCount, 1)
  })
  it('resolvers early if the stream ends before there is enough bytes', async () => {
    const file = await collect(bufferStream())
    const stream = bufferStream()
    const readBytes = await readAsync(stream, 500)
    assert.equal(readBytes.length, file.length)
    assert.deepEqual(readBytes, file)
    assert.equal(stream._eventsCount, 1)
  })
  it('resolvers early if the stream ends before there is enough objects', async () => {
    const stream = objectStream()
    const objects = await readAsync(stream, 10)
    assert.deepEqual(objects, [{ value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }, { value: 5 }, { value: 6 }])
    assert.equal(stream._eventsCount, 1)
  })
  it('resolves null if there was no data and the stream closed', async () => {
    const stream = read({ objectMode: false }, () => null)
    assert.isNull(await readAsync(stream, 5))
    assert.equal(stream._eventsCount, 1)
    const stream2 = read(() => null)
    assert.isNull(await readAsync(stream2, 5))
    assert.equal(stream2._eventsCount, 1)
  })
  it('resolves null if the stream has already ended', async () => {
    const stream = read(() => null)
    stream.read()
    stream.read()
    assert.isNull(await readAsync(stream, 5))
    assert.equal(stream._eventsCount, 1)
  })
  it('rejects if the stream errors', async () => {
    const stream = read(() => 1)
    const error = new Error('Foo!')
    nextTick().then(() => stream.emit('error', error))
    await readAsync(stream, 5).then(() => {
      assert.isTrue(false, 'The promise should have rejected')
    }, err => {
      assert.isNotNull(err)
      assert.deepEqual(err, error)
      assert.equal(stream._eventsCount, 1)
    })
  })
  it('rejects if the stream is already in flowing mode', async () => {
    const stream = read(() => nextTick(1))
    stream.resume()
    await readAsync(stream, 1).then(() => {
      assert.isTrue(false, 'The promise should have rejected')
    }, err => {
      stream.pause()
      assert.isNotNull(err)
      assert.equal(stream._eventsCount, 1)
    })
  })
})
