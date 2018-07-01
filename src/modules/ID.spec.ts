import { ID } from '../../src/modules/ID';

let ParcelId = new ID('Parcel');
let BlockId = new ID('Block');

describe('ID Module', () => {

    it('should handle mangled ids', () => {
        // TODO: Handle Case
        // Type: Organization
        // MXxvcmdhbml6YXRpb26
        // MXxvcmdhbml6YXRpb24
    });

    it('should serialize correctly', () => {
        let id1 = ParcelId.serialize(123);
        let id2 = ParcelId.serialize(123);
        let id3 = 'MTIzfHBhcmNlbA';
        expect(id1).toBe(id3);
        expect(id2).toBe(id3);
    });

    it('should serialize differently for different types', () => {
        let id1 = ParcelId.serialize(123);
        let id4 = BlockId.serialize(123);
        expect(id4).not.toBe(id1);
    });

    it('should crash on wrong type', () => {
        let id1 = ParcelId.serialize(123);
        expect(() => BlockId.parse(id1)).toThrowError('Type mismatch. Expected: block, got parcel');
    });

    it('should not depend on capitalization of type', () => {
        let ParcelId2 = new ID('ParceL');
        expect(ParcelId.serialize(123)).toBe(ParcelId2.serialize(123));
    });

    it('should crash on negative numbers', () => {
        expect(() => ParcelId.serialize(-1)).toThrow('Ids can\'t be negative!');
    });

    it('should crash on float numbers', () => {
        expect(() => ParcelId.serialize(0.1)).toThrow('Ids can\'t be float numbers!');
    });
});