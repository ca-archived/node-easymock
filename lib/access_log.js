/*global require:true, exports:true */
var sqlite3 = require('sqlite3');
var _ = require('underscore');

function AccessLog() {
  this.db = new sqlite3.Database('access_logs.db');
  this.ensureCreation();
}

var extractRequestHeaders = function(req) {
  var result = req.method + ' ' + req.url + ' HTTP/' + req.httpVersion + '\n';
  result += _.map(_.pairs(req.headers), function(pair) {
    return pair[0] + ': ' + pair[1];
  }).join('\n');
  return result;
};

var extractResponseHeaders = function(res) {
  return _.map(_.pairs(res._headers), function(pair) {
    return res._headerNames[pair[0]] + ': ' + pair[1];
  }).join('\n');
};

AccessLog.prototype.insertDb = function(req, resStatus, resHeaders, resBody) {
  if (req.url === '/favicon.ico') { return; }
  var requestHeaders = extractRequestHeaders(req);
  var requestBody = req.rawBody;

  if (typeof(resBody) === 'object') {
    resBody = JSON.stringify(resBody);
  }

  this.db.run('INSERT INTO logs ' +
    '(client, request_method, request_path, request_headers, request_body, response_status, response_headers, response_body) ' +
    'VALUES (?,?,?,?,?,?,?,?)', [ req.connection.remoteAddress, req.method.toUpperCase(), req.url, requestHeaders, requestBody, resStatus, resHeaders, resBody ]);
};

AccessLog.prototype.ensureCreation = function() {
  this.db.run('CREATE TABLE IF NOT EXISTS logs (' +
    '_id INTEGER PRIMARY KEY AUTOINCREMENT,' +
    'time DATETIME DEFAULT CURRENT_TIMESTAMP,' +
    'client TEXT,' +
    'request_method TEXT,' +
    'request_path TEXT,' +
    'request_headers TEXT,' +
    'request_body TEXT,' +
    'response_status INTEGER,' +
    'response_headers TEXT,' +
    'response_body TEXT' +
    ')');
};

AccessLog.prototype.insert = function(req, status, body) {
  var responseHeaders = extractResponseHeaders(req.res);
  this.insertDb(req, status, responseHeaders, body);
};

AccessLog.prototype.insertProxy = function(req) {
  this.insertDb(req, 0, 'PROXY', 'PROXY');
};

AccessLog.prototype.getLogs = function(callback) {
  this.db.all('SELECT *, strftime("%s", "time") AS timestamp FROM logs ORDER BY _id DESC LIMIT 100', function(err, rows) {
    rows = _.map(rows, function(row) {
      row.isProxied = function() {
        return this.response_status === 0;
      };
      return row;
    });
    callback(err, rows);
  });
};

AccessLog.prototype.clear = function(callback) {
  this.db.run('DELETE FROM logs;', callback);
};

exports.AccessLog = AccessLog;