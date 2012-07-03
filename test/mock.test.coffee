should = require('chai').should()
MockServer = require("../lib").MockServer
utils = require('./utils')
request = utils.request

describe 'Mock Server', ->
  mock = undefined
  beforeEach ->
    mock = new MockServer({ port: utils.TESTING_PORT, log_enabled: false, path: __dirname + '/mock_data/' })
    mock.start()
  afterEach ->
    mock.stop()

  describe 'Static files', ->
    it 'GET /test1_get.json should serve test1_get.json', (done) ->
      request 'get', '/test1', (res) ->
        res.statusCode.should.equal 200
        json = JSON.parse res.body
        json.should.have.property('test')
        json.test.should.be.true
        done()

  describe 'Mock file', ->
    it 'GET /test1 should serve test1_get.json', (done) ->
      request 'get', '/test1', (res) ->
        res.statusCode.should.equal 200
        json = JSON.parse res.body
        json.should.have.property('test')
        json.test.should.be.true
        done()

    it 'POST /test1 should serve test1_post.json', (done) ->
      request 'post', '/test1', (res) ->
        res.statusCode.should.equal 200
        json = JSON.parse res.body
        json.should.have.property('post')
        json.post.should.be.true
        done()

  describe 'Templates', ->
    it '{{Object1}} should be replaced with _templates/Object1.json', (done) ->
      request 'get', '/with_template', (res) ->
        res.statusCode.should.equal 200
        json = JSON.parse res.body
        json.should.have.property 'object1'
        json.object1.should.have.property 'value1'
        json.object1.value1.should.equal 'test1'
        json.object1.should.have.property 'value2'
        json.object1.value2.should.equal 'test2'
        done()

  describe 'Variables', ->
    it '#{server} should be replaced with server variable from config.json', (done) ->
      request 'get', '/with_variable', (res) ->
        res.statusCode.should.equal 200
        json = JSON.parse res.body
        json.should.have.property 'image'
        json.image.should.equal 'http://server.com/image.jpg'
        done()