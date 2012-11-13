module.exports = process.env.MOCKIT_COV
  ? require('./lib-cov/mockit')
  : require('./lib/mockit');