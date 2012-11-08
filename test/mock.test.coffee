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
        json.should.have.property 'test'
        json.test.should.be.true
        done()

  describe 'Mock file', ->
    it 'GET /test1 should serve test1_get.json', (done) ->
      request 'get', '/test1', (res) ->
        res.statusCode.should.equal 200
        json = JSON.parse res.body
        json.should.have.property 'test'
        json.test.should.be.true
        done()

    it 'POST /test1 should serve test1_post.json', (done) ->
      request 'post', '/test1', (res) ->
        res.statusCode.should.equal 200
        json = JSON.parse res.body
        json.should.have.property 'post'
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
    it '#{_1} should be replaced with template parameter', (done) ->
      request 'get', '/with_template_param', (res) ->
        res.statusCode.should.equal 200
        json = JSON.parse res.body
        json.should.have.property 'object'
        json.object.should.have.property 'name'
        json.object.name.should.equal 'Object 1'
        done()
    it '#{_1}, #{_2}, #{_3} should all be replaced with template parameter', (done) ->
      request 'get', '/with_template_params', (res) ->
        res.statusCode.should.equal 200
        json = JSON.parse res.body
        json.should.have.length 3
        json[0].should.have.property('name').and.equal 'Item 1'
        json[0].should.have.property('image').and.equal 'http://server.com/img/img_one.jpg'
        json[0].should.have.property('active').and.be.true

        json[1].should.have.property('name').and.equal 'Item 2'
        json[1].should.have.property('image').and.equal 'http://server.com/img/img_two.jpg'
        json[1].should.have.property('active').and.be.false

        json[2].should.have.property('name').and.equal 'Item 3'
        json[2].should.have.property('image').and.equal 'http://server.com/img/img_three.jpg'
        json[2].should.have.property('active').and.be.true
        done()

  describe 'Routes /groups/:id', ->
    it '/groups/1 remapped to /groups/id', (done) ->
      request 'get', '/groups/1', (res) ->
        res.statusCode.should.equal 200
        json = JSON.parse res.body
        json.id.should.equal '1234'
        json.name.should.equal 'Group'
        done()
    it '/groups/1 should supply a #{id} variable that gets replaced', (done) ->
      request 'get', '/groups/1', (res) ->
        res.statusCode.should.equal 200
        json = JSON.parse res.body
        json.name2.should.equal 'Group 1'
        done()
    it '/groups/1/users/2 should supply a #{id} and ${userid} variable that gets replaced', (done) ->
      request 'get', '/groups/1/users/2', (res) ->
        res.statusCode.should.equal 200
        json = JSON.parse res.body
        json.groupid.should.equal '1'
        json.userid.should.equal '2'
        done()