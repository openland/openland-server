import { SecIDv2Factory } from './SecIDV2';
import { RandomIDFactory } from './RandomIDFactory';

describe('SecIDv2', () => {
    it('should encrypt and decrypt', () => {
        let random = new RandomIDFactory(0);
        let factory = new SecIDv2Factory('test');
        let s = factory.createId('Sample');
        let id = random.next();
        let encId = s.serialize(id);
        console.log(encId);
        let unencId = s.parse(encId);
        expect(unencId).toBe(id);
    });
});