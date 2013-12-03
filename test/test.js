
var ps = require('../');
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

