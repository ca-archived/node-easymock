should = require('chai').should()
MockServer = require('../index').MockServer
utils = require('./utils')
fs = require('fs')
request = utils.request

describe 'API Documentation', ->
  mock = undefined
  beforeEach ->
    mock = new MockServer({ port: utils.TESTING_PORT, log_enabled: false, path: __dirname + '/mock_data/' })
    try
      # TODO refactor
      fs.unlinkSync(mock.options.path + '/_documentation/index.html')
      fs.unlinkSync(mock.options.path + '/_documentation/documentation.css')
      fs.unlinkSync(mock.options.path + '/_documentation/documentation.js')
      fs.unlinkSync(mock.options.path + '/_documentation/zepto.min.js')
      fs.rmdirSync(mock.options.path + '/_documentation')
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

  describe 'generateApiDocumentation', ->
    it 'should generate the html file', (done) ->
      mock.generateApiDocumentation () ->
        # TODO refactor
        fs.existsSync(mock.options.path + '/_documentation/index.html').should.be.true
        fs.existsSync(mock.options.path + '/_documentation/documentation.css').should.be.true
        fs.existsSync(mock.options.path + '/_documentation/documentation.js').should.be.true
        fs.existsSync(mock.options.path + '/_documentation/zepto.min.js').should.be.true
        done()