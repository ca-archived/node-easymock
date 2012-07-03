http = require("http")

exports.TESTING_PORT = 12345
exports.request = (method, path, options, fn) ->
  if typeof(options) == 'function'
    fn = options
    options = undefined
  options = options || { headers: [] }
  req = http.request({
      method: method
    , port: exports.TESTING_PORT
    , host: 'localhost'
    , path: path
    , headers: options.headers
  })
  req.on 'response', (res) ->
    buf = ''
    res.setEncoding('utf8');
    res.on 'data', (chunk) ->
      buf += chunk
    res.on 'end', ->
      res.body = buf;
      fn(res)
  req.end()