should = require('chai').should()
MockServer = require('../index').MockServer
utils = require('./utils')
request = utils.request

describe 'Mock Server', ->
  mock = undefined
  beforeEach ->
    mock = new MockServer({
        port: utils.TESTING_PORT,
        log_enabled: false,
        path: __dirname + '/mock_data/',
        config: __dirname + '/mock_data/config_with_errors.json'
      })
    mock.start()
  afterEach ->
    mock.stop()

  describe 'Error result', ->
    it 'GET /with_error.json should return an error', (done) ->
      request 'get', '/with_error', (res) ->
        res.statusCode.should.equal 401
        json = JSON.parse res.body
        json.should.have.property 'error'
        json.error.should.equal 'Authentication required'
        done()
