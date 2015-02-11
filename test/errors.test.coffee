should = require('chai').should()
MockServer = require('../index').MockServer
utils = require('./utils')
request = utils.request

describe 'Mock Server', ->
  mock = undefined

  startMock = (configName) ->
    mock = new MockServer({
        port: utils.TESTING_PORT,
        log_enabled: false,
        path: __dirname + '/mock_data/',
        config: __dirname + '/mock_data/' + configName + '.json'
      })
    mock.start()
  stopMock = ->
    mock.stop()

  describe 'Call specific error', ->
    beforeEach -> startMock('config_with_errors')
    afterEach -> stopMock()

    it 'GET /with_error.json should return a file specific error', (done) ->
      request 'get', '/with_error', (res) ->
        res.statusCode.should.equal 401
        json = JSON.parse res.body
        json.should.have.property 'error'
        json.error.should.equal 'Authentication required'
        done()

  describe 'General error', ->
    beforeEach -> startMock('config_with_general_errors')
    afterEach -> stopMock()

    it 'GET /test1.json should return a general error', (done) ->
      request 'get', '/test1', (res) ->
        res.statusCode.should.equal 400
        json = JSON.parse res.body
        json.should.have.property 'error'
        json.error.should.equal 'General error'
        done()

  describe 'General error with own rate', ->
    beforeEach -> startMock('config_with_general_errors_own_rates')
    afterEach -> stopMock()

    it 'GET /test1.json should return a general error', (done) ->
      request 'get', '/with_error', (res) ->
        res.statusCode.should.equal 400
        json = JSON.parse res.body
        json.should.have.property 'error'
        json.error.should.equal 'General error'
        done()


  describe 'General error with own rate', ->
    beforeEach -> startMock('config_with_error_rate_zero')
    afterEach -> stopMock()

    it 'GET /test1.json should return a general error', (done) ->
      request 'get', '/with_error_rate', (res) ->
        res.statusCode.should.equal 401
        json = JSON.parse res.body
        json.should.have.property 'error'
        json.error.should.equal 'Authentication required'
        done()