var Promise = require('bluebird');
var util = require('util');
var Transform = require('stream').Transform;

function nothing(x) { }
function identity(x) { return x; }

function defaults(opts, fn, end) {
    if (typeof(opts) === 'function') { 
        end = fn; fn = opts; opts = {}; 
    }
    if (!fn) fn = identity;
    if (typeof(opts.objectMode) === 'undefined')
        opts.objectMode = true;
    if (opts.limit)
        opts.highWaterMark = opts.limit;
    return {opts: opts, fn: fn, end: end};
}

// PromiseStream

util.inherits(PromiseStream, Transform);
function PromiseStream(args) {
    if (!(this instanceof PromiseStream))
        return new PromiseStream(args)
    this.args = args;
    this._streamEnd = Promise.defer();
    Transform.call(this, args.opts);
}

PromiseStream.prototype._transform = incoming;
function incoming(data, enc, done) {     
    Promise.cast([data, enc])
    .bind(this)
    .spread(this.args.fn)
    .then(nothing) // to avoid passing values
    .then(nothing)
    .done(done, done);
}

PromiseStream.prototype._flush = complete
function complete(done) {
    if (!this.args.end) return done();
    Promise.fulfilled()
    .bind(this)
    .then(this.args.end)
    .then(nothing)
    .done(done, done);

}

PromiseStream.prototype.push = push;
function push(data) {
    return Promise.cast(data)
    .bind(this)
    .then(Transform.prototype.push); 
}

PromiseStream.prototype.map = map;
function map(opts, fn, end) {
    var mstream = exports.map(opts, fn);
    this.pipe(mstream);
    return mstream;
}

PromiseStream.prototype.reduce = reduce;
function reduce(opts, fn, initial) {
    var reducer = exports.reduce(opts, fn, initial);
    this.pipe(reducer);
    return reducer.promise();
}

PromiseStream.prototype.promise = promise;
function promise() {
    return this._streamEnd;
}

// MapPromiseStream

util.inherits(MapPromiseStream, PromiseStream);
function MapPromiseStream(args) {
    PromiseStream.call(this, args);
    this.args.mapfn = args.fn;
    this.args.fn = mapStreamFn;
}

function mapStreamFn(el) {
    return this.push(this.args.mapfn(el));
}    

// ReducePromiseStream

util.inherits(ReducePromiseStream, PromiseStream);
function ReducePromiseStream(args) {
    PromiseStream.call(this, args);
    this.args.acc = null;
    this.args.reducefn = args.fn;
    this.args.fn = reduceStreamFn;
    this.args.end = reduceStreamEnd;
    this.promise = reduceStreamPromise;
    this._defer = Promise.defer();
    this.on('error', this.rejectPromise);
}

function reduceStreamPromise() {
    return this._defer.promise;
}

ReducePromiseStream.prototype.rejectPromise = function(e) {
    this._defer.reject(e);
}

function reduceStreamFn(el) {   
    var initial = this.args.initial,
        acc = this.args.acc;
    if (acc === null) 
        acc = initial ? Promise.cast(initial) 
            : Promise.cast(el);
    else            
        acc = Promise.all([acc, el])
            .spread(this.args.reducefn);
    this.args.acc = acc;            
    return this.push(acc);

}

function reduceStreamEnd() {
    return this.args.acc
        .bind(this._defer)
        .then(this._defer.fulfill);
}

// API

exports.through = function promiseThrough(opts, fn, end) {
    var args = defaults(opts, fn, end);
    return new PromiseStream(args);
}

exports.map = function promiseMap (mopts, f) {
    return new MapPromiseStream(defaults(mopts, f));
};

exports.reduce = function(mopts, f, initial) {
    return new ReducePromiseStream(defaults(mopts, f, initial));
}

