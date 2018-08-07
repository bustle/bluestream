import { assert } from 'chai'
import * as bluestream from '../lib'

function delay (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

describe('Integration scenarios', () => {
  it('fast read with slow write reads all the data', async () => {
    let begin = 0
    const end = 100

    const idStream = bluestream.read(async function () {
      if (begin < end) {
        begin++
        this.push(begin)
      } else {
        return null
      }
    })
    const ids: any[] = []
    const articleStream = bluestream.write({ concurrent: 20 }, id => {
      ids.push(id)
      return delay(100).then(() => id)
    })
    await bluestream.pipe(idStream, articleStream)
    assert.equal(ids.length, 100)
  })
})
