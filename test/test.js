
const fs = require('fs')
const path = require('path')
const Promise = require('bluebird')
const split = require('split2')
const Readable = require('stream').Readable
const assert = require('chai').assert
const ps = require('../')

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
      this.push(arr.shift() || null)
    }})
}

function delayer () {
  return ps.through(function (line) {
    return this.push(Promise.delay(1).then(function () {
      return line ? parseFloat(line) : null
    }))
  })
}

describe('bluestream', () => {
  describe('.read', () => {
    it('reads', async () => {
      const arr = [1, 2, 3]
      let read = ps.read(function () {
        this.push(arr.shift() || null)
      })
      let sum = 0
      read.on('data', data => {
        sum += data
      })
      await ps.wait(read)
      assert.equal(sum, 6)
    })
  })

  describe('wait', () => {
    it('ps.wait', async () => {
      var last = 0
      await ps.wait(lines().pipe(ps.map(async function (el) {
        await Promise.delay(1)
        if (el) { last = el }
        return el
      })))
      assert.equal(last, '9', 'should wait for the last element')
    })

    it('map().wait', async () => {
      var last = 0
      await lines().pipe(delayer())
        .map(function (el) {
          return Promise.delay(1).then(function () {
            return (last = el)
          })
        }).wait()
      assert.equal(last, 9, 'should wait for the last element')
    })
  })

  describe('map reduce', () => {
    it('delayer().map(..).filter(..).reduce(..).then(..)', function () {
      return lines().pipe(delayer())
      .map(function (el) {
        return el * 2
      })
      .filter(function (el) {
        return el > 4
      })
      .reduce(function (acc, el) {
        return acc + el
      })
      .then(function (sum) {
        assert.equal(sum, 84 * 3, 'should map-reduce to correct sum')
      })
    })
  })

  describe('collect', () => {
    it('collect()', function () {
      return ps.collect(raw()).then(function (data) {
        assert.equal(data.length, 18 * 3, 'test.txt should be the correct size')
      })
    })
  })

  describe('collect', () => {
    it('collect(objects)', function () {
      return ps.collect(objects()).then(function (data) {
        assert.equal(data.length, 6, 'array of objects should be the correct size')
        assert.deepEqual(data, [1, 2, 3, 4, 5, 6])
      })
    })
  })

  describe('error', () => {
    it('error', function () {
      return lines().pipe(ps.map(function (el) {
        return Promise.reject(new Error('Oops'))
      })).wait().then(function (val) {
        assert.ok(false, 'should not execute')
      }, function (e) {
        assert.ok(e, 'should be rejected')
      })
    })
  })
})
