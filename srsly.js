(function() {

"use strict";

var slice = Array.prototype.slice;

var runNext;
if (typeof setImmediate === "function")
  runNext = setImmediate;
else
  runNext = setTimeout;


var exports = factory;

if (typeof window !== "undefined")
  window.srsly = exports;
else if (typeof module !== "undefined" && "exports" in module)
  module.exports = exports;


function factory(options) {
  if (!options) options = {};

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

  var strategy = options.strategy;

  if (!strategy) {
    var delayOpt = options.delays || options.delay;

    if (delayOpt) {
      if (delayOpt === "fibonacci")
        strategy = fibonacciDelays();
      else if (delayOpt === "exponential")
        strategy = exponentialDelays();
      else if (typeof delayOpt === "function")
        strategy = delayOpt;
      else if (typeof delayOpt === "number")
        strategy = specifiedDelays([delayOpt]);
      else if (delayOpt)
        strategy = specifiedDelays(delayOpt);
      else
        strategy = specifiedDelays([0]);

      if (options.fuzz)
        strategy = randomDelays(options.fuzz,strategy);

      if (options.maxDelay)
        strategy = maxDelay(options.maxDelay,strategy);

      strategy = delay(strategy);
    }
  }

  if (options.tries)
    strategy = maxTries(options.tries,strategy);

  return partial(retry,input,output,strategy);
}

function validateStyle(opt, value) {
  if (value !== "node" && value !== "promise" && typeof value !== "function")
    throw new Error(
      "Invalid '" + opt + "' option. Acceptable values are 'node', " +
      "'promise', or an ES6-compliant Promise constructor.");
}


exports.retry = retry;

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


exports.maxTries = maxTries;

function maxTries(n, strategy) {
  return function(tries, err, retry, fail) {
    if (tries >= n)
      fail(err);
    else if (strategy)
      strategy(tries,err,retry,fail);
    else
      runNext(retry,0);
  };
}


exports.delay = delay;

function delay(getDelay) {
  return function(tries, err, retry) {
    var delay = getDelay(tries);
    if (delay <= 0)
      runNext(retry,0);
    else
      setTimeout(retry,delay * 1000);
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


exports.specifiedDelays = specifiedDelays;

function specifiedDelays(delays) {
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


exports.exponentialDelays = exponentialDelays;

function exponentialDelays(base, multiplier) {
  if (!base && base !== 0)
    base = 1;

  if (!multiplier && multiplier !== 0)
    multiplier = 2;

  return partial(exponentialDelay,base,multiplier);
}

function exponentialDelay(base, multiplier, tries) {
  return base * Math.max(Math.pow(multiplier,tries-1),1);
}


exports.fibonacciDelays = fibonacciDelays;

function fibonacciDelays(start) {
  if (!start && start !== 0)
    start = 1;

  return partial(fibonacciDelay,start);
}

function fibonacciDelay(start, tries) {
  var a = start,
      b = start || 1,
      temp;

  while (tries > 1) {
    temp = a;
    a = b;
    b += temp;
    tries--;
  }

  return a;
}


exports.randomDelays = randomDelays;

function randomDelays(range, getDelay) {
  var min, interval;

  if (typeof range === "undefined") {
    range = 1;
  } else if (typeof range === "function" && !getDelay) {
    getDelay = range;
    range = 1;
  }

  if (typeof range === "object" && range.length) {
    min = range[0];
    interval = range[1] - min;
  } else {
    min = 0;
    interval = range;
  }

  return function(tries) {
    var base;
    if (getDelay)
      base = getDelay(tries);
    else
      base = 0;

    return base + min + (interval * Math.random());
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
