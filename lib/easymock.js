/*global require:true, exports:true, __dirname:true, process:true */
var express = require('express');
var fs = require('fs');
var url = require('url');
var path = require('path');
var httpProxy = require('http-proxy');
var _ = require('underscore');

var TEMPLATE_PATTERN = new RegExp(/\{\{([a-zA-Z0-9\-_]+)(\([""0-9a-zA-Z,]+\))?\}\}/g);
var VARIABLE_PATTERN = new RegExp(/#\{[a-zA-Z0-9\-_]+\}/g);
var PARAM_PATTERN    = new RegExp(/#\{_([1-9])\}/g);

exports.version = '0.0.1';

exports.MockServer = MockServer;

function MockServer(options) {
  this.options = options;
  this.ensureOptions();
}

MockServer.prototype.start = function() {
  this.startMock();
  this.startProxy();
  if (this.options.log_enabled) {
    console.log('Server running on http://localhost:' + this.options.port);
  }
};

MockServer.prototype.stop = function() {
  this.mock_server.close();
  this.proxy_server.close();
};

MockServer.prototype.ensureOptions = function() {
  if (!this.options) {
    this.options = {};
  }
  if (this.options.log_enabled === undefined) {
    this.options.log_enabled = true;
  }
  this.options.port = this.options.port || 3000;
  this.options.path = this.options.path || process.cwd();
  this.options.config = this.options.config || this.options.path + '/config.json';

  // Use default config if none is provided
  if (!path.existsSync(this.options.config)) {
    this.options.config = __dirname + '/config.json';
  }
}


MockServer.prototype.readConfig = function() {
  var now = new Date().getTime();
  if (!this.config_last_read || this.config_last_read < now - 2000) {
    this.config_last_read = now;
    var config = JSON.parse(fs.readFileSync(this.options.config, 'utf8'));
    if (config.routes) {
      var regexp = /:[a-zA-Z_]*/g;
      config.routes = _.map(config.routes, function(route) {
        var match;
        var params = [];
        while (match = regexp.exec(route)) {
          params.push(match[0].substr(1));
        }
        var route2 = {
          route: route.replace(regexp, '*'),
          matcher: new RegExp('^' + route.replace(regexp, '([0-9a-zA-Z]+)').replace(/\//g, '\\/') + '$'),
          path: route.replace(/:/g, ''),
          params: params
        };
        return route2;
      });
    }
    this.config = config;
  }
  return this.config;
};

//////////////
// MOCK SERVER
//////////////
MockServer.prototype.startMock = function() {
  var app = express.createServer();
  app.set('mock', this);
  app.get('*', this.handleAnyRequest);
  app.post('*', this.handleAnyRequest);
  app.delete('*', this.handleAnyRequest);
  app.put('*', this.handleAnyRequest);
  app.listen(3001);
  this.mock_server = app;
};

MockServer.prototype.startProxy = function(options) {
  var self = this;
  this.proxy_server = httpProxy.createServer(function (req, res, proxy) {
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
        console.log('==> ' + self.getRequestInfo(req).file);
      }
    }

    setTimeout(function () {
      if (self.shouldProxy(req)) {
        var parsedUrl = url.parse(self.readConfig().proxy.server);
        req.headers.host = parsedUrl.hostname;
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
};

MockServer.prototype.shouldProxy = function(req) {
  var config = this.readConfig();
  if (config.proxy) {
    var defaultProxy = config.proxy.default || false;
    if (config.proxy.calls && config.proxy.calls[url.parse(req.url).pathname] !== undefined) {
      var entry = config.proxy.calls[url.parse(req.url).pathname];
      if (typeof(entry) === 'object') {
        if (typeof(entry[req.method.toLowerCase()]) === 'boolean') {
          return entry[req.method.toLowerCase()];
        }
        return defaultProxy;
      } else if (typeof(entry) === 'boolean') {
        return entry;
      }
    } else {
      return defaultProxy;
    }
  } else {
    return false;
  }
};

MockServer.prototype.handleAnyRequest = function(req, res){
  var info = res.app.set('mock').getRequestInfo(req);
  if (!path.existsSync(info.file)) {
    var staticFile = res.app.set('mock').options.path + url.parse(req.url).pathname;
    if (path.existsSync(staticFile)) {
      return res.sendfile(staticFile);
    } else {
      return res.send(404);
    }
  }
  var data = res.app.set('mock').readFileJson(info.file, {params: info.params});
  res.send(data);
};

MockServer.prototype.getRequestInfo = function(req) {
  var info = {};
  var reqUrl = url.parse(req.url);
  if (reqUrl.pathname.substr(-5) === '.json') {
    reqUrl.pathname = reqUrl.pathname.substr(0, reqUrl.pathname.length - 5);
  }
  info.file = this.options.path + reqUrl.pathname;

  var config = this.readConfig();
  if (config && config.routes) {
    for (var i = 0; i < config.routes.length; i++) {
      var route = config.routes[i];
      var match = route.matcher.exec(req.url);
      if (match) {
        info.file = this.options.path + route.path;
        info.params = info.params || {};
        for (var j = 1; j < match.length; j++) {
          var paramName = route.params[j-1];
          info.params[paramName] = match[j];
        }
        break;
      }
    }
  }
  info.file = info.file + '_' + req.method.toLowerCase() + '.json';
  return info;
};

MockServer.prototype.readFileJson = function(file, options) {
  var data = fs.readFileSync(file, 'utf8');
  var self = this;

  var config = self.readConfig();
  data = data.replace(VARIABLE_PATTERN, function(match) {
    if (options && options.args) {
      var matcher = new RegExp(PARAM_PATTERN).exec(match);
      if (matcher !== null) {
        var index = parseInt(matcher[1], 10) - 1;
        if (index > options.args.length - 1) {
          return 'undefined';
        }
        return options.args[index];
      }
    }
    var varName = match.slice(2,-1);
    if (options.params && options.params[varName]) {
      return options.params[varName];
    }
    if (config.variables && config.variables[varName]) {
      return config.variables[varName];
    }
    return match;
  });

  data = data.replace(TEMPLATE_PATTERN, function(match) {
    var matcher = TEMPLATE_PATTERN.exec(match);
    var templateName = matcher[1];
    var arguments = matcher[2];
    if (arguments) {
      arguments = arguments.slice(1, -1).split(',');
    }
    var templateFile = self.options.path + '/_templates/' + templateName + '.json';
    return JSON.stringify(self.readFileJson(templateFile, {args: arguments, params: options.params} ));
  });

  return JSON.parse(data);
};