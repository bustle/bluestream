import { batch, BatchStream } from './batch'
import { collect } from './collect'
import { filter, FilterStream, IFilterFunction } from './filter'
import { iterate } from './iterate'
import { pipe } from './pipe'
import { IReadableStreamOptions, IReadFunction, read, ReadStream } from './read'
import { readAsync } from './readAsync'
import { IReduceFunction, reduce, ReduceStream } from './reduce'
import { ITapFunction, tap, TapStream } from './tap'
import { ITransformFunction, ITransformStreamOptions, map, transform, TransformStream } from './transform'
import { wait } from './utils'
import { IWritableStreamOptions, IWriteFunction, write, WriteStream } from './write'

// types
export { IBluestream } from './interfaces'
export {
  IFilterFunction,
  IReadableStreamOptions,
  IReadFunction,
  IReduceFunction,
  ITapFunction,
  ITransformFunction,
  ITransformStreamOptions,
  IWritableStreamOptions,
  IWriteFunction,
}

// methods
export {
  batch,
  BatchStream,
  collect,
  filter,
  FilterStream,
  iterate,
  map,
  pipe,
  read,
  readAsync,
  ReadStream,
  reduce,
  ReduceStream,
  tap,
  TapStream,
  transform,
  TransformStream,
  wait,
  write,
  WriteStream,
}
