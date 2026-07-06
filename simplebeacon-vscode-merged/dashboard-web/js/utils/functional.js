/**
 * @module functional
 */

export function compose(...fns) {
  return function (value) {
    return fns.reduceRight((acc, fn) => fn(acc), value);
  };
}

export function pipe(...fns) {
  return function (value) {
    return fns.reduce((acc, fn) => fn(acc), value);
  };
}

export function zipWith(arr1, arr2, fn) {
  if (!arr1 || typeof arr1.length !== 'number' || !arr2 || typeof arr2.length !== 'number') {
    return [];
  }
  const len = Math.min(arr1.length, arr2.length);
  const result = new Array(len);
  for (let i = 0; i < len; i++) {
    result[i] = fn(arr1[i], arr2[i]);
  }
  return result;
}

export function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) {
      return fn.apply(this, args);
    }
    return function (...nextArgs) {
      return curried.apply(this, args.concat(nextArgs));
    };
  };
}

export function partial(fn, ...presetArgs) {
  return function (...args) {
    return fn.apply(this, presetArgs.concat(args));
  };
}

export function tap(value, fn) {
  fn(value);
  return value;
}
