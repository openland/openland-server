import { distanceBetween } from './geo';

describe('geo', () => {
    it('should calculate distance correctly', () => {
        let distance = distanceBetween(
            { lat: 37.773972, long: -122.431297 }, // SF
            { lat: 40.730610, long: -73.935242 } // NYC
        );
        expect(distance).toBeGreaterThan(4100);
        expect(distance).toBeLessThan(4200);
    });
});