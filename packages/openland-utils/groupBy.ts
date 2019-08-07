
// method has been borrowed from lodash

type PropertyName = string | number;

type ValueIteratee<T> = ((value: T) => PropertyName);

interface Dictionary<T> {
  [index: string]: T;
}

export const groupBy = <T>(collection: T[], iteratee: ValueIteratee<T>) =>
  collection.reduce<Dictionary<T[]>>((result, value) => {
    const key = iteratee(value);
    result[key] = result[key] || [];
    result[key].push(value);
    return result;
  }, {});