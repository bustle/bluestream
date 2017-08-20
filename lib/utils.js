function defer () {
  var resolveCb, rejectCb
  var promise = new Promise(function (resolve, reject) {
    resolveCb = resolve
    rejectCb = reject
  })
  return { resolve: resolveCb, reject: rejectCb, promise }
}

function maybeResume (stream) {
  if (typeof stream.resume === 'function') {
    stream.resume()
  }
  return stream
}

function promiseFinally (promise, callback) {
  const fin = () => Promise.resolve(callback).then(() => promise)
  return promise.then(fin, fin)
}

module.exports = {
  defer,
  maybeResume,
  promiseFinally
}
