# bluestream 🏄‍♀️

[![Build Status](https://travis-ci.org/bustle/bluestream.svg?branch=master)](https://travis-ci.org/bustle/bluestream) [![Try bluestream on RunKit](https://badge.runkitcdn.com/bluestream.svg)](https://npm.runkit.com/bluestream)


Bluestream is a collection of NodeJS Streams and stream utilities that work well with promises and async functions. Think `through2-concurrent` with promise support. The goal is to reduce the edge cases when mixing streams and promises. In general, Promises are slower than callbacks, but these streams are a lot more forgiving than node core.

If you don't need streams but want to work with data over time, check out sister project [`streaming-iterables 🏄‍♂️`](https://www.npmjs.com/package/streaming-iterables)!

Written in typescript, designed in NYC.

## Install
There are no dependencies.

```bash
npm install bluestream
```

# Examples

```js
import { read, transform, write, pipe } from 'bluestream'
import got from 'got'

// paginate an API
const pokeStream = read(async function () {
  this.offset = this.offset || 0
  const { body: { results } } = await got(`https://pokeapi.co/api/v2/pokemon/?offset=${this.offset}`, { json: true })
  if (results.length > 0) {
    this.offset += results.length
    for (const monster of results) {
      this.push(monster)
    }
  } else {
    return null
  }
})

const fetchMonsterInfo = transform({ concurrent: 2 }, async ({ url }) => {
  const { body } = await got(url, { json: true })
  return body
})

const logStream = write(pokemon => {
  console.log(`<h1>${pokemon.name}</h1><img src="${pokemon.sprites.front_default}">`)
})

await pipe(
  pokeStream,
  fetchMonsterInfo,
  logStream
)
console.log('caught them all')
```

# api

- [`read()`](#read)
- [`ReadStream()`](#readstream)
- [`transform()`](#transform) (alias `map`)
- [`TransformStream()`](#transformstream)
- [`write()`](#write)
- [`WriteStream()`](#writestream)
- [`filter()`](#filter)
- [`reduce()`](#reduce)
- [`tap()`](#tap)
- [`batch()`](#batch)
- [`wait()`](#wait)
- [`pipe()`](#pipe)
- [`collect()`](#collect)
- [`readAsync()`](#readasync)
- [`iterate()`](#iterate)
- [`promise()`](#promise)

## read

`([opts:Options,] fn:(bytesWanted) => Promise)) => ReadStream`


## ReadStream

Creates a read-promise stream which accepts a function that takes the number of bytes or objects of wanted data as arguments and uses `this.push` or `return` to push values or promises. This function should return a promise that indicates when the object/chunk is fully processed. Return or push `null` to end the stream.

Options:
  * `read` - An optional way to pass the read function

  * `objectMode` - true or false

  * all other `Readable` stream options

The other options are also passed to node's Read stream constructor.

A `ReadStream` works like a normal `ReadableStream` but the `_read` and `push()` methods have some noteworthy differences. (The `_read` method can be provided as the only argument, in a `read` key on the options, or as the `_read` method if you extend `ReadStream`.) Any returned, non-undefined value will automatically be pushed. Object mode is the default.

`_read(bytesWanted)`
- Is async function friendly, handles throws/rejects as error events
- Is called again only after it returns or resolves regardless of how many times you call `.push`
- Is called again if you don't push (to aid in control flow)
- Pushes any non `undefined` return values

`this.push()`
- Can be called in a promise, which will be resolved and then pushed as normal
- Returns true or false like a normal stream's push

This allows you to use it in some friendly ways:

```js
// readable stream from an array
const list = [1, 2, 3]
const listStream = bstream.read(() => list.shift() || null)

// readable stream from redis scans
import Redis from 'io-redis'
const redis = new Redis()
let cursor = 0

