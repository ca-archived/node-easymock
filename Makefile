TESTS = $(shell find test -name "*.test.coffee")
REPORTER = dot

tests:
	@NODE_ENV=testing ./node_modules/.bin/mocha --compilers coffee:coffee-script --reporter $(REPORTER) $(TESTS)

test-cov: lib-cov
	@EASYMOCK_COV=1 $(MAKE) tests REPORTER=html-cov > coverage.html

lib-cov:
	@jscoverage lib lib-cov

clean:
	rm -R lib-cov
	rm coverage.html
