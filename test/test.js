
const fs = require('fs')
const path = require('path')
const Promise = require('bluebird')
const split = require('split2')
const Readable = require('stream').Readable
const assert = require('chai').assert
const bstream = require('../')

function lines () {
  return raw().pipe(split())
}
function raw () {
  return fs.createReadStream(path.join(__dirname, 'test.txt'), 'utf8')
}

function objects () {
  const arr = [1, 2, 3, 4, 5, 6]
  return new Readable({ objectMode: true,
    read () {
      const value = arr.shift()
      this.push(value ? { value } : null)
    }})
}

function nextTick () {
  return new Promise(function (resolve, reject) {
    process.nextTick(resolve)
  })
}

describe('bluestream', () => {
  describe('PromiseReadStream', () => {
    describe('constructors', () => {
      it('bstream.read()', async () => {
        const read = bstream.read(() => {})
        assert.instanceOf(read, bstream.PromiseReadStream)
      })

      it('new PromiseReadStream()', async () => {
        const read = new bstream.PromiseReadStream(() => {})
        assert.instanceOf(read, bstream.PromiseReadStream)
      })
    })

    it('works with .push', async () => {
      const arr = [1, 2, 3, null]
      let read = bstream.read(function () {
        this.push(arr.shift())
      })
      let sum = 0
      read.on('data', data => {
        sum += data
      })
      await bstream.wait(read)
      assert.equal(sum, 6)
    })

    it('works with .push of a promise', async () => {
      const arr = [1, 2, 3, null]
      let read = bstream.read(function () {
        this.push(Promise.resolve(arr.shift()))
      })
      let sum = 0
      read.on('data', data => {
        sum += data
      })
      await bstream.wait(read)
      assert.equal(sum, 6)
    })

    it('pushes a return value', async () => {
      const arr = [1, 2, 3, null]
      let read = bstream.read(function () {
        return arr.shift()
      })
      let sum = 0
      read.on('data', data => {
        sum += data
      })
      await bstream.wait(read)
      assert.equal(sum, 6)
    })

    it('pushes a promise return', async () => {
      const arr = [1, 2, 3, null]
      let read = bstream.read(async function () {
        return arr.shift()
      })
      let sum = 0
      read.on('data', data => {
        sum += data
      })
      await bstream.wait(read)
      assert.equal(sum, 6)
    })

    it('allows not returning a value', async () => {
      const arr = [1, 2, undefined, 3, null]
      let read = bstream.read(function () {
        return arr.shift()
      })
      let sum = 0
      read.on('data', data => {
        sum += data
      })
      await bstream.wait(read)
      assert.equal(sum, 6)
    })

    it('allows not calling .push in a call', async () => {
      const arr = [1, 2, undefined, 3, null]
      let read = bstream.read(function () {
        let data = arr.shift()
        if (data !== undefined) {
          this.push(data)
        }
      })
      let sum = 0
      read.on('data', data => {
        sum += data
      })
      await bstream.wait(read)
      assert.equal(sum, 6)
    })

    it('#promise()', async () => {
      const arr = [1, 2, 3, null]
      let read = bstream.read(function () {
        return arr.shift()
      })
      await read.promise()
      assert.equal(arr.length, 0)
    })
  })

  describe('PromiseTransformStream', () => {
    it('works with .push', async () => {
      const arr = [1, 2, 3]
      let transform = bstream.transform(function (data) {
        this.push(data)
      })
      let sum = 0
      transform.on('data', data => {
        sum += data
      })
      arr.map(data => transform.write(data))
      transform.end()
      await bstream.wait(transform)
      assert.equal(sum, 6)
    })

    it('works with .push of a promise', async () => {
      const arr = [1, 2, 3]
      let transform = bstream.transform(function (data) {
        this.push(Promise.resolve(data))
      })
      let sum = 0
      transform.on('data', data => {
        sum += data
      })
      arr.map(data => transform.write(data))
      transform.end()
      await bstream.wait(transform)
      assert.equal(sum, 6)
    })

    it('pushes a return value', async () => {
      const arr = [1, 2, 3]
      let transform = bstream.transform(data => data)
      let sum = 0
      transform.on('data', data => {
        sum += data
      })
      arr.map(data => transform.write(data))
      transform.end()
      await bstream.wait(transform)
      assert.equal(sum, 6)
    })

    it('pushes a promise return', async () => {
      const arr = [1, 2, 3]
      let transform = bstream.transform(async function (data) {
        return data
      })
      let sum = 0
      transform.on('data', data => {
        sum += data
      })
      arr.map(data => transform.write(data))
      transform.end()
      await bstream.wait(transform)
      assert.equal(sum, 6)
    })

    it('allows not returning a value', async () => {
      const arr = [1, 2, 5]
      let transform = bstream.transform(data => {
        if (data !== 2) {
          return data
        }
      })
      let sum = 0
      transform.on('data', data => {
        sum += data
      })
      arr.map(data => transform.write(data))
      transform.end()
      await bstream.wait(transform)
      assert.equal(sum, 6)
    })

    it('allows not calling .push in a call', async () => {
      const arr = [1, 2, 5]
      let transform = bstream.transform(function (data) {
        if (data !== 2) {
          return data
        }
      })
      let sum = 0
      transform.on('data', data => {
        sum += data
      })
      arr.map(data => transform.write(data))
      transform.end()
      await bstream.wait(transform)
      assert.equal(sum, 6)
    })

    it('#promise()', async () => {
      const arr = [1, 2, 3]
      let count = 0
      let transform = bstream.transform(data => count++)
      arr.map(data => transform.write(data))
      transform.end()
      await transform.promise()
      assert.equal(count, 3)
    })

    it('native supports writable objects and readable buffers', async () => {
      const { Transform } = require('stream')
      let stream = new Transform({
        writableObjectMode: true,
        readableObjectMode: false,
        transform ({ value }) {
          const data = value.toString()
          this.push(data)
        }
      })
      const sampleData = 'This is a clever message about tech and dogs'

      let dataReceived = false
      stream.on('data', data => {
        assert.deepEqual(data, Buffer.from(sampleData))
        dataReceived = true
        console.log('compared')
      })

      stream.write({ value: sampleData })
      stream.end()
      console.log('wait')
      await bstream.wait(stream)
      assert.isTrue(dataReceived, dataReceived)
    })

    it('supports writable objects and readable buffers', async () => {
      let stream = new bstream.PromiseTransformStream({
        writableObjectMode: true,
        readableObjectMode: false,
        transform ({ value }) {
          this.push(value.toString())
        }
      })
      const sampleData = 'This is a clever message about tech and dogs'

      let dataReceived = false
      stream.on('data', data => {
        assert.equal(data, Buffer.from(sampleData))
        dataReceived = true
      })

      stream.write({ value: sampleData })
      stream.end()
      await stream.promise()
      assert.isTrue(dataReceived, dataReceived)
    })
  })

  describe('PromiseReduceStream', () => {
    it('.promise() resolves the end result', async () => {
      const reduce = objects().pipe(bstream.reduce(async (acc, el) => acc + el.value, 0))
      const total = await reduce.promise()
      assert.equal(total, 21)
    })
  })

  describe('wait', () => {
    it('bstream.wait', async () => {
      var last = 0
      await bstream.wait(lines().pipe(bstream.map(async (el) => {
        await nextTick()
        if (el) { last = el }
        return el
      })))
      assert.equal(last, '9', 'should wait for the last element')
    })
  })

  describe('collect', () => {
    it('collect()', function () {
      return bstream.collect(raw()).then(function (data) {
        assert.equal(data.length, 18 * 3, 'test.txt should be the correct size')
      })
    })
  })

  describe('collect', () => {
    it('collect(objects)', function () {
      return bstream.collect(objects()).then(function (data) {
        assert.equal(data.length, 6, 'array of objects should be the correct size')
        assert.deepEqual(data, [
          { value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }, { value: 5 }, { value: 6 }
        ])
      })
    })
  })

  describe('error', () => {
    it('error', function () {
      return lines().pipe(bstream.map(function (el) {
        return Promise.reject(new Error('Oops'))
      })).wait().then(function (val) {
        assert.ok(false, 'should not execute')
      }, function (e) {
        assert.ok(e, 'should be rejected')
      })
    })
  })
})
