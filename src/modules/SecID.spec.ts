import { SecIDFactory } from './SecID';

describe('SecID Module', () => {
    it('Factory should work', () => {
        let factory = new SecIDFactory('Shared Secret', 'hashids');
        let FirstId = factory.createId('First Type');
        // let SecondId = factory.createId('Second Type');
        let res = FirstId.serialize(123);
        console.warn(res);
        let res2 = FirstId.parse(res);
        console.warn(res2);
        // console.warn(FirstId);
        // console.warn(SecondId);
    });
});