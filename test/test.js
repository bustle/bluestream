
var pthrough = require('./');
var B = require('bluebird');
var fs = require('fs');
var split = require('split');

var through = require('through2');

fs.createReadStream('test.txt', 'utf8')
    .pipe(split())
    .pipe(through({objectMode: true, highWaterMark: 3}, function(chunk, e, cb) {
        console.log('Input', chunk); 
        this.push(chunk); 
        cb();
    }))
    .pipe(pthrough({limit: 3}, function(line) {
        return B.delay(Math.ceil(300 * Math.random())).then(function() {
            return line;
        });
    }))
    .map(function(el) {
        console.log('Element', el);
        return el * 2;
    })
    .reduce(function(acc, el) {
        console.log("Reduce", acc, el);
        return acc + el;
    }, 0)
    .then(function(sum) {
        console.log("Sum", sum);
    }).catch(function(e) {
        console.error(e.stack);
    })