const hscanStream = bstream.read(async () => {
  const [newCursor, keys] = await redis.scan('cursor', cursor)
  keys.map(key => this.push(key))
  if (newCursor === '0') {
    this.push(null)
  }
  cursor = newCursor
})
```

## transform (alias map)

`transform([opts:Options,] fn:(data[, enc]) => Promise)): TransformStream`

`map([opts:Options,] fn:(data[, enc]) => Promise)): TransformStream`

## TransformStream

Creates a transform-promise stream which accepts a function that takes data and
encoding as arguments and uses `this.push` to push values or promises. Any returned, non-undefined value will automatically be pushed. This function should return a promise that indicates when the object/chunk is fully processed.

Options:
  * `transform` - An optional way to pass the transform function

  * `concurrent` - The maximum number of concurrent promises that are allowed.
    When this limit is reached, the stream will stop processing data and will
    start buffering incoming objects. Defaults to `1`

  * `highWatermark` - the size (in objects) of the buffer mentioned above. When
    this buffer fills up, the backpressure mechanism will activate. It's passed
    to node's transform stream.

The other options are also passed to node's Transform stream constructor.

## write

`write([opts:Options,] fn:(data[, enc]) => Promise)): WriteStream`

## WriteStream

`new WriteStream(inputOpts: IWritableStreamOptions | writeFunction, fn?: writeFunction): WriteStream`

Creates a write-promise stream which accepts a function that takes data and encoding as arguments and returns a promise that indicates when the object/chunk is fully processed.

Options:
  * `write` - An optional way to pass the write function

  * `writev` - Not supported, and passed directly to the underlying `Writable` stream

  * `concurrent` - The maximum number of concurrent promises that are allowed.
    When this limit is reached, the stream will stop processing data and will
    start buffering incoming objects. Defaults to `1`

  * `highWatermark` - the size (in objects) of the buffer mentioned above. When
    this buffer fills up, the backpressure mechanism will activate. It's passed
    to node's write stream.

The other options are also passed to node's Write stream constructor.

## filter

`filter([opts:Options,] fn: async (data[, enc]) => boolean): FilterStream`

Creates a new FilterStream which accepts a function that takes data and encoding as arguments and returns a boolean to
indicate whether the data value should pass to the next stream

Options: Same as `transform`

## reduce

`reduce([opts:Options,] fn: (acc, data[, enc]) => Promise): ReduceStream`

Creates a new ReduceStream which accepts a function that takes the resolved
current accumulator, data object, and encoding as arguments and returns the next accumulator
or a promise for the next accumulator.

The ReduceStream has a `promise()` method which returns the final
accumulator value

```js
process.stdin.pipe(split()).pipe(es.reduce(function(acc, el) {
    return acc + el;
})).promise().then(function(sum) {

});
```

## tap

```ts
tap(opts?: ITransformStreamOptions | ITapFunction, fn?: ITapFunction) => TapStream
new TapStream(opts?: ITransformStreamOptions | ITapFunction, tapFunction?: ITapFunction)
```

A passthrough stream that intercepts data and lets you process it. Supports async tap functions which will delay processing. Supports `concurrent` if you need it.

```ts
import { pipe, tap, write } from 'bluestream'
import { ghoulGenerator, saveGhoul } from './util'

await pipe(
  ghoulGenerator(),
  tap(console.log),
  write(ghoul => saveGhoul(ghoul))
)
// Ghoul(1)
// Ghoul(2)
// Ghoul(3)
// ... 👻
```

## batch
```ts
batch(batchSize: number) => BatchStream
new BatchStream(batchSize: number)
```

A stream that collects a given number of objects and emits them in an array.

```ts
import { batch, pipe, write } from 'bluestream'
import { turkeyGenerator } from './util'

await pipe(
  turkeyGenerator(),
  batch(2),
  write(console.log)
)
// [turkey, turkey]
// [turkey, turkey]
// [turkey, turkey]
// [turkey, turkey]
// ... 🐧🐧
```

## wait

`wait(stream: Stream): Promise<any>`

Waits for the stream to end. Rejects on errors. If the stream has a `.promise()` method, it will resolve that value, e.g., from [reduce](#reduce).

## pipe

`pipe(readable: Readable, ...writableStreams: Writable[]): Promise<any>;`

Pipes readable to writableStreams and forwards all errors to the resulting promise. The promise resolves when the destination stream ends. If the last writableStream has a `.promise()` method, it is resolved. If the last stream is a reduce stream the final value is resolved.

Generic Pipe example
```ts
import { pipe, read, write } from 'bluestream'
const values = [1, 2, 3, null]
await pipe(
  read(() => values.shift()),
  write(number => console.log(number))
)

```

Pipe example with reduce
```ts
import { pipe, read, reduce } from 'bluestream'
const values = [1, 2, 3, null]
const sum = await pipe(
  read(() => values.shift()),
  reduce((total, value) => total + value, 0)
)
console.log(sum)
// 6
```

## collect

`collect(stream: Readable): Promise<null | string | any[] | Buffer>`

Returns a Buffer, string or array of all the data events concatenated together. If there are no events, null is returned.

```ts
import { collect, read } from 'bluestream'
await collect(fs.readStream('file'))
// <Buffer 59 6f 75 20 61 72 65 20 63 6f 6f 6c 21>
await collect(fs.readStream('file', 'utf8'))
// 'You are cool!'
const values = [1, 2, 3, null]
await collect(read(() => values.shift()))
// [1, 2, 3]
await collect(read(() => null))
// null
```

## readAsync

`readAsync(stream: Readable, count?: number): Promise<any>`

Returns a count of bytes in a Buffer, characters in a string, or objects in an array. If no data arrives before the stream ends, `null` is returned.

## iterate

`iterate(stream: Readable): Readable | AsyncIterableIterator<any>`

Returns an async iterator for any stream on node 8+

## promise

`promise(stream: Readable) => Promise(any)`

All bluestream streams implement a promise method that returns a promise that is fulfilled at the end of the stream or rejected if any errors are emitted by the stream.

For `ReduceStreams`, the promise is for the final reduction result. Any stream errors or exceptions encountered while reducing will result in a rejection of the promise.

```ts
const { pipe, map, tap, reduce } = require('bluestream')
const { Nodes } = require('./util')

let count = 0
const stats = await pipe(
  Nodes.scan({ fields: true }),
  map(generateStats),
  tap(() => count++),
  reduce(mergeGraphStats, {})
)
console.log({ count, stats })
```

# Credits

Made by the loving team at [@bustle](https://bustle.com/jobs) and maybe [you](https://github.com/bustle/bluestream/compare)?
