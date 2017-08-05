function defer () {
  var resolveCb, rejectCb
  var promise = new Promise(function (resolve, reject) {
    resolveCb = resolve
    rejectCb = reject
  })
  return { resolve: resolveCb, reject: rejectCb, promise: promise }
}

function maybeResume (stream) {
  if (typeof stream.resume === 'function') {
    stream.resume()
  }
  return stream
}

module.exports = {
  defer,
  maybeResume
}
