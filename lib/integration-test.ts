import { assert } from 'chai'
import { pipe, read, write } from '.'

function delay (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

describe('Integration scenarios', () => {
  it('fast read with slow write reads all the data', async () => {
    let begin = 0
    const end = 100

    const idStream = read(async function () {
      if (begin < end) {
        begin++
        this.push(begin)
      } else {
        return null
      }
    })
    const ids: any[] = []
    const articleStream = write({ concurrent: 20 }, id => {
      ids.push(id)
      return delay(100).then(() => id)
    })
    await pipe(idStream, articleStream)
    assert.equal(ids.length, 100)
  })
})
