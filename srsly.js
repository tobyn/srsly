(function() {

"use strict";

var slice = Array.prototype.slice;


module.exports = exports = factory;

function factory(options) {
  var style  = options.style  || "node",
      input  = options.input  || style,
      output = options.output || style;

  if (output === "promise" && typeof Promise === "undefined") {
    var opt = options.output ? "output" : "style";
    throw new Error(
      "This JS implementation lacks native promises. In order to " +
      "generate promise output, pass an ES6-compliant promise constructor " +
      "(Bluebird is a good choice) as the '" + opt + "' option.");
  }

  var fn;
  if (input === "promise" || typeof input === "function")
    fn = partial(promiseInputAdapter,options.delay);
  else
    fn = partial(srsly,options.delay);

  if (typeof output === "function")
    return nodeToPromise(fn,output);
  else
    return fn;
}

function promiseInputAdapter(getDelay, fn) {
  var args = slice.call(arguments,2);
  args.unshift(promiseToNode(fn));
  args.unshift(getDelay);
  return srsly.apply(null,args);
}


exports.srsly = srsly;

function srsly(getDelay, fn) {
  var tries = 0,
      finished = false,
      args = slice.call(arguments,2),
      callback = args.pop();

  if (typeof callback !== "function") {
    args.push(callback);
    callback = noop;
  }

  args.push(function(err, result) {
    if (err)
      fail(err);
    else
      finish(err,result);
  });

  attempt();

  function attempt() {
    tries++;

    try {
      fn.apply(null,args);
    } catch (err) {
      fail(err);
    }
  }

  function fail(err) {
    try {
      var delay = getDelay(tries,err);
      setTimeout(attempt,delay);
    } catch (e) {
      finish(e);
    }
  }

  function finish(err, result) {
    if (finished) return;
    finished = true;
    callback(err,result);
  }
}


exports.promiseToNode = promiseToNode;

function promiseToNode(fn) {
  return function() {
    var args = slice.call(arguments),
        callback = args.pop();

    if (typeof callback !== "function") {
      args.push(callback);
      callback = noop;
    }

    fn.apply(null,args).then(partial(callback,null),callback);
  };
}


exports.nodeToPromise = nodeToPromise;

function nodeToPromise(fn, Promise) {
  return function() {
    var args = slice.call(arguments);

    return new Promise(function(resolve, reject) {
      args.push(function(err, result) {
        if (err)
          reject(err);
        else
          resolve(result);
      });

      try {
        fn.apply(null,args);
      } catch (e) {
        reject(e);
      }
    });
  };
}


exports.max = max;

function max(n, realDelay) {
  return function(tries, err) {
    if (tries >= n)
      throw err;
    else
      return realDelay(tries,err);
  };
}


exports.noDelay = noDelay;

function noDelay() {
  return 0;
}


exports.partial = partial;

function partial(fn) {
  var args = slice.call(arguments,1);

  return function() {
    return fn.apply(this,args.concat(slice.call(arguments)));
  };
}


function noop() { }

})();
