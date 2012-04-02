var express = require('express');
var fs = require('fs');
var url = require('url');
var app = express.createServer();

app.get('*', function(req, res){
  reqUrl = url.parse(req.url);
  fs.readFile('json' + reqUrl.pathname + '_' + req.method.toLowerCase() + ".json", function(err, data) {
    if (err) { return res.send('Error: ' + err); }
    res.send(data.toString().trim());
  });
});

app.listen(80);
