const bstream = require('../')

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