import { validate, stringNotEmpty } from './NewInputValidator';

describe('New Input Validator', () => {
    it('should validate strings', async () => {
        expect(validate({ name: stringNotEmpty() }, { name: 'something' })).resolves.toBe(undefined);
        expect(validate({ name: stringNotEmpty() }, { name: '' })).rejects.toThrow();
        expect(validate({ name: stringNotEmpty() }, { name: null })).rejects.toThrow();
        expect(validate({ name: stringNotEmpty() }, { name: undefined })).rejects.toThrow();
        expect(validate({ name: stringNotEmpty() }, {})).rejects.toThrow();
    });
    it('should validate structs', async () => {
        expect(validate({ something: { name: stringNotEmpty() } }, { something: { name: 'something' } })).resolves.toBe(undefined);
        expect(validate({ something: { name: stringNotEmpty() } }, { something: { name: '' } })).rejects.toThrow();
    });
    it('should ignore unknown fields', async () => {
        expect(validate({ something: { name: stringNotEmpty() } }, { something: { name: 'something', some: 'str' } })).resolves.toBe(undefined);
    });
});