#!/usr/bin/env node

var MockServer = require('../lib/index').MockServer;
var mock = new MockServer();
mock.start();