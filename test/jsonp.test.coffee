should = require('chai').should()
MockServer = require('../index').MockServer
utils = require('./utils')
request = utils.request

describe 'JSONP', ->
  mock = undefined
  beforeEach ->
    mock = new MockServer
      port: utils.TESTING_PORT
      log_enabled: false
      path: __dirname + '/mock_data/'
      config: __dirname + '/mock_data/config_with_jsonp.json'
    mock.start()
  afterEach ->
    mock.stop()

  it 'should not use jsonp if no jsonp/callback parameter sent', (done) ->
    request 'get', '/test1', (res) ->
      res.statusCode.should.equal 200
      json = JSON.parse res.body
      json.should.have.property 'test'
      json.test.should.be.true
      done()
  it 'should use jsonp if callback parameter sent', (done) ->
    request 'get', '/test1?callback=myCallback', (res) ->
      res.statusCode.should.equal 200
      res.body.substr(0,11).should.equal 'myCallback('
      res.body.substr(-2).should.equal ');'
      done()
  it 'should use jsonp if jsonp parameter sent', (done) ->
    request 'get', '/test1?jsonp=myCallback', (res) ->
      res.statusCode.should.equal 200
      res.body.substr(0,11).should.equal 'myCallback('
      res.body.substr(-2).should.equal ');'
      done()