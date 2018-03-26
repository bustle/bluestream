import { Readable, Stream } from 'stream'

export interface IBluestream extends Stream {
  promise (): Promise<void>
}
