import { FilterStream, filter } from './filter'
import { ReadStream, read } from './read'
import { ReduceStream, reduce } from './reduce'
import { TransformStream, transform, map } from './transform'
import { WriteStream, write } from './write'
import { wait } from './utils'
import { pipe } from './pipe'
import { collect } from './collect'

export { FilterStream, filter } from './filter'
export { ReadStream, read } from './read'
export { ReduceStream, reduce } from './reduce'
export { TransformStream, transform, map } from './transform'
export { WriteStream, write } from './write'
export { wait } from './utils'
export { pipe } from './pipe'
export { collect } from './collect'

export default {
  FilterStream,
  filter,
  ReadStream,
  read,
  ReduceStream,
  reduce,
  TransformStream,
  transform,
  map,
  WriteStream,
  write,
  wait,
  pipe,
  collect
}
