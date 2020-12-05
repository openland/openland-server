import { sortedArrayAdd } from './sortedArrayAdd';

let comparator = (a: number, b: number) => a - b;

describe('sortedArrayAdd', () => {
    it('should add value to empty array', () => {
        expect(sortedArrayAdd([], 0, comparator)).toMatchObject([0]);
        expect(sortedArrayAdd([], 1, comparator)).toMatchObject([1]);
        expect(sortedArrayAdd([], 10, comparator)).toMatchObject([10]);
    });
    it('should add value to sorted array', () => {
        expect(sortedArrayAdd([1, 2, 3], 0, comparator)).toMatchObject([0, 1, 2, 3]);
        expect(sortedArrayAdd([1, 2, 3], 2.5, comparator)).toMatchObject([1, 2, 2.5, 3]);
        expect(sortedArrayAdd([1, 2, 3], 4, comparator)).toMatchObject([1, 2, 3, 4]);
    });
});