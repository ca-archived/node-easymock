TESTS = $(shell find test -name "*.test.coffee")

tests:
	NODE_ENV=testing ./node_modules/.bin/mocha --compilers coffee:coffee-script --reporter spec $(TESTS)
