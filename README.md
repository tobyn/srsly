# srsly

`srsly` is a small library for retrying asynchronous functions until
they succeed.


## Features

* Works in node and the browser.
* Supports arbitrary (potentially asynchronous) retry strategies.
  Several composable limiting and backoff functions are included to
  cover most common use cases and make building more complex ones easier.
* Equal support for functions that accept node-style callbacks and
  functions that return promises, with conversion between the two.
* No dependencies. Unless you want promise output and your JS
  implementation doesn't have native support. In that case you can
  provide whatever ES6-compatible implementation you like (the tests use
  Bluebird).


## Install

You can either `npm install srsly`, or just download a copy of srsly.js.

In node, `require("srsly")` returns a factory function. This function is
exposed in the browser as the `srsly` global.


## Examples

### Node-style API

```js
var retry = require("srsly")();

retry(myNodeStyleAsyncFunction,"extra","args",function(err, result) {
  // In the default configuration, myNodeStyleAsyncFunction will be
  // called until it completes successfully, so err should never be set.
});
```

### Promise API

```js
var retry = require("srsly")({ style: require("bluebird") });

retry(myPromiseReturningFunction,"extra","args")
  .then(function(result) {
    // This promise isn't resolved until one of the promises returned by
    // calling myPromiseReturningFunction resolves successfully.
  },function(err) {
    // As in the node-style example, errors are retried indefinitely by
    // default, so this branch should never be reached.
  });
```

### Slightly Fancier

```js
var fs = require("fs");

var retry = require("srsly")({
  output: require("bluebird"),
  delay: "exponential",
  fuzz: 2,
  maxDelay: 10, // seconds
  tries: 10
});

retry(fs.readFile,"/etc/shadow")
  .then(function(secrets) {
    console.log(secrets);
  },function(err) {
    console.error("Reading failed 10 times. Here is the last error:",err);
  });
```


## API

### `srsly([options: Object]): Function`

Creates a new retry function. The following options are valid:

* `input` *String | Function* (Default: `"node"`)  

  Declares the API of functions retried by the new retry function.
  
  If the value is `"node"`, then any retried functions are assumed to
  take a node-style callback as their final argument.

  If the value is `"promise"` or an ES6-compatible promise constructor,
  then retried functions are expected to return a promise.

* `output` *String | Function* (Default: `node`)  
  
  Declares the API provided by the new retry function.

  If the value is `"node"`, then the retry function will accept a
  node-style callback as its final argument.

  If the value is `"promise"`, then the `Promise` global *must* be an
  ES6-compatible promise constructor. This constructor will be used to
  create new promises.

  If the value is an ES6-compatible promise constructor, then the retry
  function will use that constructor to return a promise.

* `style` *String | Function*

  Setting this option is shorthand for setting both `input` and `output`
  to the same value. If provided, `input` and `output` take precedence
  over the value of this option.

* `strategy` *Function*

  Use the specified retry strategy. See [**Strategies**](#strategies).

* `delay` *String | Number | Array | Function* (Default: none)

  Wait before each retry. This option is ignored if the `strategy`
  option is provided.

  If the value is `"exponential"`, the initial retry is delayed one
  second, and subsequent retries are delayed by twice as long as the
  previous delay.

  If the value is `"fibonacci"`, the initial retry is delayed by one
  second, and subsequent retries are delayed by the number of seconds
  represented by the corresponding value in the Fibonacci sequence.

  If the value is a number, it is the number of seconds to wait before
  each retry.

  If the value is an array, the first element in the array represents
  the number of seconds to wait before the first retry, the second
  element represents the wait before the second retry, and so on. If
  more retries are needed than there are elements in the array, the last
  element is reused for the excess retries.

  If the value is a function, it is a delay strategy. See [**Delay
  Strategies**](#delay-strategies).

* `fuzz` *Number | Array* (Default: none)

  Delay each retry by a random amount. If `fuzz` is a number, the delay
  is `[0,value)` seconds. If `fuzz` is an array, the first two elements
  are interpreted as `[minimum, maximum]`, and the delay is between
  `[minimum,maxmimum)`.

  This option is ignored if the `strategy` option is provided. If the
  `delay` option is provided, any random delay is *in addition to* that
  delay.  If the `maxDelay` option is provided, the combined delay is
  subject to the limit.

* `maxDelay` *Number* (Default: none)

  The maximum delay between retries in seconds. This option is ignored
  if the `strategy` option is provided.

* `tries` *Number* (Default: no maximum)

  The maximum number of tries before giving up.

## <a name="strategies"></a>Strategies

Strategies determine what to do when an operation fails. Strategies are
functions that take four arguments: the number of tries so far, the last
error received, a function that will trigger an immediate retry, and
another function that will abort retrying with a given error.

### `srsly.delay(getDelay: Function): Function`

Returns a strategy that waits before retrying. `getDelay` is a [**Delay
Strategy**](#delay-strategies) function.

### `srsly.maxTries(n: Number, [strategy: Function]): Function`

Returns a strategy that terminates retrying if `n` tries have failed. If
fewer than `n` tries have failed, `maxTries` delegates to `strategy` if
provided, otherwise it retries immediately.

## <a name="delay-strategies"></a>Delay Strategies

Delay strategies are functions used by the `delay` strategy. The only
argument they require is the number of tries. They return a number
representing the number of seconds to wait before the next try.

### `srsly.specifiedDelays(delays: Array[Number]): Function`

Returns a delay strategy that yields the elements of `delays`. If the
number of tries is greater than the number of elements in `delays`, the
last element is used for the excess tries.

### `srsly.exponentialDelays(base: Number = 1, multiplier: Number = 2): Function`

Returns a delay strategy that yields exponentially increasing numbers.
For the first try, the number returned is `base`. For each subsequent
try, `base` is multiplied by `multiplier`.

### `srsly.fibonacciDelays(start: Number = 1): Function`

Returns a delay strategy that yields the numbers from the Fibonacci
sequence. If `start` is provided and greater than 1, it is used as the
initial element of a new sequence constructed by the same process as the
Fibonacci sequence.

### `srsly.randomDelays(range: Number | Array = 1, [getDelay: Function]): Function`

Returns a delay strategy that yields a random delay. If `range` is a
number, the value returned will be between `[0,value)`. If `range` is an
array, the first two elements are interpreted as `[minimum, maximum]`,
and the resulting value is in the range `[minimum,maximum)`.

If `getDelay` exists, any delay it yields is added to the random delay.

### `srsly.maxDelay(max: Number, getDelay: Function): Function`

Returns a delay strategy that yields delays provided by `getDelay`. If
any of these delays are larger than `max`, `max` is returned instead.
