/*global require:true, exports:true, __dirname:true, process:true */
var express = require('express');
var fs = require('fs');
var url = require('url');
var httpProxy = require('http-proxy');
var _ = require('underscore');
var marked = require('marked');
var AccessLog = require('./access_log').AccessLog;
require('broware');

var TEMPLATE_PATTERN = new RegExp(/"?\{\{([a-zA-Z0-9\-_]+)(\([^()]+\))?\}\}"?/g);
var VARIABLE_PATTERN = new RegExp(/#\{[a-zA-Z0-9\-_]+\}/g);
var PARAM_PATTERN    = new RegExp(/#\{_([1-9][0-9]*)\}/g);

exports.version = require('../package').version;

function MockServer(options) {
  this.options = options;
  this.ensureOptions();
  if (this.options.log_enabled) {
    this.log = new AccessLog();
  }
}

MockServer.prototype.start = function() {
  this.startMock();
  this.startProxy();
  if (this.options.log_enabled) {
    var serverUrl = 'http://localhost:' + this.options.port;
    console.log('Server running on ' + serverUrl);
    console.log('Listening on port ' + this.options.port + ' and ' + (this.options.port + 1));
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
          matcher: new RegExp('^' + route.replace(regexp, '([^/\?]+)').replace(/([\/\?\*\-])/g, '\\$1') + '$'),
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
    // If multipart form, ignore rawbody.
    // TODO instead just add the parameters and ignore the files
    var contentType = req.headers['content-type'] || "";
    if (contentType.indexOf('multipart/form-data') < 0) {
      req.rawBody = '';
      req.setEncoding('utf8');
      req.on('data', function(chunk) { req.rawBody += chunk; });
    }
    next();
  });
  app.use(express.bodyParser());

  app.locals.moment = require('moment');

  app.use('/_documentation', express.static(__dirname + '/static'));
  app.use('/_logs', express.static(__dirname + '/static'));
  app.get('/_documentation/', this.getApiDocumentation);
  app.get('/_logs/', this.getLogs);
  app.get('/_documentation.json', this.getApiDocumentationJson);
  app.get('/_documentation', this.getApiDocumentationJson);

  app.get('*', this.handleAnyRequest);
  app.post('*', this.handleAnyRequest);
  app.delete('*', this.handleAnyRequest);
  app.put('*', this.handleAnyRequest);

  this.mock_server = app.listen(this.options.port + 1);
};

function findMatchingLag(lagconfig, path) {
  if (_.isEmpty(lagconfig.paths)) {
    return lagconfig.default || 0;
  }

  for (var i = 0; i < lagconfig.paths.length; i++) {
    // Convert the match string to a RegExp object.
    var pathobj = lagconfig.paths[i];

    if (new RegExp(pathobj.match).test(path)) {
      return pathobj.lag || 0;
    }
  }

  return lagconfig.default;
}

MockServer.prototype.generateLag = function(requestPath) {
  var config = this.readConfig();
  var lag = config['simulated-lag'];
  if (typeof(lag) === 'number') {
    // Fixed lag.
    return lag;
  } else if (typeof(lag) === 'object') {
    return findMatchingLag(lag, requestPath);
  }

  var lagMax = config['simulated-lag-max'];
  var lagMin = config['simulated-lag-min'];

  if(lagMax || lagMin) {
    lagMax = lagMax || 40000;
    lagMin = lagMin || 0;
    var lagRandom = Math.round(Math.random() *(lagMax -lagMin) +lagMin);
    return lagRandom;
  }

  return 0;
}

MockServer.prototype.startProxy = function() {
  var self = this;
  this.proxy_server = httpProxy.createServer(function (req, res, proxy) {
    var reqUrl = url.parse(req.url);
    if (self.options.log_enabled) {
      console.log('Request: ' + req.method + ' ' + reqUrl.pathname);
    }

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
        var port = 80;
        if (parsedUrl.port) {
          port = parsedUrl.port;
        } else if (self.readConfig().proxy.port) {
          port = self.readConfig().proxy.port;
        }
        req.headers.host = parsedUrl.hostname;
        proxy.proxyRequest(req, res, {
          host: parsedUrl.hostname,
          port: port,
          buffer: buffer
        });
      } else {
        proxy.proxyRequest(req, res, {
          host: 'localhost',
          port: self.options.port + 1,
          buffer: buffer
        });
      }
    }, self.generateLag(reqUrl.pathname));
  }).listen(this.options.port);
};

