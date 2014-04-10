/*global require:true, exports:true, __dirname:true, process:true */
var express = require('express');
var fs = require('fs');
var url = require('url');
var fs = require('fs');
var httpProxy = require('http-proxy');
var _ = require('underscore');
var marked = require('marked');
var AccessLog = require('./access_log').AccessLog;
require('broware');

var TEMPLATE_PATTERN = new RegExp(/"?\{\{([a-zA-Z0-9\-_]+)(\([""0-9a-zA-Z, ]+\))?\}\}"?/g);
var VARIABLE_PATTERN = new RegExp(/#\{[a-zA-Z0-9\-_]+\}/g);
var PARAM_PATTERN    = new RegExp(/#\{_([1-9])\}/g);

exports.version = require('../package').version;

function MockServer(options) {
  this.options = options;
  this.ensureOptions();
  this.log = new AccessLog();
}

MockServer.prototype.start = function() {
  this.startMock();
  this.startProxy();
  if (this.options.log_enabled) {
    var serverUrl = 'http://localhost:' + this.options.port;
    console.log('Server running on ' + serverUrl);
    console.log('Documentation at: ' + serverUrl + '/_documentation/');
    console.log('Logs at:          ' + serverUrl + '/_logs/');
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
  if (!this.options.path.indexOf('/', this.options.path.length - 1) !== -1) {
    this.options.path += '/';
  }
  this.options.config = this.options.config || this.options.path + '/config.json';

  // Use default config if none is provided
  if (_.isString(this.options.config) && !fs.existsSync(this.options.config)) {
    this.options.config = __dirname + '/config.json';
  }
};


MockServer.prototype.readConfig = function() {
  var now = new Date().getTime();
  if (!this.config_last_read || this.config_last_read < now - 2000) {
    this.config_last_read = now;
    var config;
    if (_.isString(this.options.config)) {
      config = JSON.parse(fs.readFileSync(this.options.config, 'utf8'));
    } else {
      config = _.clone(this.options.config);
    }

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
          matcher: new RegExp('^' + route.replace(regexp, '([^/?]+)').replace(/\//g, '\\/') + '$'),
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
  var app = express();
  app.set('mock', this);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  if (this.readConfig().cors) {
    app.use(this.allowCrossDomain);
  }

  app.use(function(req, res, next) {
    // TODO if multipart form, probably ignore rawbody!!
    // or just add the parameters and ignore the files
    req.rawBody = '';
    req.setEncoding('utf8');
    req.on('data', function(chunk) { req.rawBody += chunk; });
    next();
  });
  app.use(express.bodyParser());

  app.locals.moment = require('moment');

  app.use('/_documentation', express.static(__dirname + '/static'));
  app.use('/_logs', express.static(__dirname + '/static'));
  app.get('/_documentation/', this.getApiDocumentation);
  app.get('/_logs/', this.getLogs);

  app.get('*', this.handleAnyRequest);
  app.post('*', this.handleAnyRequest);
  app.delete('*', this.handleAnyRequest);
  app.put('*', this.handleAnyRequest);

  this.mock_server = app.listen(this.options.port + 1);
};

MockServer.prototype.startProxy = function() {
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
        self.log.insertProxy(req);
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
          port: self.options.port + 1,
          buffer: buffer
        });
      }
    }, simulatedLag);
  }).listen(this.options.port);
};

/**
 * Call either with shouldProxy(req) or shouldProxy(path, method).
 */
