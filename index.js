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
function PromiseStream(opts, fn, end) {
    if (!(this instanceof PromiseStream))
        return new PromiseStream(opts, fn, end)
    var args = defaults(opts, fn, end);
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
    .done(done, done);
}

PromiseStream.prototype._flush = complete
function complete(done) {
    if (!this.args.end) 
        this.args.end = nothing;
    Promise.fulfilled()
    .bind(this)
    .then(this.args.end)
    .bind(this._streamEnd)
    .then(nothing)
    .then(this._streamEnd.resolve)
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

PromiseStream.prototype.wait =
PromiseStream.prototype.promise = promise;
function promise() {
    return this._streamEnd.promise;
}

// MapPromiseStream

util.inherits(MapPromiseStream, PromiseStream);
function MapPromiseStream(opts, fn) {
    if (!(this instanceof MapPromiseStream))
        return new MapPromiseStream(opts, fn)
    PromiseStream.call(this, opts, fn);
    this.args.mapfn = this.args.fn;
    this.args.fn = mapStreamFn;
}

function mapStreamFn(el) {
    return this.push(this.args.mapfn(el));
}    

// ReducePromiseStream


util.inherits(ReducePromiseStream, PromiseStream);
function ReducePromiseStream(opts, fn, initial) {
    if (!(this instanceof ReducePromiseStream))
        return new ReducePromiseStream(opts, fn, initial)
    PromiseStream.call(this, opts, fn);
    this.reducefn = this.args.fn;
    this._defer = Promise.defer();
    this._initial = this.args.end;
    this._acc = null;

    this.args.fn = reduceStreamFn;
    this.args.end = reduceStreamEnd;

    this.on('error', this.rejectPromise);
}

ReducePromiseStream.prototype.wait =
ReducePromiseStream.prototype.promise = reduceStreamPromise;
function reduceStreamPromise() {
    return this._defer.promise;
}



function reduceNext(acc, el) { 
    return el; 
}

ReducePromiseStream.prototype.rejectPromise = function(e) {
    this._defer.reject(e);
}

function reduceStreamFn(el) {   
    var initial = this._initial,
        acc = this._acc;
    if (acc === null) 
        acc = initial ? Promise.cast(initial) 
            : Promise.cast(el);
    else            
        acc = Promise.join(acc, el)
            .spread(this.reducefn);                
    this._acc = acc;            
    return this.push(acc);

}

function reduceStreamEnd() {
    return this._acc
        .bind(this._defer)
        .then(this._defer.fulfill);
}

// wait

function waitStream(s) {
    var d = Promise.defer();
    var resolve = d.resolve.bind(d, s);
    var reject = d.reject.bind(d);
    s.on('end', resolve);
    s.on('finish', resolve);
    s.on('error', reject)
    return d.promise;
}

// API

exports.through = PromiseStream;
exports.map = MapPromiseStream;
exports.reduce = ReducePromiseStream;
exports.wait = waitStream
