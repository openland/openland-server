import { subsctractBuffer } from './substractBuffer';

describe('substractBuffer', () => {
    it('should substract empty values', () => {
        let src = Buffer.from([1, 2, 3]);
        expect(subsctractBuffer(src, Buffer.from([0, 0, 0]))).toMatchObject(src);

        src = Buffer.from([]);
        expect(subsctractBuffer(src, Buffer.from([]))).toMatchObject(src);
    });

    it('should substract without overflow', () => {
        let src = Buffer.from([1, 2, 3]);
        expect(subsctractBuffer(src, Buffer.from([0, 1, 2]))).toMatchObject(Buffer.from([1, 1, 1]));
    });

    it('should substract with overflow', () => {
        let src = Buffer.from([1, 2, 3]);
        expect(subsctractBuffer(src, Buffer.from([0, 3, 2]))).toMatchObject(Buffer.from([0, 254, 1]));
    });
});