module.exports = process.env.EASYMOCK_COV
  ? require('./lib-cov/easymock')
  : require('./lib/easymock');