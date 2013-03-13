http = require('http')
_ = require('underscore')
request = require('request')

exports.TESTING_PORT = 12345
exports.request = (method, path, options, fn) ->
  if typeof(options) == 'function'
    fn = options
    options = undefined
  options = options || { headers: [] }
  req = request(_.extend({
      method: method
    , followRedirect: false
    , uri: 'http://localhost:' + exports.TESTING_PORT + path
  }, options), (e, r, body) ->
    r.body = body
    fn(r)
  )