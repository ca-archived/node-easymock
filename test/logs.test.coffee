should = require('chai').should()
MockServer = require('../index').MockServer
utils = require('./utils')
fs = require('fs')
request = utils.request

describe 'Access Logs', ->
  mock = undefined
  beforeEach (done)->
    mock = new MockServer({ port: utils.TESTING_PORT, log_enabled: false, path: __dirname + '/mock_data/' })
    mock.start()
    mock.log.clear(done)
  afterEach ->
    mock.stop()

  describe 'mock.log.getLogs', ->
    it 'should return an empty array of logs for no requests', (done) ->
      mock.log.getLogs (err, result) ->
        result.length.should.exist
        result.length.should.equal 0
        done()

    it 'should return one log for one call', (done) ->
      request 'get', '/groups', (res) ->
        mock.log.getLogs (err, result) ->
          result.length.should.exist
          result.length.should.equal 1
          result[0].request_method.should.equal 'GET'
          result[0].request_path.should.equal '/groups'
          result[0].response_status.should.equal 200
          result[0].response_body.should.equal '{"name":"groups"}'
          done()

    it 'should return request_body with requested variables', (done) ->
      request 'post', '/groups', {form: {test:true}}, (res) ->
        mock.log.getLogs (err, result) ->
          result[0].request_body.should.equal 'test=true'
          done()

  describe 'GET /_logs/', ->
    it 'should return the access logs', (done) ->
      request 'get', '/_logs/', (res) ->
        res.statusCode.should.equal 200
        done()