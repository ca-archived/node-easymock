var express = require('express');
var fs = require('fs');
var url = require('url');
var app = express.createServer();

app.use(express.static(__dirname + '/public'));
app.get('*', handleAnyRequest);
app.post('*', handleAnyRequest);
app.delete('*', handleAnyRequest);
app.put('*', handleAnyRequest);

function handleAnyRequest(req, res){
  reqUrl = url.parse(req.url);
  var file = 'json' + reqUrl.pathname + '_' + req.method.toLowerCase() + ".json";
  console.log('Request: ' + file);
  fs.readFile(file, function(err, data) {
    if (err) { return res.send('Error: ' + err); }
    res.send(data.toString().trim());
  });
}

app.listen(80);
