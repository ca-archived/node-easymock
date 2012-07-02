var express = require('express');
var fs = require('fs');
var url = require('url');
var http = require('http');
var path = require('path');
var httpProxy = require('http-proxy');

var TEMPLATE_PATTERN = new RegExp(/{{.*}}/g);

exports.version = '0.0.1';

exports.mock = function(options) {
  var mockServer = new MockServer(options);
  mockServer.start();
}

function MockServer(options) {
  var self = this;
  this.options = options;
  this.ensureOptions();
}

MockServer.prototype.start = function() {
  this.startMock();
  this.startProxy();
  if (this.options.log_enabled) {
    console.log('Server running on http://localhost:' + this.options.port);
  }
}

MockServer.prototype.ensureOptions = function() {
  if (!this.options) {
    this.options = {};
  }
  if (this.options.log_enabled === undefined) {
    this.options.log_enabled = true;
  }
  this.options.port = this.options.port || 3000;
  this.options.path = this.options.path || process.cwd();
  this.options.config = this.options.config || this.options.path + '/config.json'

  // Use default config if none is provided
  if (!path.existsSync(this.options.config)) {
    this.options.config = __dirname + '/config.json';
  }
}


MockServer.prototype.readConfig = function() {
  return JSON.parse(fs.readFileSync(this.options.config, 'utf8'));
}

//////////////
// MOCK SERVER
//////////////
MockServer.prototype.startMock = function() {
  var app = express.createServer();
  app.use(express.static(this.options.path));
  app.set('mock', this);
  app.get('*', this.handleAnyRequest);
  app.post('*', this.handleAnyRequest);
  app.delete('*', this.handleAnyRequest);
  app.put('*', this.handleAnyRequest);
  app.listen(3001);
}

MockServer.prototype.startProxy = function(options) {
  var self = this;
  httpProxy.createServer(function (req, res, proxy) {
    var reqUrl = url.parse(req.url);
    if (self.options.log_enabled) {
      console.log('Request: ' + req.method + ' ' + reqUrl.pathname);
    }

    var simulatedLag = self.readConfig()['simulated-lag'] || 0;
    var buffer = httpProxy.buffer(req);
    if (self.options.log_enabled) {
      if (self.shouldProxy(req)) {
        console.log('==> Proxy');
      } else {
        console.log('==> ' + self.getFileForRequest(req));
      }
    }

    setTimeout(function () {
      if (self.shouldProxy(req)) {
        var parsedUrl = url.parse(self.readConfig().proxy.server);
        req.headers['host'] = parsedUrl.hostname;
        proxy.proxyRequest(req, res, {
          host: parsedUrl.hostname,
          port: 80,
          buffer: buffer
        });
      } else {
        proxy.proxyRequest(req, res, {
          host: 'localhost',
          port: 3001,
          buffer: buffer
        });
      }
    }, simulatedLag);
  }).listen(this.options.port);
}

MockServer.prototype.shouldProxy = function(req) {
  var config = this.readConfig();
  if (config.proxy) {
    var defaultProxy = config.proxy.default || false;
    if (config.proxy.calls && config.proxy.calls[url.parse(req.url).pathname]) {
      var entry = config.proxy.calls[url.parse(req.url).pathname];
      if (typeof(entry) == 'object') {
        return entry[req.method.toLowerCase()] || defaultProxy;
      } else if (typeof(entry) == 'boolean') {
        return entry;
      }
    } else {
      return defaultProxy;
    }
  } else {
    return false;
  }
}

MockServer.prototype.handleAnyRequest = function(req, res){
  var file = res.app.set('mock').getFileForRequest(req);
  if (!path.existsSync(file)) {
    return res.send(404);
  }
  var data = res.app.set('mock').readFileJson(file);
  res.send(data);
}

MockServer.prototype.getFileForRequest = function(req) {
  var reqUrl = url.parse(req.url);
  if (reqUrl.pathname.substr(-5) === '.json') {
    reqUrl.pathname = reqUrl.pathname.substr(0, reqUrl.pathname.length - 5);
  }
  return this.options.path + reqUrl.pathname + '_' + req.method.toLowerCase() + ".json";
}

MockServer.prototype.readFileJson = function(file) {
  var data = fs.readFileSync(file, 'utf8');

  data = data.replace(TEMPLATE_PATTERN, function(match) {
    // TODO: allow variables instead of templates like SERVER_BASE_URL
    // TODO: for templates, allow {{Template(1)}} to add variables that can be used in the template like: {{param[1]}}
    var templateFile = this.options.path + '_templates/' + match.slice(2,-2) + ".json";
    return JSON.stringify(this.readFileJson(templateFile));
  });

  return JSON.parse(data);
}