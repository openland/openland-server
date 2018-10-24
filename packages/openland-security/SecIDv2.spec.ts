import { SecIDv2Factory } from './SecIDv2';
import { RandomIDFactory } from './RandomIDFactory';
// import Hashids from 'hashids';

describe('SecIDv2', () => {
    it('should encrypt and decrypt', () => {
        let random = new RandomIDFactory(0);
        let factory = new SecIDv2Factory('test');
        let s = factory.createId('Sample');
        let id = random.next();
        let encId = s.serialize(id);
        let unencId = s.parse(encId);
        expect(unencId).toBe(id);
    });
});