MockServer.prototype.shouldProxy = function(path, method) {
  if (typeof(path) === 'object' && !method) {
    // path == req
    method = path.method;
    path = url.parse(path.url).pathname;
  }
  method = method.toLowerCase();

  var config = this.readConfig();
  if (config.proxy) {
    var defaultProxy = config.proxy['default'] || false;
    if (config.proxy.calls && config.proxy.calls[path] !== undefined) {
      var entry = config.proxy.calls[path];
      if (typeof(entry) === 'object') {
        if (typeof(entry[method]) === 'boolean') {
          return entry[method];
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

MockServer.prototype.allowCrossDomain = function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // intercept OPTIONS method
  if ('OPTIONS' === req.method) {
    res.send(200);
  }
  else {
    next();
  }
};

MockServer.prototype.handleAnyRequest = function(req, res){
  var mock = res.app.set('mock');
  var info = mock.getRequestInfo(req);
  info.params = _.extend(info.params||{}, req.body);
  if (!fs.existsSync(info.file)) {
    var staticFile = mock.options.path + url.parse(req.url).pathname;
    if (fs.existsSync(staticFile)) {
      mock.log.insert(req, 200, 'File contents');
      return res.sendfile(staticFile);
    } else {
      mock.log.insert(req, 404, '');
      return res.send(404);
    }
  }
  var data = mock.readFile(info.file, {params: info.params});
  var body = '';


  var config = mock.readConfig();
  var error = config['error-rate'] && config['error-rate'] > 0 && config['error-rate'] > Math.random() ?
              mock.readFile(mock.options.path + data.response.errors[Math.floor(Math.random() * data.response.errors.length)].file) : undefined;

  if (data.response.isBodyJson()) {
    body = error ? JSON.parse(error.response.body) : JSON.parse(data.response.body);
    if (config.jsonp && (req.param('callback') || req.param('jsonp'))) {
      var functionName = req.param('callback') || req.param('jsonp');
      res.setHeader('Content-Type', 'application/javascript');
      body = functionName + '(' + JSON.stringify(body) + ');';
    }
  }
  var statusCode = error ? error.response.status : data.response.status;
  res.set(data.response.headers);
  mock.log.insert(req, statusCode, body);
  res.send(statusCode, body);
};

// getRequestInfo(req)
// getRequestInfo(method, path)
MockServer.prototype.getRequestInfo = function(arg1, arg2) {
  var method, pathname;
  if (typeof(arg1) === 'object') {
    var reqUrl = url.parse(arg1.url);
    pathname = reqUrl.pathname;
    if (pathname.substr(-5) === '.json') {
      pathname = pathname.substr(0, pathname.length - 5);
    }
    method = arg1.method.toLowerCase();
  } else {
    method = arg1.toLowerCase();
    pathname = arg2;
  }

  var info = {};
  info.file = this.options.path + pathname;
  var config = this.readConfig();
  if (config && config.routes) {
    for (var i = 0; i < config.routes.length; i++) {
      var route = config.routes[i];
      var match = route.matcher.exec(pathname);
      if (match) {
        info.file = this.options.path + route.path;
        info.params = info.params || {};
        info.route = route;
        for (var j = 1; j < match.length; j++) {
          var paramName = route.params[j-1];
          info.params[paramName] = match[j];
        }
        break;
      }
    }
  }
  info.file = info.file + '_' + method + '.json';
  return info;
};

MockServer.prototype.readFileJson = function(file, options) {
  if (!options) { options = {} };
  if (!options.params) { options.params = {} };

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
    var args = matcher[2];
    if (args) {
      args = args.slice(1, -1).split(',');
    }
    var templateFile = self.options.path + '/_templates/' + templateName + '.json';
    return self.readFile(templateFile, {args: args, params: options.params} ).response.body;
  });

  return data;
}

MockServer.prototype.readFile = function(file, options) {
  var self = this;
  var data = self.readFileJson(file, options);

  var input = [];
  var output = [];
  var description = [];
  var status = 200;
  var headers = {};
  var errors = [];
  data = data.replace(/^(<|>|#) .*$/gm, function(item) {
    if (item.indexOf('#') === 0) {
      description.push(item.substr(2));
    } else if (item.indexOf('>') === 0) {
      input.push(item.substr(2));
    } else {
      output.push(item.substr(2));
      switch(item.substr(2,7)) {
        case '@status':
          status = item.substr(10);
          break;
        case '@header':
          var pos = item.indexOf(':');
          var name = item.substr(10, pos-10);
          var value = item.substr(pos + 2);
          headers[name] = value;
          break;
        case '@error ':
          var items = item.split(' ');
          errors.push({file: '_documentation/error_' + items[2] + '.json'});
          break;
      }
    }
    return '';
  });
  data = data.trim();
  return {
    file: file,
    description: description.join('<br />\n'),
    input: input,
    output: output,
    response: {
      status: status,
      headers: headers,
      errors: errors,
      body: data,
      isBodyJson: function() { return data && data.length > 0 && (data[0] === '{' || data[0] === '['); }
    }
  };
};

// TODO refactor this (maybe own class for documentation generation based on a MockServer)
MockServer.prototype.getApiDocumentationJson = function(callback) {
  var that = this;

  var walk = function(dir, done) {
    var results = [];
    fs.readdir(dir, function(err, list) {
      if (err) { return done(err); }
      var i = 0;
      (function next() {
        var file = list[i++];
        if (!file) { return done(null, results); }
        file = dir + '/' + file;
        fs.stat(file, function(err, stat) {
          if (stat && stat.isDirectory()) {
            walk(file, function(err, res) {
              results = results.concat(res);
              next();
            });
          } else {
            results.push(file);
            next();
          }
        });
      })();
    });
  };

  var getCallMethod = function(file) {
    if (~file.indexOf('_get.json')) {
        return 'GET';
      }
      if (~file.indexOf('_post.json')) {
        return 'POST';
      }
      if (~file.indexOf('_put.json')) {
        return 'PUT';
      }
      if (~file.indexOf('_delete.json')) {
        return 'DELETE';
      }
      return undefined;
  };

  var folder = this.options.path;
  walk(folder, function(err, results) {
    results = _.filter(results, function(file) {
      if (!/\.json$/.test(file)) {
        return false;
      }
      if (getCallMethod(file)) {
        return true;
      }
      return false;
    });
    results = _.map(results, function(file) {
      var method = getCallMethod(file);
      var path = file.substr(folder.length, file.lastIndexOf('_') - folder.length);
      var requestInfo = that.getRequestInfo(method, path);
      if (requestInfo && requestInfo.route) {
        path = requestInfo.route.route;
        for (var i = 0; i < requestInfo.route.params.length; i++) {
          var key = requestInfo.route.params[i];
          path = path.replace('*', ':' + requestInfo.route.params[i]);
          requestInfo.params[key] = 1;
        }
      }
      var callInfo = that.readFile(requestInfo.file, {params: requestInfo.params});

      var response = '';
      if (callInfo.response.isBodyJson()) {
        response = JSON.stringify(JSON.parse(callInfo.response.body), null, 2);
      }

      return {
        method: method,
        path: path,
        description: callInfo.description,
        input: callInfo.input,
        output: callInfo.output,
        errors: callInfo.response.errors,
        response: response,
        proxy: that.shouldProxy(path, method)
      };
    });
    var getWeightForMethod = function(method) {
      var m = method.toLowerCase();
      if (m === 'get') {
        return 0;
      } else if (m === 'post') {
        return 1;
      } else if (m === 'put') {
        return 2;
      } else if (m === 'delete') {
        return 3;
      } else {
        return 999;
      }
    };
    results = _.sortBy(results, function(item) { return item.path + '/' + getWeightForMethod(item.method); } );

    callback(null, results);
  });
};

MockServer.prototype.getApiDocumentation = function(req, res) {
  var api, general;
  function getDocumentation() {
    var mock = res.app.set('mock');
    mock.getApiDocumentationJson(function(err, apiDocumentation) {
      if (err) { return res.send(400, err); }
      api = _.map(apiDocumentation, function(item) {
        item.classes = item.method.toLowerCase();
        if (item.errors.length > 0) {
          for (var i=0; i<item.errors.length; i++) {
            item.errors[i] = mock.readFile(mock.options.path + item.errors[i].file, mock.options);
          }
        }
        return item;
      });
      getGeneralDocumentation();
    });
  }
  function getGeneralDocumentation() {
    var file = res.app.set('mock').options.path + "/_documentation/index.md";
    if (fs.existsSync(file)) {
      general = fs.readFileSync(file, 'utf8');
    }

    getDocumentationHtml();
  }
  function getDocumentationHtml(documentation) {
    if (general) {
      general = marked(general);
    }
    res.render('documentation', {title: 'API Documentation', calls: api, general: general});
  }
  getDocumentation();
};

MockServer.prototype.getLogs = function(req, res) {
  res.app.set('mock').log.getLogs(function(err, logs) {
    if (err) { return res.send(400, err); }
    logs = _.map(logs, function(log) {
      if (log.response_body &&
        log.response_body.length > 0 &&
        (log.response_body.charAt(0) === '{' || log.response_body.charAt(0) === '[')) {
        log.response_body = JSON.stringify(JSON.parse(log.response_body), null, 2);
      }
      return log;
    });
    res.render('logs', {title: 'Access Logs', logs: logs});
  });
};

exports.MockServer = MockServer;
