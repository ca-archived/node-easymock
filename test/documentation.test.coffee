should = require('chai').should()
MockServer = require('../index').MockServer
utils = require('./utils')
fs = require('fs')
request = utils.request

describe 'API Documentation', ->
  mock = undefined
  beforeEach ->
    mock = new MockServer({ port: utils.TESTING_PORT, log_enabled: false, path: __dirname + '/mock_data/' })
    mock.start()
  afterEach ->
    mock.stop()

  describe 'getApiDocumentationJson', ->
    it 'should return an array of calls', (done) ->
      mock.getApiDocumentationJson (err, result) ->
        result.length.should.exist
        result[0].method.should.equal 'GET'
        result[0].path.should.exist
        done()

    it 'should sort the calls by path', (done) ->
      mock.getApiDocumentationJson (err, result) ->
        result[0].path.should.equal '/groups'
        done()

    it 'should replace the route parameter', (done) ->
      mock.getApiDocumentationJson (err, result) ->
        result[1].path.should.equal '/groups/:groupid'
        done()

    it 'should return input output documentation', (done) ->
      mock.getApiDocumentationJson (err, result) ->
        result[0].path.should.equal '/groups'
        result[0].output.length.should.equal 2
        result[0].output[0].should.equal '200'
        result[0].output[1].should.equal 'Content-Type: application/json'

        result[7].path.should.equal '/test1'
        result[7].input.length.should.equal 2
        result[7].input[0].should.equal 'Content-Type: application/json'
        result[7].input[1].should.equal '{ "post": true }'
        done()

    it 'should return description', (done) ->
      mock.getApiDocumentationJson (err, result) ->
        result[0].description.should.equal 'Retrieve the groups<br />\nSecond line'
        done()

    it 'should return proxy (true if call will run proxied)', (done) ->
      mock.getApiDocumentationJson (err, result) ->
        result[4].proxy.should.be.true
        done()

  describe 'GET /_documentation/', ->
    it 'should return the api documentation', (done) ->
      request 'get', '/_documentation/', (res) ->
        res.statusCode.should.equal 200
        done()
