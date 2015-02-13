/* global describe, it, Promise:true */

"use strict";

var assert = require("assert"),
    Promise = require("bluebird"),
    srsly = require("./");


describe("Handling successful results",function() {
  it("should resolve returned promises",function() {
    var retry = srsly({ style: Promise });

    return retry(function(arg) {
      return Promise.resolve(arg.toUpperCase());
    },"success!").then(function(result) {
      assert.equal(result,"SUCCESS!");
    });
  });

  it("should call callbacks with null error and the result",function(done) {
    var retry = srsly({ style: "node" });

    retry(function(arg, callback) {
      callback(null,arg.toUpperCase());
    },"success!",function(err, result) {
      try {
        assert.strictEqual(err,null);
        assert.equal(result,"SUCCESS!");
        done();
      } catch (e) {
        done(e);
      }
    });
  });
});


describe("Adapting node functions to return promises",function() {
  it("should resolve returned promises using callback results",function() {
    var retry = srsly({ output: Promise });

    return retry(function(arg, callback) {
      callback(null,arg.toUpperCase());
    },"success!").then(function(result) {
      assert.equal(result,"SUCCESS!");
    });
  });

  it("should reject returned promises using callback errors",function() {
    var retry = srsly({ output: Promise, tries: 1 });

    return retry(function(arg, callback) {
      callback("failure :(");
    },"success!").then(function() {
      assert.fail();
    },function(err) {
      assert.equal(err,"failure :(");
    });
  });
});


describe("Adapting promise functions to accept node callbacks",function() {
  it("should pass results to callbacks",function(done) {
    var retry = srsly({ input: "promise", tries: 1 });

    retry(function(arg) {
      return Promise.resolve(arg.toUpperCase());
    },"success!",function(err, result) {
      try {
        assert.strictEqual(err,null);
        assert.equal(result,"SUCCESS!");
        done();
      } catch (e) {
        done(e);
      }
    });
  });

  it("should pass rejections to callbacks as errors",function(done) {
    var retry = srsly({ input: "promise", tries: 1 });

    retry(function(arg) {
      return Promise.reject("failure :(");
    },"success!",function(err) {
      try {
        assert.equal(err,"failure :(");
        done();
      } catch (e) {
        done(e);
      }
    });
  });
});


describe("Handling a failed operation",function() {
  it("should pass the number of failed tries to the strategy",function(done) {
    var retry = srsly({ strategy: check }),
        tried = 0;

    function check(tries, err, retry) {
      try {
        assert.equal(tries,++tried);
        if (tries < 5)
          retry();
        else
          done();
      } catch (e) {
        done(e);
      }
    }

    retry(failOnPurpose);
  });

  it("should pass the last error to the strategy",function(done) {
    var retry = srsly({ strategy: check });

    function check(tries, err) {
      try {
        assert(err instanceof Error);
        assert.equal(err.message,"This was an expected error.");
        done();
      } catch (e) {
        done(e);
      }
    }

    retry(failOnPurpose);
  });

  it("should take the path selected by the strategy",function(done) {
    var retry = srsly({ strategy: check }),
        start = Date.now();

    function check(tries, err, retry, fail) {
      if (tries === 1)
        setTimeout(retry,250);
      else
        fail(tries);
    }

    retry(failOnPurpose,function(lastTry) {
      try {
        var duration = Date.now() - start;
        assert(duration >= 200);
        assert.equal(lastTry,2);
        done();
      } catch (e) {
        done(e);
      }
    });
  });


  function failOnPurpose(callback) {
    callback(new Error("This was an expected error."));
  }
});


testDelayStrategy("specified",function() {
  assertDelays(srsly.specifiedDelays([1,9,2,8,3]),[1,9,2,8,3,3,3,3,3]);
});

testDelayStrategy("fibonacci",function() {
  var fib = srsly.fibonacciDelays;

  assertDelays(fib(0),[0,1,1,2,3,5,8,13]);

  assertDelays(fib(),[1,1,2,3,5,8,13]);
  assertDelays(fib(1),[1,1,2,3,5,8,13]);

  assertDelays(fib(2),[2,2,4,6,10,16,26]);
  assertDelays(fib(3),[3,3,6,9,15,24,39]);
  assertDelays(fib(7),[7,7,14,21,35,56]);
});

testDelayStrategy("exponential",function() {
  var exp = srsly.exponentialDelays;

  assertDelays(exp(),[1,2,4,8,16,32]);
  assertDelays(exp(1),[1,2,4,8,16,32]);

  assertDelays(exp(2),[2,4,8,16,32]);
  assertDelays(exp(3),[3,6,12,24,48]);
  assertDelays(exp(3,3),[3,9,27,81,243]);

  assertDelays(exp(0),[0,0,0,0,0]);
  assertDelays(exp(0,2),[0,0,0,0,0]);
  assertDelays(exp(0,5),[0,0,0,0,0]);

  assertDelays(exp(0,0),[0,0,0,0,0]);
  assertDelays(exp(1,0),[1,1,1,1,1]);
  assertDelays(exp(5,0),[5,5,5,5,5]);
});


function testDelayStrategy(name, test) {
  describe("The " + name + " delay strategy",function() {
    it("should yield the correct sequence of delays",test);
  });
}

function assertDelays(getDelay, expected) {
  var actual = [];

  for (var i = 1, len = expected.length; i <= len; i++)
    actual.push(getDelay(i));

  assert.deepEqual(expected,actual);
}
