# promise-streams  

A collection of streams that work well with promises (through, map, reduce)

# example

```js
var ps = require('promise-stream');
var B = require('bluebird');
var fs = require('fs');
var split = require('split');
var path = require('path');

fs.createReadStream(path.join(__dirname, 'test.txt'), 'utf8')
    .pipe(split())
    .pipe(ps.through(function(line) {
        console.log("Received", line, typeof(line));
        var delayed = B.delay(100).then(function() {
            return line ? parseFloat(line) : null;
        });
        return this.push(delayed);
    }))
    .map(function(el) {
        console.log('Multiply', el, typeof(el));
        return el * 2;
    })
    .reduce(function(acc, el) {
        console.log("Accumulate", acc, el, typeof(el));
        return acc + el;
    })
    .then(function(sum) {
        console.log("Result", sum);
    }).catch(function(e) {
        console.error(e.stack);
    })
```

# api

#### ps.through

`([opts:Options,] fn:(data[, enc]) => Promise)) => PromiseStream`

Create a through-promise stream. Pass it a function that takes data and 
encoding and uses `this.push` to push values or promises. This function should 
return a promise that indicates when the object/chunk are fully processed.

Returns a PromiseStream. 

#### ps.map

`([opts:Options,] fn: (data[, enc]) => Promise) => MapPromiseStream`

Create a new MapPromiseStream. The function should return a promise for the 
next object that will be pushed to the stream. 

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

#### PromiseStream.push

Like `this.push` in [through2](//github.com/rvagg/through2), but takes promise
arguments. It returns a promise that resolves when the pushed promise resolves,
to make it possible to use `return this.push(data)`

#### PromiseStream.map

`([opts:Options,] fn: (data[, enc]) => Promise) => MapPromiseStream`

Create a new MapPromiseStream and pipes this promise stream to it. 

#### PromiseStream.reduce

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



