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
    var retry = srsly({ output: Promise, strategy: srsly.maxTries(1) });

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
    var retry = srsly({ input: "promise", strategy: srsly.maxTries(1) });

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
    var retry = srsly({ input: "promise", strategy: srsly.maxTries(1) });

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
