var through = require('through2');
var Promise = require('bluebird');

function identity(x) { return x; }

function isThenable(x) { 
    return (x && typeof(x.then) === 'function')
}

module.exports = function promiseThrough(opts, fn) {
    if (!fn) { 
        fn = opts;
        opts =  {}            
    }
    if (typeof(opts.objectMode) === 'undefined')
        opts.objectMode = true;
    if (opts.limit)
        opts.highWaterMark = opts.limit;

    if (!fn) fn = identity;

    var t = through(opts, incoming);

    function error(e) { t.emit('error', e);  }
    
    function incoming(data, enc, done) {
        if (!isThenable(data))
            data = Promise.cast(data);
        data.then(fn)
            .then(pushExceptUndefined)
            .catch(error)
            .done(done);
    }

    function pushExceptUndefined(data) {
        if (typeof(data) !== 'undefined')
            return t.push(data);
    }

    var oldpushInternal = t.push.bind(t);
    function oldpush(data) { oldpushInternal(data); }
    t.push = function(data) { 
        if (isThenable(data))
            return data.then(oldpush); 
        else
            return oldpush(data);
    }

    t.map = function(mopts, f) {
        if (!f) { 
            f = mopts;
            mopts = opts;
        }
        return t.pipe(promiseThrough(mopts, f));
    }
    t.reduce = function(mopts, f, initial) {        
        if (!f) {
            f = mopts;
            mopts = opts;
        }
        var def = Promise.defer(), acc;
        var x = t.pipe(promiseThrough(mopts, function(el) {
            if (typeof(acc) === 'undefined') 
                acc = initial ? Promise.cast(initial) 
                              : Promise.cast(el);
            else            
                acc = Promise.all([acc, el]).spread(f);
        }));
        t.on('end', function() { def.resolve(acc); })
        t.on('error', def.reject);
        x.on('error', def.reject);
        return def.promise;

    }
    return t;
}
