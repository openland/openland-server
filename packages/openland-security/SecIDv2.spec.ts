import { SecIDv2Factory } from './SecIDv2';
// import { RandomIDFactory } from './RandomIDFactory';
// import Hashids from 'hashids';

describe('SecIDv2', () => {
    it('Factory should work', () => {
        let factory = new SecIDv2Factory('Shared Secret');
        factory.createStringId('First Type');
        factory.createNumberId('Second Type');
    });
    it('Should serialize correctly', () => {
        let factory = new SecIDv2Factory('Shared Secret', 'hex');
        let id = factory.createNumberId('IdType');
        let serialized = id.serialize(123);
        let parsed = id.parse(serialized);
        expect(parsed).toEqual(123);
        expect(serialized).toEqual('7d1f9519ed46c06318881913307a23ba');

        let id2 = factory.createStringId('IdType2');
        serialized = id2.serialize('test');
        parsed = id2.parse(serialized);
        expect(parsed).toEqual('test');
        expect(serialized).toEqual('7d22571aed42b47d59646dd344ca95a870a8');
    });
    it('Should handle crash on collisions', () => {
        let factory = new SecIDv2Factory('Shared Secret', 'hex');
        factory.createNumberId('idtype');
        expect(() => factory.createNumberId('idtype')).toThrow();
    });
    it('should not depend on capitalization of type', () => {
        let factory1 = new SecIDv2Factory('Shared Secret', 'hex');
        let factory2 = new SecIDv2Factory('Shared Secret', 'hex');
        let type1 = factory1.createNumberId('type');
        let type2 = factory2.createNumberId('TYPE');
        expect(type1.serialize(123)).toBe(type2.serialize(123));
    });
    it('Serialization should be consistent', () => {
        let factory = new SecIDv2Factory('Shared Secret', 'hex');
        let id = factory.createNumberId('idtype');
        let main = id.serialize(123);
        for (let i = 0; i < 10; i++) {
            expect(id.serialize(123)).toEqual(main);
        }
    });
    it('should serialize differently for different types', () => {
        let factory = new SecIDv2Factory('Shared Secret', 'hex');
        let type1 = factory.createNumberId('type1');
        let type2 = factory.createNumberId('type2');
        expect(type1.serialize(123)).not.toBe(type2.serialize(123));
    });
    it('should crash on negative numbers', () => {
        let factory = new SecIDv2Factory('Shared Secret', 'hex');
        let type1 = factory.createNumberId('type1');
        expect(() => type1.serialize(-1)).toThrow('Ids can\'t be negative!');
    });

    it('should crash on float numbers', () => {
        let factory = new SecIDv2Factory('Shared Secret', 'hex');
        let type1 = factory.createNumberId('type1');
        expect(() => type1.serialize(0.1)).toThrow('Ids can\'t be float numbers!');
    });
    it('should crash on incorrect input', () => {
        let factory = new SecIDv2Factory('Shared Secret', 'hex');
        let type1 = factory.createNumberId('type1');
        expect(() => type1.parse('somestring')).toThrow('Invalid id');
        expect(() => type1.parse('7d1f9519ed46c06318881913307a23ba')).toThrow('Invalid id');
    });

    it('should resolve type', () => {
        let factory = new SecIDv2Factory('Shared Secret', 'hex');
        let type1 = factory.createNumberId('type1');
        factory.createNumberId('type2');
        factory.createNumberId('type3');
        factory.createNumberId('type4');
        let res = factory.resolve(type1.serialize(123));
        expect(res.id).toEqual(123);
        expect(res.type).toEqual(type1);
    });

    it('should handle large numbers', () => {
        let factory = new SecIDv2Factory('Shared Secret', 'hex');
        let type1 = factory.createNumberId('type1');
        expect(type1.parse(type1.serialize(2147483647))).toEqual(2147483647);
    });
    it('should crash for too large numbers', () => {
        let factory = new SecIDv2Factory('Shared Secret', 'hex');
        let type1 = factory.createNumberId('type1');
        expect(() => type1.serialize(2147483648)).toThrow();
    });
});