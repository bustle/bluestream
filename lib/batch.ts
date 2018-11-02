import { TransformStream } from './transform'

export class BatchStream extends TransformStream {
  private batchSize: number
  private nextBatch: any[]

  constructor (batchSize: number) {
    super({
      concurrent: 1,
      highWaterMark: 1,
    })
    if (batchSize <= 0) {
      throw new TypeError('"batchSize" must be greater than 0')
    }
    this.batchSize = batchSize
    this.nextBatch = []
  }

  public async _transform (data: any) {
    this.nextBatch.push(data)
    if (this.nextBatch.length < this.batchSize) {
      return
    }
    const nextBatch = this.nextBatch
    this.nextBatch = []
    return nextBatch
  }

  public _flush () {
    const nextBatch = this.nextBatch
    this.nextBatch = []
    return nextBatch
  }
}

export const batch = (batchSize: number) => new BatchStream(batchSize)
