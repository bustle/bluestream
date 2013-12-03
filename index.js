var through = require('through2');
var Promise = require('bluebird');

function identity(x) { return x; }

function defaults(opts) {
    if (typeof(opts.objectMode) === 'undefined')
        opts.objectMode = true;
    if (opts.limit)
        opts.highWaterMark = opts.limit;
    return opts;
}

var exports = module.exports = function promiseThrough(opts, fn) {
    if (!fn) { fn = opts; opts = {}; }

    var stream = through(defaults(opts), incoming, ended);

    if (!fn) fn = identity;
    fn = fn.bind(stream);

    function incoming(data, enc, done) {     
        Promise.cast([data, enc]).spread(fn)
        .done(function(v) { done();  }, 
              function(e) { done(e); });
    }

    function ended() { 
        this.push(null);
        streamEnd.fulfill(); 
    }


    var oldpush = stream.push.bind(stream);
    var streamEnd = Promise.defer();

    stream.promise = streamEnd.promise;

    stream.push = function push(data) {       
        return Promise.cast(data).then(oldpush); 
    }

    stream.map = function(mopts, f) {
        if (!f) { f = mopts; mopts = opts; }
        var mstream = exports.map(mopts, f);
        stream.pipe(mstream);
        return mstream;
    }
    stream.reduce = function(mopts, f, initial) {        
        if (!f) { f = mopts; mopts = {}; }
        defaults(mopts);
        var reducer = exports.reduce(mopts, f, initial);
        stream.pipe(reducer);
        return reducer.promise;
    }
    return stream;
}

exports.map = function(mopts, f) {
    if (!f) { f = mopts; mopts = {}; }
    defaults(mopts);
    var smap = exports(mopts, function(el) {
        return this.push(f(el));
    })
    return smap;
};

exports.reduce = function(mopts, f, initial) {
    if (!f) { f = mopts; mopts = {}; }
    defaults(mopts);
    var def = Promise.defer(), acc;

    var x = exports(mopts, function(el) {
        if (typeof(acc) === 'undefined') 
            acc = initial ? Promise.cast(initial) 
        : Promise.cast(el);
        else            
            acc = Promise.all([acc, el]).spread(f);
        return this.push(acc);
    });
    x.promise.then(function ended() {
        def.resolve(acc); 
    });
    x.on('error', function errored(e) {
        def.reject(e) 
    });
    x.promise = def.promise;
    return x;
}
