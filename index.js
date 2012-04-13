var express = require('express');
var fs = require('fs');
var url = require('url');
var http = require('http');
var path = require('path');
var httpProxy = require('http-proxy');

var configFile = 'config.json';

function readConfig() {
  return JSON.parse(fs.readFileSync(configFile, 'utf8'));
}

//////////////
// MOCK SERVER
//////////////
var app = express.createServer();

app.use(express.static(__dirname + '/public'));
app.get('*', handleAnyRequest);
app.post('*', handleAnyRequest);
app.delete('*', handleAnyRequest);
app.put('*', handleAnyRequest);
app.listen(3001);

var TEMPLATE_PATTERN = new RegExp(/{{.*}}/g);

function handleAnyRequest(req, res){
  var reqUrl = url.parse(req.url);

  var file = 'json' + reqUrl.pathname + '_' + req.method.toLowerCase() + ".json";

  console.log('==> ' + file);
  var data = readFileJson(file);
  res.send(data);
}

function readFileJson(file) {
  var data = fs.readFileSync(file, 'utf8');

  data = data.replace(TEMPLATE_PATTERN, function(match) {
    // TODO: allow variables instead of templates like SERVER_BASE_URL
    // TODO: for templates, allow {{Template(1)}} to add variables that can be used in the template like: {{param[1]}}
    var templateFile = 'json/_templates/' + match.slice(2,-2) + ".json";
    return JSON.stringify(readFileJson(templateFile));
  } );

  return JSON.parse(data);
}

///////////////
// PROXY SERVER
///////////////

httpProxy.createServer(function (req, res, proxy) {
var reqUrl = url.parse(req.url);
  var parsedUrl = url.parse(readConfig().server);
  console.log('Request: ' + req.method + ' ' + reqUrl.pathname);
  if (shouldProxy(req)) {
    console.log('==> Proxy');
    req.headers['host'] = parsedUrl.hostname;
    proxy.proxyRequest(req, res, {
      host: parsedUrl.hostname,
      port: 80
    });
  } else {
    proxy.proxyRequest(req, res, {
      host: 'localhost',
      port: 3001
    });
  }
}).listen(3000);

function shouldProxy(req) {
  if (!path.existsSync(configFile)) {
    return false;
  }
  var config = readConfig();
  if (config.calls && config.calls[url.parse(req.url).pathname]) {
    var entry = config.calls[url.parse(req.url).pathname];
    if (typeof(entry) == 'object') {
      return entry[req.method.toLowerCase()];
    } else if (typeof(entry) == 'boolean') {
      return entry;
    }
  }
  return false;
}

console.log('Server running on http://localhost:3000');