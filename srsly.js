(function() {
/* @flow */

"use strict";

var slice = Array.prototype.slice;


var exports = factory;

if (typeof window !== "undefined")
  window.srsly = exports;
else if (typeof module !== "undefined" && "exports" in module)
  module.exports = exports;


function factory(options) {
  var style = options.style,
      input = options.input,
      output = options.output;

  if (style)
    validateStyle("style",style);
  else
    style = "node";

  if (input)
    validateStyle("input",input);
  else
    input = style;

  if (output)
    validateStyle("output",output);
  else
    output = style;

  if (output === "promise") {
    if (typeof Promise === "undefined")
      throw new Error(
        "This JS implementation lacks native promises. In order to " +
        "generate promise output, pass an ES6-compliant Promise " +
        "constructor (Bluebird is a good choice) as the '" +
        (options.output ? "output" : "style") + "' option.");

    output = Promise;
  }

  if (input === "node")
    input = nodeIn;
  else
    input = promiseIn;

  if (output === "node")
    output = nodeOut;
  else
    output = partial(promiseOut,output);

  var strategy = options.strategy || immediate;

  return partial(retry,input,output,strategy);
}

function validateStyle(opt, value) {
  if (value !== "node" && value !== "promise" && typeof value !== "function")
    throw new Error(
      "Invalid '" + opt + "' option. Acceptable values are 'node', " +
      "'promise', or an ES6-compliant Promise constructor.");
}


function retry(input, output, strategy, fn/*, [args...] */) {
  var args = slice.call(arguments,4);

  return output(args,function(resolve, reject) {
    var tries = 0,
        finished = false;

    attempt();

    function attempt() {
      tries++;

      try {
        input(fn,args,succeed,failAttempt);
      } catch (e) {
        failAttempt(e);
      }
    }

    function succeed(result) {
      if (finished) return;
      finished = true;
      resolve(result);
    }

    function fail(err) {
      if (finished) return;
      finished = true;
      reject(err);
    }

    function failAttempt(err) {
      try {
        strategy(tries,err,once(attempt),fail);
      } catch (e) {
        fail(e);
      }
    }
  });
}


function nodeIn(fn, args, resolve, reject) {
  args.push(function(err, result) {
    if (err)
      reject(err);
    else
      resolve(result);
  });

  fn.apply(null,args);
}

function promiseIn(fn, args, resolve, reject) {
  fn.apply(null,args).then(resolve,reject);
}


function nodeOut(args, retry) {
  var callback = args[args.length-1];

  if (typeof callback === "function")
    args.pop();
  else
    callback = noop;

  retry(partial(callback,null),callback);
}

function promiseOut(Promise, args, retry) {
  return new Promise(retry);
}


exports.immediate = immediate;

function immediate(tries, err, retry) {
  retry();
}


exports.delay = delay;

function delay(getDelay) {
  return function(tries, err, retry) {
    setTimeout(retry,getDelay(tries) * 1000);
  };
}


exports.maxDelay = maxDelay;

function maxDelay(max, getDelay) {
  return function(tries) {
    var d = getDelay(tries);
    if (d > max)
      return max;
    else
      return d;
  };
}


exports.delays = delays;

function delays(/* delays... */) {
  return delay(specified(slice.call(arguments)));
}


exports.specified = specified;

function specified(delays) {
  var len = delays.length,
      max = delays[len-1];

  return function(tries) {
    var index = tries - 1,
        seconds;

    if (index >= len)
      seconds = max;
    else
      seconds = delays[index];

    return seconds;
  };
}


exports.exponential = exponential;

function exponential(base, exp) {
  if (!base && base !== 0)
    base = 1;

  if (!exp && exp !== 0)
    exp = 2;

  return function(tries) {
    return base * Math.max(Math.pow(exp,tries-1),1);
  };
}


exports.fibonacci = fibonacci;

function fibonacci(start) {
  if (arguments.length === 0)
    start = 1;

  var n_1,
      n_2 = start;

  if (start === 0)
    n_1 = 1;
  else
    n_1 = start;

  return function(tries) {
    if (tries === 1)
      return n_2;
    else if (tries === 2)
      return n_1;

    var temp = n_2;
    n_2 = n_1;
    n_1 = n_2 + temp;

    return n_1;
  };
}


exports.maxTries = maxTries;

function maxTries(n, strategy) {
  return function(tries, err, retry, fail) {
    if (tries >= n)
      fail(err);
    else if (strategy)
      strategy(tries,err,retry,fail);
    else
      retry();
  };
}


function noop() { }

function once(fn) {
  var called = false;

  return function() {
    if (called) return;
    called = true;
    return fn.apply(this,arguments);
  };
}

function partial(fn) {
  var args = slice.call(arguments,1);

  return function() {
    return fn.apply(this,args.concat(slice.call(arguments)));
  };
}

})();
