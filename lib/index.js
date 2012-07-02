var express = require('express');
var fs = require('fs');
var url = require('url');
var http = require('http');
var path = require('path');
var httpProxy = require('http-proxy');

var configFile = 'config.json';
var TEMPLATE_PATTERN = new RegExp(/{{.*}}/g);

exports.version = '0.0.1';

exports.mock = function() {
  if (!path.existsSync(configFile)) {
    configFile = __dirname + '/config.json';
  }
  startMock();
  startProxy();
  console.log('Server running on http://localhost:3000');
}


function readConfig() {
  return JSON.parse(fs.readFileSync(configFile, 'utf8'));
}

//////////////
// MOCK SERVER
//////////////
function startMock() {
  var app = express.createServer();
  app.use(express.static(process.cwd()));
  app.get('*', handleAnyRequest);
  app.post('*', handleAnyRequest);
  app.delete('*', handleAnyRequest);
  app.put('*', handleAnyRequest);
  app.listen(3001);
}

function startProxy() {
  httpProxy.createServer(function (req, res, proxy) {
    var reqUrl = url.parse(req.url);
    console.log('Request: ' + req.method + ' ' + reqUrl.pathname);

    var simulatedLag = readConfig()['simulated-lag'] || 0;
    var buffer = httpProxy.buffer(req);
    if (shouldProxy(req)) {
      console.log('==> Proxy');
    } else {
      console.log('==> ' + getFileForRequest(req));
    }

    setTimeout(function () {
      if (shouldProxy(req)) {
        var parsedUrl = url.parse(readConfig().proxy.server);
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
  }).listen(3000);
}

function shouldProxy(req) {
  if (!path.existsSync(configFile)) {
    return false;
  }
  var config = readConfig();
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

function handleAnyRequest(req, res){
  var file = getFileForRequest(req);
  if (!path.existsSync(file)) {
    return res.send(404);
  }
  var data = readFileJson(file);
  res.send(data);
}

function getFileForRequest(req) {
  var reqUrl = url.parse(req.url);
  return process.cwd() + reqUrl.pathname + '_' + req.method.toLowerCase() + ".json";
}

function readFileJson(file) {
  var data = fs.readFileSync(file, 'utf8');

  data = data.replace(TEMPLATE_PATTERN, function(match) {
    // TODO: allow variables instead of templates like SERVER_BASE_URL
    // TODO: for templates, allow {{Template(1)}} to add variables that can be used in the template like: {{param[1]}}
    var templateFile = '_templates/' + match.slice(2,-2) + ".json";
    return JSON.stringify(readFileJson(templateFile));
  });

  return JSON.parse(data);
}