import { unpackFID } from './FID';
import Decimal from 'decimal.js';

describe('FID', () => {
    it('should persist', () => {
        let fid1 = unpackFID(0x10);
        let fid2 = unpackFID(0x10);
        let fid3 = unpackFID(0x11);
        let fid4 = unpackFID('10');
        let fid5 = unpackFID(new Decimal(0x10));
        expect(fid1 === fid2).toBe(true);
        expect(fid1 === fid3).toBe(false);
        expect(fid1 === fid4).toBe(true);
        expect(fid1 === fid5).toBe(true);
    });
});