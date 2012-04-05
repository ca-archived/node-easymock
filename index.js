var express = require('express');
var fs = require('fs');
var url = require('url');
var app = express.createServer();

app.use(express.static(__dirname + '/public'));
app.get('*', handleAnyRequest);
app.post('*', handleAnyRequest);
app.delete('*', handleAnyRequest);
app.put('*', handleAnyRequest);


var TEMPLATE_PATTERN = new RegExp(/{{.*}}/g);

function handleAnyRequest(req, res){
  reqUrl = url.parse(req.url);
  var file = 'json' + reqUrl.pathname + '_' + req.method.toLowerCase() + ".json";
  console.log('Request: ' + file);

  var data = readFileJson(file);
  res.send(data)
}

function readFileJson(file) {
  var data = fs.readFileSync(file, 'utf8');

  data = data.replace(TEMPLATE_PATTERN, function(match) {
    var templateFile = 'json/_templates/' + match.slice(2,-2) + ".json";
    return JSON.stringify(readFileJson(templateFile));
  } );

  return JSON.parse(data);
}

app.listen(80);