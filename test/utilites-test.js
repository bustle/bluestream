const fs = require('fs')
const path = require('path')
const split = require('split2')
const { Readable } = require('stream')
const bstream = require('../')

function lines () {
  return rawString().pipe(split())
}
function rawString () {
  return fs.createReadStream(path.join(__dirname, 'test.txt'), 'utf8')
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

function nextTick () {
  return new Promise(function (resolve, reject) {
    process.nextTick(resolve)
  })
}

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
    return bstream.collect(rawString()).then(function (data) {
      assert.equal(data.length, 18 * 3, 'test.txt should be the correct size')
    })
  })

  it('collect(obj)', () => {
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
