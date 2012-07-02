http = require("http")
should = should = require('chai').should()
TESTING_PORT = 12345

require("../lib").mock({ port: TESTING_PORT, log_enabled: false })

describe 'Static data', ->
  it 'should be served', (done) ->
    request 'get', '/static/file.json', (res) ->
      console.log res.statusCode
      done()



request = (method, path, options, fn) ->
  if typeof(options) == 'function'
    fn = options
    options = undefined
  options = options || { headers: [] }
  req = http.request({
      method: method
    , port: TESTING_PORT
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