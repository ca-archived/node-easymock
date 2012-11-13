should = require('chai').should()
MockServer = require('../index').MockServer
utils = require('./utils')
request = utils.request

describe 'Mock Server with lag', ->
  mock = undefined
  beforeEach ->
    mock = new MockServer
      port: utils.TESTING_PORT
      log_enabled: false
      path: __dirname + '/mock_data/'
      config: __dirname + '/mock_data/config_with_lag.json'
    mock.start()
  afterEach ->
    mock.stop()

  it 'should add lag', (done) ->
    start = new Date
    request 'get', '/test1', (res) ->
      end = new Date
      lag = end.getTime() - start.getTime()
      lag.should.be.above 100
      console.log
      done()