export function defer () {
  let resolveCb, rejectCb
  const promise = new Promise(function (resolve, reject) {
    resolveCb = resolve
    rejectCb = reject
  })
  return { resolve: resolveCb, reject: rejectCb, promise }
}

export function maybeResume (stream) {
  if (typeof stream.resume === 'function') {
    stream.resume()
  }
  return stream
}

export async function wait (stream) {
  if (typeof stream.promise === 'function') {
    return stream.promise()
  }

  return new Promise(function (resolve, reject) {
    stream.on('end', resolve)
    stream.on('finish', resolve)
    stream.on('error', reject)
    maybeResume(stream)
  })
}
