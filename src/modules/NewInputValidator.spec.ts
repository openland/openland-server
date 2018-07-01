import { validate, stringNotEmpty } from './NewInputValidator';

describe('New Input Validator', () => {
    it('should validate strings', async () => {
        await validate({
            name: stringNotEmpty(),
        }, { name: 'something' });
    });
});