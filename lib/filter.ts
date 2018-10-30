import { ITransformStreamOptions, TransformStream } from './transform'

export type IFilterFunction = (data: any, encoding?: string) => boolean | Promise<boolean>

export class FilterStream extends TransformStream {
  private filterFunction: IFilterFunction

  constructor (opts: ITransformStreamOptions | IFilterFunction, filterFunction?: IFilterFunction) {
    if (typeof opts === 'function') {
      super({})
      this.filterFunction = opts
    } else if (typeof filterFunction === 'function') {
      super(opts)
      this.filterFunction = filterFunction
    } else {
      throw TypeError('No "filterFunction" provided')
    }
  }

  public async _transform (data: any, encoding?: any) {
    const keep = await this.filterFunction(data, encoding)
    if (keep) {
      await this.push(data)
    }
  }
}

// tslint:disable-next-line:max-line-length
export const filter = (opts: ITransformStreamOptions | IFilterFunction, fn?: IFilterFunction) => new FilterStream(opts, fn)
