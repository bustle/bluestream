import { collect } from './collect'
import { FilterStream, filter } from './filter'
import { pipe } from './pipe'
import { readAsync } from './readAsync'
import { ReadStream, read } from './read'
import { ReduceStream, reduce } from './reduce'
import { TransformStream, transform, map } from './transform'
import { wait } from './utils'
import { WriteStream, write } from './write'

export { collect } from './collect'
export { FilterStream, filter } from './filter'
export { pipe } from './pipe'
export { readAsync } from './readAsync'
export { ReadStream, read } from './read'
export { ReduceStream, reduce } from './reduce'
export { TransformStream, transform, map } from './transform'
export { wait } from './utils'
export { WriteStream, write } from './write'

export default {
  collect,
  filter,
  FilterStream,
  map,
  pipe,
  read,
  readAsync,
  ReadStream,
  reduce,
  ReduceStream,
  transform,
  TransformStream,
  wait,
  write,
  WriteStream
}
