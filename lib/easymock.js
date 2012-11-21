/*global require:true, exports:true, __dirname:true, process:true */
var express = require('express');
var fs = require('fs');
var url = require('url');
var fs = require('fs');
var httpProxy = require('http-proxy');
var jade = require('jade');
var _ = require('underscore');

var TEMPLATE_PATTERN = new RegExp(/"?\{\{([a-zA-Z0-9\-_]+)(\([""0-9a-zA-Z,]+\))?\}\}"?/g);
var VARIABLE_PATTERN = new RegExp(/#\{[a-zA-Z0-9\-_]+\}/g);
var PARAM_PATTERN    = new RegExp(/#\{_([1-9])\}/g);

exports.version = '0.0.1';

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
  if (!fs.existsSync(this.options.config)) {
    this.options.config = __dirname + '/config.json';
  }
};


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
    var defaultProxy = config.proxy['default'] || false;
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
  if (!fs.existsSync(info.file)) {
    var staticFile = res.app.set('mock').options.path + url.parse(req.url).pathname;
    if (fs.existsSync(staticFile)) {
      return res.sendfile(staticFile);
    } else {
      return res.send(404);
    }
  }
  var data = res.app.set('mock').readFileJson(info.file, {params: info.params});
  res.send(data);
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
  var data = this.readFile(file, options).response;
  return JSON.parse(data);
};

MockServer.prototype.readFile = function(file, options) {
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
    return self.readFile(templateFile, {args: args, params: options.params} ).response;
  });
  var input = [];
  var output = [];
  var description = [];
  data = data.replace(/^(<|>|#) .*$/gm, function(item) {
    if (item.indexOf('#') === 0) {
      description.push(item.substr(2));
    } else if (item.indexOf('>') === 0) {
      input.push(item.substr(2));
    } else {
      output.push(item.substr(2));
    }
    return '';
  });
  return {
    description: description.join('\n'),
    input: input,
    output: output,
    response: data
  };
};

// TODO refactor this (maybe own class for documentation generation based on a MockServer)
MockServer.prototype.getApiDocumentation = function(callback) {
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
      return {
        method: method,
        path: path,
        description: callInfo.description,
        input: callInfo.input,
        output: callInfo.output,
        response: JSON.stringify(JSON.parse(callInfo.response), null, 2)
      };
    });
    results = _.sortBy(results, function(item) { return item.path; } );

    callback(null, results);
  });
};

MockServer.prototype.generateApiDocumentation = function(callback) {
  var that = this;
  function getDocumentation() {
    that.getApiDocumentation(function(err, apiDocumentation) {
      if (err) { return callback(err); }
      apiDocumentation = _.map(apiDocumentation, function(item) {
        item.classes = item.method.toLowerCase();
        return item;
      });
      getDocumentationHtml(apiDocumentation);
    });
  }
  function getDocumentationHtml(documentation) {
    var pathJade = __dirname + '/res/documentation.jade';
    fs.readFile(pathJade, function(err, result) {
      if (err) { return callback(err); }

      var fn = jade.compile(result.toString(), {});
      var html = fn({ calls: documentation });
      writeDocumentationHtml(html);
    });
  }
  function writeDocumentationHtml(html) {
    function copyResFile(name) {
      var pathIn = __dirname + '/res/' + name;
      var pathOut =  folder + '/' + name;
      fs.createReadStream(pathIn).pipe(fs.createWriteStream(pathOut));
    }
    var folder = that.options.path + '/_documentation';
    var pathHtmlOut = folder + '/index.html';
    fs.mkdir(folder, function() {
      fs.writeFile(pathHtmlOut, html, function (err) {
        if (err) { return callback(err); }
        copyResFile('documentation.css');
        copyResFile('documentation.js');
        copyResFile('zepto.min.js');
        callback(null);
      });
    });
  }
  getDocumentation();
};

exports.MockServer = MockServer;