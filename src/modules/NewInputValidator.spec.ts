import { validate, stringNotEmpty } from './NewInputValidator';

describe('New Input Validator', () => {
    it('should validate strings', async () => {
        await validate({ name: stringNotEmpty(), }, { name: 'something' });
        expect(validate({ name: stringNotEmpty(), }, { name: '' })).rejects.toThrow();
        expect(validate({ name: stringNotEmpty(), }, { name: null })).rejects.toThrow();
        expect(validate({ name: stringNotEmpty(), }, { name: undefined })).rejects.toThrow();
        expect(validate({ name: stringNotEmpty(), }, {  })).rejects.toThrow();
    });
});