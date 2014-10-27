# promise-streams

A collection of streams that work well with promises (through, map, reduce)

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
  request('http:' + url).pipe(
    fs.createWriteStream(
        'images/' + path.basename(url)));

var downloadAllFrom = urls =>
  Promise.all(urls.map(url =>
    request(url)
    .pipe(select('.post a img', el => el.attributes.SRC))
    .pipe(ps.map({concurrent: 4}, imgurl =>
        ps.wait(download(imgurl, url))))
    .reduce((imagesPerUrl, stream) => imagesPerUrl + 1, 0)))
  .reduce((total, imagesPerUrl) => total + imagesPerUrl);

downloadAllFrom(['http://imgur.com/']).done(
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
fulfilled without a value when the source stream ends.

#### PromiseStream.prototype.push

Like `this.push` in [through2](//github.com/rvagg/through2), but takes promise
arguments. It returns a promise that resolves when the pushed promise resolves,
to make it possible to use `return this.push(data)`

#### PromiseStream.prototype.map

`([opts:Options,] fn: (data[, enc]) => Promise) => MapPromiseStream`

Create a new MapPromiseStream and pipes this promise stream to it.

#### PromiseStream.prototype.reduce

`([opts:Options,] fn: (acc, data[, enc]) => Promise) => Promise`

Reduces the objects in this promise stream. The function takes the resolved
current accumulator and data object and should return the next accumulator
or a promise for the next accumulator.

Returns a promise for the final reduction result

#### PromiseStream.promise

`() => Promise`

Returns a promise fulfilled at the end of the stream.

For ReducePromiseStreams, the promise is for the final reduction result. Any
stream errors or exceptions encountered while reducing will result with a
rejection of the promise.
