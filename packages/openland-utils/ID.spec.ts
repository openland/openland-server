import { ID } from './ID';

describe('ID', () => {
    it('should handle simple integers', () => {
        expect((new ID(1)).value).toEqual('01');
        expect((new ID(2)).value).toEqual('02');
        expect((new ID(12345)).value).toEqual('3039');
    });
    it('should crash for negative or zero integers', () => {
        expect(() => new ID(0)).toThrowError();
        expect(() => new ID(-1)).toThrowError();
    });
    it('should crash for float numbers', () => {
        expect(() => new ID(0.1)).toThrowError();
        expect(() => new ID(-0)).toThrowError();
    });
    it('should handle string formats', () => {
        expect((new ID('01')).value).toEqual('01');
        expect((new ID('04')).value).toEqual('04');
        expect((new ID('3039')).value).toEqual('3039');
    });
    it('should crash for truncated ids', () => {
        expect(() => new ID('1')).toThrowError();
        expect(() => new ID('201')).toThrowError();
    });
    it('should crash for zero', () => {
        expect(() => new ID('00')).toThrowError();
    });
    it('should crash for zero prefixes', () => {
        expect(() => new ID('00')).toThrowError();
        expect(() => new ID('0001')).toThrowError();
    });
    it('should crash for mailformed input', () => {
        expect(() => new ID('01;')).toThrowError();
        expect(() => new ID('test!121')).toThrowError();
        expect(() => new ID('#01')).toThrowError();
    });
});