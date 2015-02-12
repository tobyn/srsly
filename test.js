/* global describe, it, Promise:true */

"use strict";

var assert = require("assert"),
    Promise = require("bluebird"),
    srsly = require("./");

describe("Handling successful results",function() {
  it("should resolve returned promises",function() {
    var retry = srsly({
      style: Promise,
      delay: srsly.noDelay
    });

    return retry(function(arg) {
      return Promise.resolve(arg.toUpperCase());
    },"success!").then(function(result) {
      assert.equal(result,"SUCCESS!");
    });
  });

  it("should call callbacks with null error and the result",function(done) {
    var retry = srsly({
      style: "node",
      delay: srsly.noDelay
    });

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
    var retry = srsly({
      output: Promise,
      delay: srsly.noDelay
    });

    return retry(function(arg, callback) {
      callback(null,arg.toUpperCase());
    },"success!").then(function(result) {
      assert.equal(result,"SUCCESS!");
    });
  });

  it("should reject returned promises using callback errors",function() {
    var retry = srsly({
      output: Promise,
      delay: srsly.max(1,srsly.noDelay)
    });

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
    var retry = srsly({
      input: "promise",
      delay: srsly.max(1,srsly.noDelay)
    });

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
    var retry = srsly({
      input: "promise",
      delay: srsly.max(1,srsly.noDelay)
    });

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

describe("Retrying a failed operation",function() {
  it("should wait between retries",function() {
  });

  it("should yield the expected result on success",function() {
  });

  it("should not exceed the maximum allowed tries",function() {
  });

  it("should pass through the last error if all tries fail",function() {
  });
});