/**
 * @param on {string} current url
 * @param route {Object} route regexp to match the url against
 * @return {?Object}
 *
 * @description
 * Check if the route matches the current url.
 *
 * Inspired by match in
 * visionmedia/express/lib/router/router.js.
 * angular-router.js.
 */
function pathRegExp(path, opts) {
  var insensitive = opts.caseInsensitiveMatch,
      ret = {
        originalPath: path,
        regexp: path
      },
      keys = ret.keys = [];

  path = path
      .replace(/([().])/g, '\\$1')
      .replace(/(\/)?:(\w+)([\?\*])?/g, function(_, slash, key, option) {
        var optional = option === '?' ? option : null;
        var star = option === '*' ? option : null;
        keys.push({ name: key, optional: !!optional });
        slash = slash || '';
        return ''
            + (optional ? '' : slash)
            + '(?:'
            + (optional ? slash : '')
            + (star && '(.+?)' || '([^/]+)')
            + (optional || '')
            + ')'
            + (optional || '');
      })
      .replace(/([\/$\*])/g, '\\$1');

  ret.regexp = new RegExp('^' + path + '$', insensitive ? 'i' : '');
  return ret;
}

function switchRouteMatcher(on, route) {
  var keys = route.keys,
      params = {};

  if (!route.regexp) return null;

  var m = route.regexp.exec(on);
  if (!m) return null;

  for (var i = 1, len = m.length; i < len; ++i) {
    var key = keys[i - 1];

    var val = m[i];

    if (key && val) {
      params[key.name] = val;
    }
  }
  return params;
}

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
  // always remove .json
  if (path.substr(-5) === '.json') {
    path = path.substr(0, path.length - 5);
  }

  var config = this.readConfig();
  if (config.proxy) {
    var defaultProxy = config.proxy['default'] || false;
    if (config.proxy.calls) {
      var entry, router;
      for (var prop in config.proxy.calls) {
        entry = config.proxy.calls[prop];
        router = pathRegExp(prop, { caseInsensitiveMatch : false} );
        if (switchRouteMatcher(path, router)) {
          if (_.isObject(entry)) {
            return _.isBoolean(entry[method]) ? entry[method] : defaultProxy;
          }
          if (_.isBoolean(entry)) {
            return entry;
          }
        }
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
  info.params = _.extend(info.params||{}, req.query);
  info.params = _.extend(info.params||{}, req.body);
  info.params = _.extend(info.params||{}, mock.headersToParams(req.headers));
  if (!fs.existsSync(info.file)) {
    var staticFile = mock.options.path + url.parse(req.url).pathname;
    if (fs.existsSync(staticFile)) {
      if (mock.options.log_enabled) {
        mock.log.insert(req, 200, 'File contents');
      }
      return res.sendfile(staticFile);
    } else {
      if (mock.options.log_enabled) {
        mock.log.insert(req, 404, '');
      }
      return res.send(404);
    }
  }
  var data = mock.readFile(info.file, {params: info.params});
  var body = '';


  var config = mock.readConfig();
  var error = undefined;
  if (data.response.errors.length !== 0) {
    var selectedErrors = [];
    var selectRate = Math.random();
    for (var i=0; i<data.response.errors.length; i++) {
      var e = data.response.errors[i];
      if (e.rate > selectRate) {
        selectedErrors.push(e);
      }
    }
    if (selectedErrors.length !== 0) {
      error = selectedErrors[Math.floor(Math.random() * selectedErrors.length)];
    }
  }


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
  if (mock.options.log_enabled) {
    mock.log.insert(req, statusCode, body);
  }
  res.send(statusCode, body);
};

MockServer.prototype.headersToParams = function(headers) {
  var params = {};
  for (var key in headers) {
    if (headers.hasOwnProperty(key)) {
      params['HEADER_'+key.replace(/\-/g, '_').toUpperCase()] = headers[key];
    }
  }
  return params;
};

// getRequestInfo(req)
// getRequestInfo(method, path, args)
MockServer.prototype.getRequestInfo = function(arg1, arg2, args) {
  var method, pathname;
  if (typeof(arg1) === 'object') {
    var reqUrl = url.parse(arg1.url);
    pathname = reqUrl.pathname;
    if (pathname.substr(-5) === '.json') {
      pathname = pathname.substr(0, pathname.length - 5);
    }
    method = arg1.method.toLowerCase();
    args = {host:arg1.headers.host, query_string:reqUrl.query};
  } else {
    method = arg1.toLowerCase();
    pathname = arg2;
  }

  var info = {
    file: this.options.path + pathname,
    params: {}
  };

  if (args && args.host) {
    info.params.HOST = args.host;
  }
  if (args && args.query_string) {
    info.params.QUERY_STRING = args.query_string;
  }

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

  var updatedVariables;
  do {
    updatedVariables = false;
    data = data.replace(VARIABLE_PATTERN, function(match) {
      updatedVariables = true;
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
      // replace varName
      if (options.params && options.params[varName]) {
        return options.params[varName];
      }
      if (config.variables && config.variables[varName]) {
        return config.variables[varName];
      }
      return varName; // if variable not found, replace #{variable} with "variable"
    });
  } while (updatedVariables);

  data = data.replace(TEMPLATE_PATTERN, function(match) {
    var matcher = TEMPLATE_PATTERN.exec(match);
    var templateName = matcher[1];
    var args = matcher[2];
    if (args) {
      args = args.slice(1, -1).split(',');
    }
    var templateFile = self.options.path + '/_templates/' + templateName + '.json';
    options = _.clone(options);
    options.args = args;
    return self.readFile(templateFile, options).response.body;
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
          status = parseInt(item.substr(10));
          break;
        case '@header':
          var pos = item.indexOf(':');
          var name = item.substr(10, pos-10);
          var value = item.substr(pos + 2);
          headers[name] = value;
          break;
        case '@error ':
          var items = item.split(' ');
          var rate = items.length > 3 ? parseFloat(items[3]) : self.readConfig()['error-rate'];
          errors.push({file: '_errors/' + items[2] + '.json', rate: rate});
          break;
      }
    }
    return '';
  });


  if (!options.ignoreErrors) {
    // add general errors
    var generalErrors = self.readConfig()['errors'];
    if (generalErrors && generalErrors.length > 0) {
      var generalRate = self.readConfig()['error-rate'];
      _.each(generalErrors, function(item) {
        var error;
        if (typeof(item) === 'object') {
          error = { file: "_errors/" + item.name + ".json", rate: item.rate ? item.rate : generalRate };
        } else {
          error = { file: "_errors/" + item + ".json", rate: generalRate };
        }
        errors.push(error);
      });
    }


    options.ignoreErrors = true;
    errors = _.map(errors, function(error) {
      var newError = self.readFile(self.options.path + error.file, options);
      newError.name = error.file.substr(error.file.lastIndexOf('/') + 1).replace('.json', '');
      newError.rate = error.rate;
      delete newError.file;
      delete newError.input;
      delete newError.response.errors;
      return newError;
    });
    options.ignoreErrors = false;
  }



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

MockServer.prototype.getApiDocumentationJson = function(req, res) {
  res.app.set('mock').getApiDocumentationJsonInternal({host:req.headers.host}, function(err, apiDocumentation) {
      if (err) { return res.send(400, err); }
      res.send(apiDocumentation);
    });
}

// TODO refactor this (maybe own class for documentation generation based on a MockServer)
MockServer.prototype.getApiDocumentationJsonInternal = function(args, callback) {
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
      var requestInfo = that.getRequestInfo(method, path, args);
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
        try {
          response = JSON.stringify(JSON.parse(callInfo.response.body), null, 2);
        } catch(e) {
          response = "ERROR: " + e;
        }
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
    mock.getApiDocumentationJsonInternal({host:req.headers.host}, function(err, apiDocumentation) {
      if (err) { return res.send(400, err); }
      api = _.map(apiDocumentation, function(item) {
        item.classes = item.method.toLowerCase();
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
  var mock = res.app.set('mock');
  if (!mock.options.log_enabled) {
    return res.send(400, "log_disabled");
  }
  mock.log.getLogs(function(err, logs) {
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
