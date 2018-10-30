import { ITransformStreamOptions, TransformStream } from './transform'

export type ITapFunction = (data: any, encoding?: string) => any | Promise<any>

export class TapStream extends TransformStream {
  private tapFunction: ITapFunction

  constructor (opts?: ITransformStreamOptions | ITapFunction, tapFunction?: ITapFunction) {
      if (typeof opts === 'function') {
      super({})
      this.tapFunction = opts
    } else if (opts && typeof tapFunction === 'function') {
      super(opts)
      this.tapFunction = tapFunction
    } else {
      super({})
      this.tapFunction = () => {}
    }
  }

  public async _transform (data: any, encoding?: any) {
    const tapFunction = this.tapFunction
    await tapFunction(data, encoding)
    return data
  }
}

export const tap = (opts?: ITransformStreamOptions | ITapFunction, fn?: ITapFunction) => new TapStream(opts, fn)
