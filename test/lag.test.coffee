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

describe 'Mock Server with random lag', ->
  mock = undefined
  beforeEach ->
    mock = new MockServer
      port: utils.TESTING_PORT
      log_enabled: false
      path: __dirname + '/mock_data/'
      config: __dirname + '/mock_data/config_with_random_lag.json'
    mock.start()
  afterEach ->
    mock.stop()

  it 'should add random, variable lag', (done) ->
    start = new Date
    request 'get', '/test1', (res) ->
      end = new Date
      lag = end.getTime() - start.getTime()
      lag.should.be.above 200
      lag.should.be.below 1100
      console.log
      done()

describe 'Mock Server with lag object (lag on specific paths)', ->
  mock = undefined
  beforeEach ->
    mock = new MockServer
      port: utils.TESTING_PORT
      log_enabled: false
      path: __dirname + '/mock_data/'
      config: __dirname + '/mock_data/config_with_lag_object.json'
    mock.start()
  afterEach ->
    mock.stop()

  it 'should add the default lag when there are no matches', (done) ->
    start = new Date
    request 'get', '/test1', (res) ->
      end = new Date
      lag = end.getTime() - start.getTime()
      lag.should.be.above 1000
      console.log
      done()

  it 'should add the lag for the first path matched', (done) ->
    start = new Date
    request 'get', '/laggy', (res) ->
      end = new Date
      lag = end.getTime() - start.getTime()
      lag.should.be.above 500
      lag.should.be.below 800
      console.log
      done()

  describe 'should use regular expressions for matching', ->
    it 'and use the lag for the first match found', (done) ->
      start = new Date
      request 'get', '/lag_is_fun/12345', (res) ->
        end = new Date
        lag = end.getTime() - start.getTime()
        lag.should.be.above 200
        lag.should.be.below 1000
        console.log
        done()

    it 'and use the default lag if there are no matches', (done) ->
      start = new Date
      request 'get', '/lag_is_fun/but_this_wont_match', (res) ->
        end = new Date
        lag = end.getTime() - start.getTime()
        lag.should.be.above 1000
        console.log
        done()

    # Expression has [0-9]+ after the slash, so no content after the slash
    # should result in a non-match.
    it 'and use the default lag if there are no matches', (done) ->
      start = new Date
      request 'get', '/lag_is_fun/', (res) ->
        end = new Date
        lag = end.getTime() - start.getTime()
        lag.should.be.above 1000
        console.log
        done()
