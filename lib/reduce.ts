import { ITransformStreamOptions, TransformStream } from './transform'

async function reduceStreamFn (value, encoding) {
  const currentValue = await Promise.resolve(value)
  if (this.acc === undefined) {
    this.acc = currentValue
  } else {
    this.acc = await this.reduceFn(this.acc, currentValue, encoding)
  }
  this.push(this.acc)
}

export type IReduceFunction = (acc: any, currentValue: any, encoding: string) => Promise<any> | any

export class ReduceStream extends TransformStream {
  private reduceFn: IReduceFunction
  private acc: any

  constructor (opts: ITransformStreamOptions | IReduceFunction, reduceFn: IReduceFunction | any, initial?: any) {
    if (typeof opts === 'function') {
      initial = reduceFn
      reduceFn = opts
      opts = {}
    }

    super(opts, reduceStreamFn)
    this.reduceFn = reduceFn
    this.acc = initial
  }

  public async promise () {
    await TransformStream.prototype.promise.call(this)
    return this.acc
  }
}

export const reduce = (
  opts: ITransformStreamOptions | IReduceFunction,
  reduceFn: IReduceFunction | any,
  initial?: any,
) => new ReduceStream(opts, reduceFn, initial)
