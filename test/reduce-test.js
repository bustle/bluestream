const { Readable } = require('stream')
const bstream = require('../')

function objects () {
  const arr = [1, 2, 3, 4, 5, 6]
  return new Readable({
    objectMode: true,
    read () {
      const value = arr.shift()
      this.push(value ? { value } : null)
    }})
}

describe('PromiseReduceStream', () => {
  it('.promise() resolves the end result', async () => {
    const reduce = bstream.reduce(async (acc, el) => acc + el.value, 0)
    objects().pipe(reduce)
    const total = await reduce.promise()
    assert.equal(total, 21)
  })
})
