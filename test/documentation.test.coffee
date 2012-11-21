should = require('chai').should()
MockServer = require('../index').MockServer
utils = require('./utils')
fs = require('fs')
request = utils.request
files = [
  '/_documentation/index.html',
  '/_documentation/documentation.css',
  '/_documentation/documentation.js',
  '/_documentation/zepto.min.js',
]

describe 'API Documentation', ->
  mock = undefined
  beforeEach ->
    mock = new MockServer({ port: utils.TESTING_PORT, log_enabled: false, path: __dirname + '/mock_data/' })
    for file in files
      try
        fs.unlinkSync(mock.options.path + file)
    mock.start()
  afterEach ->
    mock.stop()

  describe 'getApiDocumentation', ->
    it 'should return an array of calls', (done) ->
      mock.getApiDocumentation (err, result) ->
        result.length.should.exist
        result[0].method.should.equal 'GET'
        result[0].path.should.exist
        done()

    it 'should sort the calls by path', (done) ->
      mock.getApiDocumentation (err, result) ->
        result[0].path.should.equal '/groups'
        done()

    it 'should replace the route parameter', (done) ->
      mock.getApiDocumentation (err, result) ->
        result[1].path.should.equal '/groups/:groupid/show'
        done()

    it 'should return input output documentation', (done) ->
      mock.getApiDocumentation (err, result) ->
        result[0].output.length.should.equal 2
        result[0].output[0].should.equal '200'
        result[0].output[1].should.equal 'Content-Type: application/json'

        result[5].input.length.should.equal 2
        result[5].input[0].should.equal 'Content-Type: application/json'
        result[5].input[1].should.equal '{ "post": true }'
        done()

  describe 'generateApiDocumentation', ->
    it 'should generate the html file', (done) ->
      for file in files
        fs.existsSync(mock.options.path + file).should.be.false
      mock.generateApiDocumentation () ->
        for file in files
          fs.existsSync(mock.options.path + file).should.be.true
        done()