import { jField, json, jString, validateJson } from './jsonSchema';

describe('jsonSchema', () => {
    it('should validate basic object', async () => {
        let schema = json(() => {
            jField('firstName', jString());
            jField('lastName', jString());
        });

        expect(validateJson(schema, { firstName: '1', lastName: '2' })).toEqual(true);
    });
});