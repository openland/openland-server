import { encrypt, decrypt } from './SecID';

describe('SecID Module', () => {
    it('should serialize correctly', () => {
        let res = encrypt('My Secret Hash', 'Some Type', 12300000);
        console.warn(res);
        let res2 = decrypt('My Secret Hash', 'Some Type', res);
        console.warn(res2);
    });
});