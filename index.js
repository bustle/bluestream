var Promise = require('bluebird');
var util = require('util');
var Transform = require('stream').Transform;
var Buffer = require('buffer').Buffer

function nothing(x) { }
function identity(x) { return x; }

function defer() {
    var resolve, reject;
    var promise = new Promise(function(cb, eb) {
        resolve = cb; reject = eb;
    });
    return { resolve: resolve, reject: reject, promise: promise };
}


function defaults(opts, fn, end) {
    if (typeof opts === 'function') {
        end = fn; fn = opts; opts = {};
    }
    if (fn == null) fn = identity;
    if (opts.objectMode == null)
        opts.objectMode = true;
    return {opts: opts, fn: fn, end: end};
}

function nextTick() {
    return new Promise(function(resolve, reject) {
        process.nextTick(resolve);
    });
}

function maybeResume(stream) {
    if (typeof stream.resume === 'function') {
        stream.resume();
    }
    return stream;
}

//---------------------------------------
// PromiseStream
//---------------------------------------

util.inherits(PromiseStream, Transform);
function PromiseStream(opts, fn, end) {
    if (!(this instanceof PromiseStream))
        return new PromiseStream(opts, fn, end)
    var args = defaults(opts, fn, end);
    Transform.call(this, args.opts);
    this._fn = args.fn;
    this._end = args.end;
    this._streamEnd = defer();
    this._handlingErrors = false;
    this._concurrent = Math.max(1, args.opts.concurrent || 1);
    this._queue = [];
}

PromiseStream.prototype._transform = incoming;
function incoming(data, enc, done) {
    var queue = this._queue;
    var processed = Promise.resolve([data, enc])
        .bind(this)
        .spread(this._fn)
        .then(nothing);
    processed.catch(done);
    queue.push(processed);
    if (queue.length >= this._concurrent) {
        var next = queue.shift();
        // The delay is a workaround for the bad design of
        // node streams which forbid you to call done twice
        // at the same tick on the event loop, even if you
        // had events happening at the exact same tick
        if (next.isResolved()) nextTick().done(done, done)
        else next.done(done, done);
    }
    else {
        done();
    }
}

PromiseStream.prototype._flush = complete
function complete(done) {
    if (!this._end)
        this._end = nothing;
    Promise.all(this._queue)
    .then(nothing)
    .bind(this)
    .then(this._end)
    .then(this._finishUp)
    .done(done, done);

}

PromiseStream.prototype._finishUp = function() {
    this._streamEnd.resolve();
}

PromiseStream.prototype.push = push;
function push(data) {
    return Promise.resolve(data)
    .bind(this)
    .then(Transform.prototype.push, this.emitError);
}

PromiseStream.prototype.emitError = emitError;
function emitError(e) {
    this.emit('error', e)
}

PromiseStream.prototype.map = map;
function map(opts, fn, end) {
    var mstream = exports.map(opts, fn);
    this.pipe(mstream);
    return mstream;
}

PromiseStream.prototype.filter = filter;
function filter(opts, fn) {
    var fstream = exports.filter(opts, fn);
    this.pipe(fstream);
    return fstream;
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
    if (!this._handlingErrors) {
        this._handlingErrors = true;
        this.on('error', this._streamEnd.reject);
    }
    return maybeResume(this)._streamEnd.promise
}

//---------------------------------------
// MapPromiseStream
//---------------------------------------

util.inherits(MapPromiseStream, PromiseStream);
function MapPromiseStream(opts, fn) {
    if (!(this instanceof MapPromiseStream))
        return new MapPromiseStream(opts, fn)
    PromiseStream.call(this, opts, fn);
    this._mapfn = this._fn;
    this._fn = mapStreamFn;
}

function mapStreamFn(el) {
    return this.push(this._mapfn(el));
}

//---------------------------------------
// FilterPromiseStream
//---------------------------------------

util.inherits(FilterPromiseStream, PromiseStream);
function FilterPromiseStream(opts, fn) {
    if (!(this instanceof FilterPromiseStream))
        return new FilterPromiseStream(opts, fn)
    PromiseStream.call(this, opts, fn);
    this._filterFn = this._fn;
    this._fn = filterStreamFn;
}

function filterStreamFn(el) {
    if (this._filterFn(el))
        return this.push(el);
}

//---------------------------
// ReducePromiseStream
//---------------------------

util.inherits(ReducePromiseStream, PromiseStream);
function ReducePromiseStream(opts, fn, initial) {
    if (!(this instanceof ReducePromiseStream))
        return new ReducePromiseStream(opts, fn, initial)
    PromiseStream.call(this, opts, fn);
    this._reducefn = this._fn;
    this._reduceResult = defer();
    this._initial = this._end;
    this._acc = null;

    this._fn = reduceStreamFn;
    this._end = reduceStreamEnd;

    this.on('error', this._reduceResult.reject);
}

ReducePromiseStream.prototype.wait =
ReducePromiseStream.prototype.promise = reduceStreamPromise;
function reduceStreamPromise() {
    return maybeResume(this)._reduceResult.promise
}


function reduceStreamFn(el, enc) {
    var initial = this._initial,
        acc = this._acc;
    if (acc === null)
        acc = typeof(initial) !== 'undefined'
            ? Promise.cast(initial)
            : Promise.cast(el);
    else
        acc = Promise.join(acc, el, enc).spread(this._reducefn);
    this._acc = acc;
    return this.push(acc);

}

function reduceStreamEnd() {
    return Promise.cast(this._acc)
        .then(this._reduceResult.resolve);
}

//---------------------------
// wait
//---------------------------

function waitStream(s) {
    return new Promise(function(resolve, reject) {
        s.on('end', resolve);
        s.on('finish', resolve);
        s.on('error', reject);
        maybeResume(s)
    });
}

function collect(s) {
    var acc = [];
    return pipe(s, maybeResume(exports.through(function(data) {
        acc.push(data);
    }))).then(function() {
        if (!acc.length) return new Buffer();
        else if (typeof acc[0] === 'string')
            return acc.join('');
        else
            return Buffer.concat(acc);
    });
}

//---------------------------
// pipe
//---------------------------

function pipe(source, sink) {
    var resolve, reject;
    return new Promise(function(resolve_, reject_) {
        resolve = resolve_;
        reject = reject_;
        source
            .on("end", resolve)
            .on("error", reject)
            .pipe(sink)
            .on("error", reject);
    }).finally(function() {
        source.removeListener("end", resolve);
        source.removeListener("error", reject);
        sink.removeListener("error", reject);
    });
}

//---------------------------
// pipeline
//---------------------------

function pipeline() {
    var arr = [];
    for (var k = 1; k < arguments.length; ++k) {
        arr.push(pipe(arguments[k-1], arguments[k]));
    }
    return Promise.all(arr);
}

// API

exports.through = PromiseStream;
exports.map = MapPromiseStream;
exports.filter = FilterPromiseStream
exports.reduce = ReducePromiseStream;
exports.wait = waitStream;
exports.pipe = pipe;
exports.pipeline = pipeline;
exports.collect = collect;
