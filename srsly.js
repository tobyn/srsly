(function() {

"use strict";

var slice = Array.prototype.slice;


module.exports = exports = factory;

function factory(options) {
  var format = options.format || "node";

  if (format === "node") {
    return partial(srsly,options.delay);
  } else if (typeof format === "function") {
    return partial(promiseAdapter,format,options.delay);
  } else {
    throw new Error(
      "Invalid format (must be 'node' or ES6-compliant Promise " +
      "constructor): " + format
    );
  }
}

function promiseAdapter(Promise, getDelay, fn) {
  var args = slice.call(arguments,3),
      wrapped = nodeToPromise(Promise,srsly);
  args.unshift(promiseToNode(fn));
  args.unshift(getDelay);
  return wrapped.apply(null,args);
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

function nodeToPromise(Promise, fn) {
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
