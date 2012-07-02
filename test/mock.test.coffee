http = require("http")
should = should = require('chai').should()
TESTING_PORT = 12345

require("../lib").mock({ port: TESTING_PORT, log_enabled: false, path: __dirname + '/mock_data' })

describe 'Static files', ->
  it 'GET /test1_get.json should serve test1_get.json', (done) ->
    request 'get', '/test1', (res) ->
      res.statusCode.should.equal 200
      json = JSON.parse res.body
      json.should.have.property('test')
      json.test.should.be.true
      done()

describe 'Mock file', ->
  it 'GET /test1 should serve test1_get.json', (done) ->
    request 'get', '/test1', (res) ->
      res.statusCode.should.equal 200
      json = JSON.parse res.body
      json.should.have.property('test')
      json.test.should.be.true
      done()

  it 'POST /test1 should serve test1_post.json', (done) ->
    request 'post', '/test1', (res) ->
      res.statusCode.should.equal 200
      json = JSON.parse res.body
      json.should.have.property('post')
      json.post.should.be.true
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