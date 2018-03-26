import { collect } from './collect'
import { filter, FilterStream } from './filter'
import { pipe } from './pipe'
import { IReadableStreamOptions, read, readFunction, ReadStream } from './read'
import { readAsync } from './readAsync'
import { reduce, reduceFunction, ReduceStream } from './reduce'
import { ITransformStreamOptions, map, transform, transformFunction, TransformStream } from './transform'
import { wait } from './utils'
import { IWritableStreamOptions, write, writeFunction, WriteStream } from './write'

// types
export { IBluestream } from './interfaces'
export {
  IReadableStreamOptions,
  IWritableStreamOptions,
  ITransformStreamOptions,
  transformFunction,
  readFunction,
  reduceFunction,
  writeFunction,
}

// methods
export {
  FilterStream,
  ReadStream,
  ReduceStream,
  TransformStream,
  WriteStream,
  collect,
  filter,
  map,
  pipe,
  read,
  readAsync,
  reduce,
  transform,
  wait,
  write,
}

export default {
  FilterStream,
  ReadStream,
  ReduceStream,
  TransformStream,
  WriteStream,
  collect,
  filter,
  map,
  pipe,
  read,
  readAsync,
  reduce,
  transform,
  wait,
  write,
}
