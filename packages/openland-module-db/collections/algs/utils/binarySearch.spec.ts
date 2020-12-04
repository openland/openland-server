import { binarySearch } from './binarySearch';

describe('binarySearch', () => {
    it('should search in empty array', () => {
        expect(binarySearch([], 3)).toBe(-1);
        expect(binarySearch([], 0)).toBe(-1);
        expect(binarySearch([], -1)).toBe(-1);
    });
    it('should search values correctly', () => {
        expect(binarySearch([1, 2, 3, 4, 5], 3)).toBe(2);
        expect(binarySearch([1, 2, 3, 4, 5], -1)).toBe(-1);
        expect(binarySearch([1, 2, 3, 4, 5], 5)).toBe(4);
    });
});