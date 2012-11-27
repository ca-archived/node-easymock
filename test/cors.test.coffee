should = require('chai').should()
MockServer = require('../index').MockServer
utils = require('./utils')
request = utils.request

startMock = (withCors) ->
  options =
    port: utils.TESTING_PORT
    log_enabled: false
    path: __dirname + '/mock_data/'
  if (withCors)
    options.config = __dirname + '/mock_data/config_with_cors.json'
  m = new MockServer(options)
  m.start()
  m


describe 'CORS', ->
  mock = undefined

  describe 'enabled', ->
    beforeEach ->
      mock = startMock(true)
    afterEach ->
      mock.stop()

    it 'should return CORS headers for any request', (done) ->
      request 'get', '/test1', (res) ->
        res.statusCode.should.equal 200
        res.headers['access-control-allow-origin'].should.equal '*'
        res.headers['access-control-allow-methods'].should.equal 'GET,PUT,POST,DELETE'
        res.headers['access-control-allow-headers'].should.equal 'Content-Type, Authorization'
        json = JSON.parse res.body
        json.should.have.property 'test'
        done()
    it 'should return CORS headers and no body for OPTIONS requests', (done) ->
      request 'options', '/test1', (res) ->
        res.statusCode.should.equal 200
        res.headers['access-control-allow-origin'].should.equal '*'
        res.headers['access-control-allow-methods'].should.equal 'GET,PUT,POST,DELETE'
        res.headers['access-control-allow-headers'].should.equal 'Content-Type, Authorization'
        done()

  describe 'false', ->
    beforeEach ->
      mock = startMock(false)
    afterEach ->
      mock.stop()

    it 'should return no CORS headers', (done) ->
      request 'get', '/test1', (res) ->
        res.statusCode.should.equal 200
        res.headers.should.not.have.property 'access-control-allow-origin'
        json = JSON.parse res.body
        json.should.have.property 'test'
        done()
    it 'should return not respond to OPTIONS requests', (done) ->
      request 'options', '/test1', (res) ->
        res.statusCode.should.equal 404
        done()