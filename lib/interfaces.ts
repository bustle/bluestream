import { Stream } from 'stream'

export interface IBluestream extends Stream {
  readonly promise: () => Promise<void>
}
