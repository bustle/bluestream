# bluestream

[![Build Status](https://travis-ci.org/bustle/bluestream.svg?branch=master)](https://travis-ci.org/bustle/bluestream)

A collection of streams that work well with promises (through, map, reduce) forked from [promise-streams](https://github.com/spion/promise-streams) with some new features.

- `PromiseReadStream`
- `.collect()` supports object mode
- `.pipe()` resolves when the target stream finishes

# example

Using ES6 arrow functions:

```js
var Promise = require('bluebird'),
    request = require('request'),
    path = require('path'),
    fs = require('fs'),
    ps = require('promise-streams'),
    select = require('./select-elements');

Promise.promisifyAll(request);

var download = url =>
  ps.wait(request('http:' + url).pipe(
    fs.createWriteStream(
        'images/' + path.basename(url))));

var downloadAllFrom = url =>
    request(url)
    .pipe(select('.post a img', el => el.attributes.SRC))
    .pipe(ps.filter(url => /jpg$/.test(url.toLowerCase()))
    .pipe(ps.map({concurrent: 4}, imgurl => download(imgurl, url)))
    .reduce((count, stream) => count + 1, 0);

downloadAllFrom('http://imgur.com/').done(
    total => console.log(total, "images downloaded"),
    err   => console.error(err.stack))
```


# api

#### ps.through

`([opts:Options,] fn:(data[, enc]) => Promise)) => PromiseStream`

Create a through-promise stream. Pass it a function that takes data and
encoding and uses `this.push` to push values or promises. This function should
return a promise that indicates when the object/chunk are fully processed.

Returns a PromiseStream.

Options:

  * `concurrent` - The maximum number of concurrent promises that are allowed.
    When this limit is reached, the stream will stop processing data and will
    start buffering incoming objects. Defaults to `1`

  * `highWatermark` - the size (in objects) of the buffer mentioned above. When
    this buffer fills up, the backpressure mechanism will activate. Its passed
    to node's transform stream.

The other options are also passed to node's Transform stream constructor.

#### ps.map

`([opts:Options,] fn: (data[, enc]) => Promise) => MapPromiseStream`

Create a new MapPromiseStream. The function should return a promise for the
next object that will be pushed to the stream.

Options: Same as `ps.through`

#### ps.filter

`([opts:Options,] fn: (data[, enc]) => boolean) => FilterPromiseStream`

Create a new FilterPromiseStream. The function should return a boolean to
indicate whether the data value should pass to the next stream

Options: Same as `ps.through`

#### ps.reduce

`([opts:Options,] fn: (acc, data[, enc]) => Promise) => ReducePromiseStream`

Reduces the objects in this promise stream. The function takes the resolved
current accumulator and data object and should return the next accumulator
or a promise for the next accumulator.

The ReducePromiseStream has a `promise()` method which returns the final
accumulator value

```js
process.stdin.pipe(split()).pipe(es.reduce(function(acc, el) {
    return acc + el;
})).promise().then(function(sum) {

});
```

#### ps.wait

`(s: Stream) => Promise`

Wait for the stream to end. Also captures errors.

#### ps.pipe

`(source: Stream, destination: Stream) => Promise`

Pipes s1 to s2 and forwards all errors to the resulting promise. The promise is
fulfilled without a value when the destination stream ends.

#### ps.collect

`(source: Stream) => Promise`

Returns a Buffer, string or array of all the data events concatenated together. If no events null is returned.

#### ps.read

`([opts:Options,] fn:(bytesWanted) => Promise)) => PromiseReadStream`

Create a read-promise stream. Pass it a function that takes the number of bytes or objects of wanted data and and uses `this.push` or `return` to push values or promises. This function should
return a promise that indicates when the object/chunk are fully processed. Return `null` to end the stream.

Returns a PromiseStream.

Options:
  * `objectMode` - true or false
  * all other `Readable` stream options

The other options are also passed to node's Read stream constructor.


#### PromiseStream.prototype.push

Like `this.push` in [through2](//github.com/rvagg/through2), but takes promise
arguments. It returns a promise that resolves when the pushed promise resolves,
to make it possible to use `return this.push(data)`

#### PromiseStream.prototype.map

`([opts:Options,] fn: (data[, enc]) => Promise) => MapPromiseStream`

Create a new MapPromiseStream and pipes this promise stream to it.

#### PromiseStream.prototype.filter

`([opts:Options,] fn: (data[, enc]) => boolean) => FilterPromiseStream`

Create a new FilterPromiseStream and pipes this promise stream to it.

#### PromiseStream.prototype.reduce

`([opts:Options,] fn: (acc, data[, enc]) => Promise) => Promise`

Reduces the objects in this promise stream. The function takes the resolved
current accumulator and data object and should return the next accumulator
or a promise for the next accumulator.

Returns a promise for the final reduction result

#### PromiseStream.promise

`() => Promise`

Returns a promise fulfilled at the end of the stream, rejected if any errors
events are emitted by the stream.

For ReducePromiseStreams, the promise is for the final reduction result. Any
stream errors or exceptions encountered while reducing will result with a
rejection of the promise.
