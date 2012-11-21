should = require('chai').should()
MockServer = require('../index').MockServer
utils = require('./utils')
request = utils.request

startMock = (withJsonp) ->
  options =
    port: utils.TESTING_PORT
    log_enabled: false
    path: __dirname + '/mock_data/'
  if (withJsonp)
    options.config = __dirname + '/mock_data/config_with_jsonp.json'
  m = new MockServer(options)
  m.start()
  m

describe 'JSONP', ->
  describe 'enabled', ->
    mock = undefined
    beforeEach ->
      mock = startMock(true)
    afterEach ->
      mock.stop()

    it 'should not use jsonp if no jsonp/callback parameter sent', (done) ->
      request 'get', '/test1', (res) ->
        res.statusCode.should.equal 200
        json = JSON.parse res.body
        json.should.have.property 'test'
        json.test.should.be.true
        done()

    testJsonpResponse = (res) ->
      res.statusCode.should.equal 200
      res.body.substr(0,11).should.equal 'myCallback('
      res.body.substr(-2).should.equal ');'
      json = JSON.parse res.body.substring(11, res.body.length - 2)
      json.should.have.property 'test'

    it 'should use jsonp if callback parameter sent', (done) ->
      request 'get', '/test1?callback=myCallback', (res) ->
        testJsonpResponse res
        done()
    it 'should use jsonp if jsonp parameter sent', (done) ->
      request 'get', '/test1?jsonp=myCallback', (res) ->
        testJsonpResponse res
        done()

  describe 'disabled', ->
    mock = undefined
    beforeEach ->
      mock = startMock(false)
    afterEach ->
      mock.stop()

    it 'should not use jsonp even if jsonp/callback parameter sent', (done) ->
      request 'get', '/test1?callback=myCallback', (res) ->
        res.statusCode.should.equal 200
        json = JSON.parse res.body
        json.should.have.property 'test'
        json.test.should.be.true
        done()