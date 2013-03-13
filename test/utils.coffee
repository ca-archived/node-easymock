http = require('http')
_ = require('underscore')
request = require('request')

exports.TESTING_PORT = 12345
exports.request = (method, path, options, fn) ->
  if typeof(options) == 'function'
    fn = options
    options = undefined
  options = options || { headers: [] }
  options = _.extend({
      method: method
    , followRedirect: false
    , uri: 'http://localhost:' + exports.TESTING_PORT + path
  }, options)
  req = request(options)
  req.on 'response', (res) ->
    buf = ''
    res.setEncoding('utf8');
    res.on 'data', (chunk) ->
      buf += chunk
    res.on 'end', ->
      res.body = buf;
      fn(res)
  req.end()